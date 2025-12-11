import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Store CSRF tokens in memory (consider Redis for production)
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();

// Generate CSRF token
const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Get or create CSRF token for session
const getOrCreateToken = (sessionId: string): string => {
  const existing = csrfTokenStore.get(sessionId);
  
  if (existing && existing.expiresAt > Date.now()) {
    return existing.token;
  }
  
  const token = generateCsrfToken();
  const expiresAt = Date.now() + 3600000; // 1 hour
  
  csrfTokenStore.set(sessionId, { token, expiresAt });
  
  // Clean up expired tokens periodically
  if (csrfTokenStore.size > 10000) {
    const now = Date.now();
    for (const [key, value] of csrfTokenStore.entries()) {
      if (value.expiresAt < now) {
        csrfTokenStore.delete(key);
      }
    }
  }
  
  return token;
};

// CSRF token validation middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for public endpoints that don't require CSRF
  const publicEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/health',
    '/api/bookings/confirmation',
    '/api/documents/upload'
  ];
  
  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  // Get session identifier
  const sessionId = req.user?.id ? `user:${req.user.id}` : 
                   req.sessionID || req.ip || 'anonymous';

  // Check for CSRF token in headers or body
  const providedToken = req.headers['x-csrf-token'] as string || 
                       req.body?._csrf || 
                       req.query?._csrf as string;

  if (!providedToken) {
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  // Validate token
  const storedData = csrfTokenStore.get(sessionId);
  
  if (!storedData || storedData.token !== providedToken || storedData.expiresAt < Date.now()) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
};

// Middleware to generate and attach CSRF token
export const csrfToken = (req: Request, res: Response, next: NextFunction): void => {
  // Get session identifier
  const sessionId = req.user?.id ? `user:${req.user.id}` : 
                   req.sessionID || req.ip || 'anonymous';

  // Generate or retrieve token
  const token = getOrCreateToken(sessionId);

  // Attach token to response locals
  res.locals.csrfToken = token;

  // Add token to response header for API clients
  res.setHeader('X-CSRF-Token', token);

  next();
};

// Double submit cookie pattern for additional security
export const csrfCookie = (req: Request, res: Response, next: NextFunction): void => {
  const token = res.locals.csrfToken || getOrCreateToken(req.ip || 'anonymous');
  
  // Set CSRF cookie
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Allow JavaScript to read for inclusion in headers
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 3600000 // 1 hour
  });

  next();
};