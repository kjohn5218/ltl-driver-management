/**
 * Environment Configuration and Validation
 * Centralizes environment variable validation and provides type-safe access
 */

import { log } from '../utils/logger';

// URL validation regex
const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

interface EnvConfig {
  // Required
  jwtSecret: string;
  databaseUrl: string;

  // URLs with fallbacks
  frontendUrl: string;
  clientBaseUrl: string;
  allowedOrigins: string[];

  // Optional integrations
  fuelPriceApiKey?: string;
  fuelPriceApiUrl?: string;

  // Runtime
  nodeEnv: string;
  port: number;
  isProduction: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a URL format
 */
const isValidUrl = (url: string): boolean => {
  return URL_PATTERN.test(url);
};

/**
 * Validates all environment variables and returns typed configuration
 */
export const validateEnv = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Required variables
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be set and at least 32 characters long');
  }

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL must be set');
  }

  // URL validations
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    if (!isValidUrl(frontendUrl)) {
      errors.push(`FRONTEND_URL is not a valid URL: ${frontendUrl}`);
    }
  } else if (isProduction) {
    warnings.push('FRONTEND_URL not set - using fallback. Set this in production.');
  }

  const clientBaseUrl = process.env.CLIENT_BASE_URL;
  if (clientBaseUrl) {
    if (!isValidUrl(clientBaseUrl)) {
      errors.push(`CLIENT_BASE_URL is not a valid URL: ${clientBaseUrl}`);
    }
  } else if (isProduction) {
    warnings.push('CLIENT_BASE_URL not set - using fallback. Set this in production.');
  }

  // Allowed origins validation
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    const origins = allowedOrigins.split(',').map(o => o.trim());
    for (const origin of origins) {
      if (origin && !isValidUrl(origin)) {
        errors.push(`Invalid URL in ALLOWED_ORIGINS: ${origin}`);
      }
    }
  } else if (isProduction) {
    warnings.push('ALLOWED_ORIGINS not set - using fallback. Set this in production.');
  }

  // Optional API keys - validate format if provided
  const fuelPriceApiKey = process.env.FUEL_PRICE_API_KEY;
  if (fuelPriceApiKey !== undefined && fuelPriceApiKey.trim() === '') {
    warnings.push('FUEL_PRICE_API_KEY is set but empty - fuel price sync may fail');
  }

  const fuelPriceApiUrl = process.env.FUEL_PRICE_API_URL;
  if (fuelPriceApiUrl && !isValidUrl(fuelPriceApiUrl)) {
    errors.push(`FUEL_PRICE_API_URL is not a valid URL: ${fuelPriceApiUrl}`);
  }

  // Port validation
  const port = process.env.PORT;
  if (port) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push(`PORT must be a valid port number (1-65535): ${port}`);
    }
  }

  // Trusted proxies validation (CIDR format)
  const trustedProxies = process.env.TRUSTED_PROXIES;
  if (trustedProxies) {
    const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const proxies = trustedProxies.split(',').map(p => p.trim());
    for (const proxy of proxies) {
      if (proxy && !cidrPattern.test(proxy)) {
        warnings.push(`TRUSTED_PROXIES contains invalid CIDR format: ${proxy}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Gets validated environment configuration
 * Throws if required variables are missing
 */
export const getEnvConfig = (): EnvConfig => {
  const validation = validateEnv();

  if (!validation.valid) {
    throw new Error(`Environment validation failed:\n  - ${validation.errors.join('\n  - ')}`);
  }

  return {
    jwtSecret: process.env.JWT_SECRET!,
    databaseUrl: process.env.DATABASE_URL!,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:5174',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim()),
    fuelPriceApiKey: process.env.FUEL_PRICE_API_KEY || undefined,
    fuelPriceApiUrl: process.env.FUEL_PRICE_API_URL || undefined,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    isProduction: process.env.NODE_ENV === 'production'
  };
};

/**
 * Validates environment and logs results
 * Call this at application startup
 */
export const validateAndLogEnv = (): boolean => {
  const validation = validateEnv();
  const isProduction = process.env.NODE_ENV === 'production';

  // Log errors
  for (const error of validation.errors) {
    log.error('CONFIG', `Environment validation error: ${error}`);
  }

  // Log warnings
  for (const warning of validation.warnings) {
    log.warn('CONFIG', `Environment warning: ${warning}`);
  }

  if (validation.valid) {
    log.lifecycle('Environment validation passed', {
      env: process.env.NODE_ENV || 'development',
      warningCount: validation.warnings.length
    });

    // Log configured integrations (without sensitive values)
    if (!isProduction) {
      const config = getEnvConfig();
      log.debug('CONFIG', 'Environment configuration loaded', {
        frontendUrl: config.frontendUrl,
        clientBaseUrl: config.clientBaseUrl,
        fuelPriceApiConfigured: !!config.fuelPriceApiKey,
        allowedOriginsCount: config.allowedOrigins.length
      });
    }
  }

  return validation.valid;
};

/**
 * Helper to get a URL with fallback and validation
 */
export const getValidatedUrl = (envVar: string, fallback: string, name: string): string => {
  const value = process.env[envVar];

  if (value) {
    if (!isValidUrl(value)) {
      log.warn('CONFIG', `Invalid URL format for ${name}, using fallback`, { envVar, value, fallback });
      return fallback;
    }
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    log.warn('CONFIG', `${name} not configured, using fallback`, { envVar, fallback });
  }

  return fallback;
};

export default {
  validate: validateEnv,
  getConfig: getEnvConfig,
  validateAndLog: validateAndLogEnv,
  getValidatedUrl
};
