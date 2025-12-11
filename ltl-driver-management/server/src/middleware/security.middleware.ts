import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const MAX_SCAN_SIZE = 4096; // 4KB max scan size to prevent ReDoS

// Define patterns for malicious request detection
const STRICT_PATTERNS = [
  /\.\.\//gi, // Path traversal
  /%2e%2e%2f/gi, // URL encoded path traversal
  /%00|\x00/gi, // Null byte injection
  /(\||&&)\s*\w/gi, // Shell command chaining
  /\$\(\s*\w+\s*\)/gi, // Shell command substitution
  /<!ENTITY/gi, // XML External Entity (XXE)
  /\bunion\s+select\b/gi, // SQL injection - Union
  /'\s+OR\s+'1'='1/gi, // SQL injection - Tautology
  /;\s*DROP\s+TABLE/gi, // SQL injection - Destructive
  /<script\b[^>]*>/gi, // XSS script tags
  /javascript:\s*[^\s]/gi, // JavaScript protocol
  /on(?:load|click|error|mouse\w+|key\w+|focus|blur|change|submit|input)\s*=\s*["']/gi, // Event handlers
];

const RECON_PATTERNS = [
  /wp-admin|phpmyadmin|\.env/gi, // Common recon targets
  /admin|config|backup|\.git/gi, // Sensitive paths
];

// In-memory cache for strike data (consider Redis for production)
const strikeCache = new Map<string, { blocked: boolean; expiresAt: number }>();

// Get client identity
const getClientIdentity = (req: Request): string => {
  if ((req as any).user?.id) {
    return `user:${(req as any).user.id}`;
  }
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
};

// Check if identity is blocked
const isBlocked = async (identity: string): Promise<boolean> => {
  // Check cache first
  const cached = strikeCache.get(identity);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return cached.blocked;
    } else {
      // Expired, remove from cache
      strikeCache.delete(identity);
    }
  }

  // Check database
  try {
    const strike = await prisma.$queryRaw<any[]>`
      SELECT block_until FROM security_strikes 
      WHERE identity = ${identity} 
      AND block_until > NOW()
      LIMIT 1
    `;
    
    const isBlocked = strike.length > 0;
    
    // Cache the result for 60 seconds
    strikeCache.set(identity, {
      blocked: isBlocked,
      expiresAt: Date.now() + 60000
    });
    
    return isBlocked;
  } catch (error) {
    console.error('Failed to check strike status:', error);
    return false; // Fail open
  }
};

// Add strike to identity
const addStrike = async (identity: string, severity: number = 1): Promise<void> => {
  try {
    // First, try to get existing strikes
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, strike_count, updated_at 
      FROM security_strikes 
      WHERE identity = ${identity}
      LIMIT 1
    `;

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    if (existing.length > 0) {
      const record = existing[0];
      const lastUpdate = new Date(record.updated_at);
      
      // Reset strikes if last update was more than 1 hour ago
      const newCount = lastUpdate < oneHourAgo ? severity : record.strike_count + severity;
      
      // Determine block duration based on strike count
      let blockUntil = null;
      if (newCount >= 10) {
        // 30 days ban
        blockUntil = new Date(now.getTime() + 30 * 24 * 3600000);
      } else if (newCount >= 3) {
        // 1 hour block
        blockUntil = new Date(now.getTime() + 3600000);
      }

      // Update record
      await prisma.$executeRaw`
        UPDATE security_strikes 
        SET strike_count = ${newCount},
            block_until = ${blockUntil},
            updated_at = ${now}
        WHERE id = ${record.id}
      `;

      // Update cache
      if (blockUntil) {
        strikeCache.set(identity, {
          blocked: true,
          expiresAt: blockUntil.getTime()
        });
      }
    } else {
      // Create new record
      await prisma.$executeRaw`
        INSERT INTO security_strikes (identity, strike_count, block_until, updated_at)
        VALUES (${identity}, ${severity}, NULL, ${now})
      `;
    }
  } catch (error) {
    console.error('Failed to add strike:', error);
    // Fail open - don't block legitimate users due to database errors
  }
};

// Generate request ID for tracing
const generateRequestId = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

// Security middleware
export const securityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Add request ID for tracing
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const identity = getClientIdentity(req);

  // Check if identity is blocked
  if (await isBlocked(identity)) {
    res.status(403).json({ error: 'Access Denied' });
    return;
  }

  // Build request data for scanning (limited to prevent ReDoS)
  const urlData = `${req.path} ${req.url}`.substring(0, MAX_SCAN_SIZE);
  const headerData = Object.entries(req.headers)
    .filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase()))
    .map(([_, value]) => String(value))
    .join(' ')
    .substring(0, MAX_SCAN_SIZE);

  const scanData = urlData + ' ' + headerData;

  // Check for reconnaissance patterns (log only)
  for (const pattern of RECON_PATTERNS) {
    if (pattern.test(scanData)) {
      console.warn(`[SECURITY] Reconnaissance detected from ${identity}: ${pattern}`);
      break;
    }
  }

  // Check for malicious patterns (strike)
  for (const pattern of STRICT_PATTERNS) {
    if (pattern.test(scanData)) {
      console.error(`[SECURITY] Malicious pattern detected from ${identity}: ${pattern}`);
      await addStrike(identity, 1);
      res.status(400).json({ error: 'Invalid Request' });
      return;
    }
  }

  // For POST/PUT/PATCH requests, also scan body
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    let bodyData = '';

    // Capture request body
    req.on('data', (chunk) => {
      if (bodyData.length < MAX_SCAN_SIZE) {
        bodyData += chunk.toString();
      }
    });

    req.on('end', async () => {
      const contentType = req.headers['content-type'] || '';
      
      // Only scan non-JSON content for XSS patterns
      if (!contentType.includes('application/json')) {
        const bodyToScan = bodyData.substring(0, MAX_SCAN_SIZE);
        
        for (const pattern of STRICT_PATTERNS) {
          if (pattern.test(bodyToScan)) {
            console.error(`[SECURITY] Malicious pattern in body from ${identity}: ${pattern}`);
            await addStrike(identity, 1);
            res.status(400).json({ error: 'Invalid Content' });
            return;
          }
        }
      }
    });
  }

  next();
};

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // HSTS - Strict Transport Security
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  
  // Basic CSP - adjust based on your application needs
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Remove unsafe-inline/eval in production
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );

  next();
};

// Create security_strikes table if it doesn't exist
export const initializeSecurityTables = async (): Promise<void> => {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS security_strikes (
        id SERIAL PRIMARY KEY,
        identity VARCHAR(255) NOT NULL UNIQUE,
        strike_count INTEGER DEFAULT 0,
        block_until TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create index for faster lookups
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_security_strikes_identity_block 
      ON security_strikes(identity, block_until)
    `;
    
    console.log('✅ Security tables initialized');
  } catch (error) {
    console.error('Failed to initialize security tables:', error);
  }
};