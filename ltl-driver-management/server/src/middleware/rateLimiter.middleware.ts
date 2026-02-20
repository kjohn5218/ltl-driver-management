import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getClientIdentity, getClientIp } from '../utils/clientIp.utils';

// Custom key generator to handle authenticated vs unauthenticated users
// Uses trusted proxy validation per SECURITY_STANDARDS.md §7.2
const keyGenerator = (req: Request): string => {
  return getClientIdentity(req);
};

// Strict rate limiter for auth endpoints (login, register, password reset)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many authentication attempts, please try again later',
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime?.getTime() || Date.now() / 1000)
    });
  }
});

// Password reset rate limiter (even stricter)
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per minute
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many password reset attempts, please try again later',
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime?.getTime() || Date.now() / 1000)
    });
  }
});

// API rate limiter for authenticated users
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for authenticated users
  message: 'Too many API requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'API rate limit exceeded, please slow down',
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime?.getTime() || Date.now() / 1000)
    });
  }
});

// Public API rate limiter (stricter for unauthenticated requests)
export const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute for public endpoints
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `ip:${getClientIp(req)}`,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later',
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime?.getTime() || Date.now() / 1000)
    });
  }
});

// File upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 uploads per 5 minutes
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Upload rate limit exceeded, please try again later',
      retryAfter: Math.ceil((req as any).rateLimit?.resetTime?.getTime() || Date.now() / 1000)
    });
  }
});

// Create a rate limiter store that persists data
// In production, consider using Redis for distributed applications
export const createPersistentLimiter = (options: any) => {
  return rateLimit({
    ...options,
    // Use memory store by default, but can be replaced with Redis store
    // store: new RedisStore({ client: redisClient }) // for production
  });
};