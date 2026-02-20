import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getClientIdentity } from '../utils/clientIp.utils';

const prisma = new PrismaClient();
const MAX_SCAN_SIZE = 4096; // 4KB max scan size to prevent ReDoS

// Type definitions
interface StrikeCacheEntry {
  blocked: boolean;
  expiresAt: number;
}

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
const strikeCache = new Map<string, StrikeCacheEntry>();

// Note: getClientIdentity is imported from ../utils/clientIp.utils
// It handles trusted proxy validation per SECURITY_STANDARDS.md §7.2

// Track if we've already logged a storage failure (prevent log spam)
let storageFailureLogged = false;
let lastStorageFailureTime = 0;
const STORAGE_FAILURE_LOG_INTERVAL = 60000; // Log at most every 60 seconds

// CRITICAL alert helper - per SECURITY_STANDARDS.md §2.2
const logCriticalStorageFailure = (operation: string, identity: string, error: unknown): void => {
  const now = Date.now();
  if (!storageFailureLogged || (now - lastStorageFailureTime) > STORAGE_FAILURE_LOG_INTERVAL) {
    // P1 FIX: Log CRITICAL alert when storage is unreachable (per §2.2 Fail-Open with Alerting)
    console.error(`[CRITICAL] Security storage unreachable during ${operation} for ${identity}:`, error);
    console.error('[CRITICAL] Strike enforcement is disabled (fail-open). Investigate immediately!');
    // TODO: Send alert to monitoring system (PagerDuty, Slack, etc.)
    // alertService.sendCritical(`Security storage unreachable: ${operation}`);
    storageFailureLogged = true;
    lastStorageFailureTime = now;
  }
};

// Check if identity is blocked - using Prisma ORM instead of raw SQL
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

  // Check database using Prisma ORM (type-safe)
  try {
    const strike = await prisma.securityStrike.findFirst({
      where: {
        identity,
        blockUntil: {
          gt: new Date()
        }
      },
      select: {
        blockUntil: true
      }
    });

    const blocked = strike !== null;

    // Cache the result for 60 seconds
    strikeCache.set(identity, {
      blocked,
      expiresAt: Date.now() + 60000
    });

    // Reset failure tracking on successful DB access
    storageFailureLogged = false;

    return blocked;
  } catch (error) {
    // P1 FIX: Fire CRITICAL alert on storage failure (per §2.2)
    logCriticalStorageFailure('check_strikes', identity, error);
    return false; // Fail open - but with alerting
  }
};

// Add strike to identity - using Prisma ORM instead of raw SQL
const addStrike = async (identity: string, severity: number = 1): Promise<void> => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Use Prisma upsert for atomic create-or-update (type-safe)
    const existing = await prisma.securityStrike.findUnique({
      where: { identity }
    });

    let newCount: number;
    let blockUntil: Date | null = null;

    if (existing) {
      // Reset strikes if last update was more than 1 hour ago (decay per §2.2)
      newCount = existing.updatedAt < oneHourAgo ? severity : existing.strikeCount + severity;
    } else {
      newCount = severity;
    }

    // Determine block duration based on strike count (per §2.2)
    if (newCount >= 10) {
      // 30 days ban
      blockUntil = new Date(now.getTime() + 30 * 24 * 3600000);
    } else if (newCount >= 3) {
      // 1 hour block
      blockUntil = new Date(now.getTime() + 3600000);
    }

    // Upsert the strike record
    await prisma.securityStrike.upsert({
      where: { identity },
      update: {
        strikeCount: newCount,
        blockUntil,
        updatedAt: now
      },
      create: {
        identity,
        strikeCount: severity,
        blockUntil: null
      }
    });

    // Update cache if blocked
    if (blockUntil) {
      strikeCache.set(identity, {
        blocked: true,
        expiresAt: blockUntil.getTime()
      });
    }

    // Reset failure tracking on successful DB access
    storageFailureLogged = false;
  } catch (error) {
    // P1 FIX: Fire CRITICAL alert on storage failure (per §2.2)
    logCriticalStorageFailure('add_strike', identity, error);
    // Fail open - but with alerting
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
  // P1 FIX: Body is already parsed by express.json() middleware
  // The previous code had a race condition where next() was called before body scanning completed
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';

    // Only scan non-JSON content for XSS patterns (per §2.2 note: JSON XSS is client-side)
    if (!contentType.includes('application/json')) {
      let bodyToScan = '';

      // Get body data - express.json() may have already parsed it
      if (req.body) {
        // Body was parsed by express middleware
        bodyToScan = typeof req.body === 'string'
          ? req.body.substring(0, MAX_SCAN_SIZE)
          : JSON.stringify(req.body).substring(0, MAX_SCAN_SIZE);
      }

      // Scan body for malicious patterns
      for (const pattern of STRICT_PATTERNS) {
        if (pattern.test(bodyToScan)) {
          console.error(`[SECURITY] Malicious pattern in body from ${identity}: ${pattern}`);
          await addStrike(identity, 1);
          res.status(400).json({ error: 'Invalid Content' });
          return;
        }
      }
    }
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

  // Content Security Policy - P0 SECURITY FIX
  // Per SECURITY_STANDARDS.md §2.4: unsafe-inline is FORBIDDEN for scripts
  // Note: If frontend breaks, add specific script hashes instead of unsafe-inline
  const isProduction = process.env.NODE_ENV === 'production';
  const connectSrc = isProduction
    ? "'self'"
    : "'self' ws://localhost:* http://localhost:*"; // Allow HMR in development

  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " + // P0 FIX: Removed unsafe-inline and unsafe-eval
    "style-src 'self' 'unsafe-inline'; " + // Styles: unsafe-inline acceptable per §2.4 note
    "img-src 'self' data: https:; " +
    "font-src 'self' https:; " +
    `connect-src ${connectSrc}; ` +
    "frame-src 'none'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "upgrade-insecure-requests;"
  );

  next();
};

// Verify security tables are available (managed by Prisma migrations)
export const initializeSecurityTables = async (): Promise<void> => {
  try {
    // Verify the SecurityStrike model is accessible via Prisma
    // This will throw if the table doesn't exist (migration not run)
    await prisma.securityStrike.count();
    console.log('✅ Security tables verified');
  } catch (error) {
    // Table doesn't exist - migrations may not have been run
    console.error('❌ Security tables not found. Run: npx prisma migrate dev');
    console.error('   Error:', error instanceof Error ? error.message : error);
    // Don't throw - allow server to start but security features will fail-open
  }
};