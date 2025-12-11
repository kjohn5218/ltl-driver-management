import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Security event types
enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTHORIZATION_FAILURE = 'AUTHORIZATION_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  MALICIOUS_REQUEST = 'MALICIOUS_REQUEST',
  FILE_UPLOAD = 'FILE_UPLOAD',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED'
}

// Log entry structure
interface SecurityLogEntry {
  timestamp: string;
  requestId: string;
  eventType: SecurityEventType;
  userId?: number;
  userEmail?: string;
  ip: string;
  method: string;
  path: string;
  statusCode?: number;
  message: string;
  metadata?: Record<string, any>;
}

// Ensure log directory exists
const LOG_DIR = process.env.LOG_DIR || './logs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Get log file path for current date
const getLogFilePath = (): string => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(LOG_DIR, `security-${date}.log`);
};

// Write log entry
const writeLogEntry = (entry: SecurityLogEntry): void => {
  try {
    const logLine = JSON.stringify(entry) + '\n';
    const logPath = getLogFilePath();
    
    // Append to log file
    fs.appendFileSync(logPath, logLine, { flag: 'a' });
    
    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SECURITY] ${entry.eventType}: ${entry.message}`);
    }
    
    // TODO: In production, also send to centralized logging system
    // Example: await sendToElasticsearch(entry);
  } catch (error) {
    console.error('[LOGGING] Failed to write security log:', error);
  }
};

// Log security event
export const logSecurityEvent = (
  eventType: SecurityEventType,
  req: Request,
  message: string,
  metadata?: Record<string, any>
): void => {
  const entry: SecurityLogEntry = {
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] as string || 'unknown',
    eventType,
    userId: req.user?.id,
    userEmail: req.user?.email,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    method: req.method,
    path: req.path,
    message,
    metadata
  };
  
  writeLogEntry(entry);
};

// Request logging middleware
export const requestLogging = (req: Request, res: Response, next: NextFunction): void => {
  // Skip health check endpoint
  if (req.path === '/api/health') {
    return next();
  }

  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || crypto.randomBytes(16).toString('hex');
  
  // Add request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = requestId;
  }

  // Log request (excluding sensitive data)
  const requestLog = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id
  };

  // Don't log sensitive fields
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.token;
  delete sanitizedBody.creditCard;
  delete sanitizedBody.ssn;

  if (Object.keys(sanitizedBody).length > 0) {
    (requestLog as any).body = sanitizedBody;
  }

  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    res.send = originalSend;
    
    const responseTime = Date.now() - startTime;
    
    const responseLog = {
      timestamp: new Date().toISOString(),
      requestId,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`
    };

    // Log complete request/response cycle
    if (process.env.NODE_ENV !== 'production') {
      console.log('[REQUEST]', JSON.stringify(requestLog));
      console.log('[RESPONSE]', JSON.stringify(responseLog));
    }

    // Log security-relevant responses
    if (res.statusCode === 401) {
      logSecurityEvent(SecurityEventType.AUTH_FAILURE, req, 'Authentication failed');
    } else if (res.statusCode === 403) {
      logSecurityEvent(SecurityEventType.AUTHORIZATION_FAILURE, req, 'Authorization failed');
    } else if (res.statusCode === 429) {
      logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, 'Rate limit exceeded');
    }

    return originalSend.call(this, data);
  };

  next();
};

// Authentication event logging
export const logAuthEvent = (
  success: boolean,
  email: string,
  req: Request,
  reason?: string
): void => {
  logSecurityEvent(
    success ? SecurityEventType.LOGIN_SUCCESS : SecurityEventType.LOGIN_FAILURE,
    req,
    success ? `User ${email} logged in successfully` : `Login failed for ${email}: ${reason}`,
    { email, reason }
  );
};

// File upload logging
export const logFileUpload = (
  req: Request,
  filename: string,
  size: number,
  mimeType: string
): void => {
  logSecurityEvent(
    SecurityEventType.FILE_UPLOAD,
    req,
    `File uploaded: ${filename}`,
    { filename, size, mimeType }
  );
};

// Sensitive data access logging
export const logSensitiveDataAccess = (
  req: Request,
  dataType: string,
  resourceId: string | number
): void => {
  logSecurityEvent(
    SecurityEventType.SENSITIVE_DATA_ACCESS,
    req,
    `Accessed ${dataType} with ID ${resourceId}`,
    { dataType, resourceId }
  );
};

// Export security event types for use in other modules
export { SecurityEventType };