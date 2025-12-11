import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

interface TokenPayload {
  userId: number;
  email: string;
  role: UserRole;
}

interface RefreshTokenPayload {
  userId: number;
  tokenFamily: string;
  version: number;
}

// Token configuration
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes as per security standards
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // 7 days for refresh token

// Get JWT secret with validation
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.length < 32) {
    throw new Error('[SECURITY] JWT_SECRET must be configured and at least 32 characters long');
  }
  
  return secret;
};

// Generate access token (short-lived)
export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = getJwtSecret();
  
  return jwt.sign(payload, secret, { 
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'ltl-driver-management',
    audience: process.env.JWT_AUDIENCE || 'ltl-driver-management-api'
  });
};

// Generate refresh token (long-lived)
export const generateRefreshToken = (userId: number): { token: string; family: string } => {
  const secret = getJwtSecret();
  const tokenFamily = crypto.randomBytes(16).toString('hex');
  
  const payload: RefreshTokenPayload = {
    userId,
    tokenFamily,
    version: 1
  };
  
  const token = jwt.sign(payload, secret, { 
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'ltl-driver-management'
  });
  
  return { token, family: tokenFamily };
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload => {
  const secret = getJwtSecret();
  
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: process.env.JWT_ISSUER || 'ltl-driver-management',
    audience: process.env.JWT_AUDIENCE || 'ltl-driver-management-api'
  }) as TokenPayload;
};

// Verify refresh token
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = getJwtSecret();
  
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: process.env.JWT_ISSUER || 'ltl-driver-management'
  }) as RefreshTokenPayload;
};

// Legacy functions for backward compatibility - mark as deprecated
/**
 * @deprecated Use generateAccessToken instead
 */
export const generateToken = generateAccessToken;

/**
 * @deprecated Use verifyAccessToken instead
 */
export const verifyToken = verifyAccessToken;