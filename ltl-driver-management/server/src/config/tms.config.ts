/**
 * TMS (Transportation Management System) Configuration
 *
 * Configures connection to external TMS API for:
 * - Fetching shipment data and trip manifests
 * - Updating delivery dates and scheduled departures
 * - Adding delay notes to orders
 * - Getting expected shipment volumes/forecasts
 */

export interface TMSConfig {
  apiUrl: string;
  apiKey: string;
  username?: string;
  password?: string;
  clientId?: string;
  // Authentication type: 'api_key', 'basic', 'oauth2'
  authType: 'api_key' | 'basic' | 'oauth2';
  // Request timeout in milliseconds
  timeoutMs: number;
  // Rate limit: requests per minute
  rateLimitPerMinute: number;
  // Retry configuration
  maxRetries: number;
  retryDelayMs: number;
}

let tmsConfig: TMSConfig | null = null;

/**
 * Check if TMS API is configured
 */
export function isTMSConfigured(): boolean {
  const apiUrl = process.env.TMS_API_URL;
  const apiKey = process.env.TMS_API_KEY;
  const username = process.env.TMS_USERNAME;
  const password = process.env.TMS_PASSWORD;

  // Must have URL and at least one auth method
  if (!apiUrl) return false;

  const hasApiKey = !!apiKey;
  const hasBasicAuth = !!username && !!password;

  return hasApiKey || hasBasicAuth;
}

/**
 * Get TMS configuration
 */
export function getTMSConfig(): TMSConfig {
  if (!tmsConfig) {
    const apiUrl = process.env.TMS_API_URL || '';
    const apiKey = process.env.TMS_API_KEY || '';
    const username = process.env.TMS_USERNAME;
    const password = process.env.TMS_PASSWORD;
    const clientId = process.env.TMS_CLIENT_ID;

    // Determine auth type
    let authType: 'api_key' | 'basic' | 'oauth2' = 'api_key';
    if (process.env.TMS_AUTH_TYPE) {
      authType = process.env.TMS_AUTH_TYPE as 'api_key' | 'basic' | 'oauth2';
    } else if (username && password && !apiKey) {
      authType = 'basic';
    }

    tmsConfig = {
      apiUrl,
      apiKey,
      username,
      password,
      clientId,
      authType,
      timeoutMs: parseInt(process.env.TMS_TIMEOUT_MS || '30000', 10),
      rateLimitPerMinute: parseInt(process.env.TMS_RATE_LIMIT || '60', 10),
      maxRetries: parseInt(process.env.TMS_MAX_RETRIES || '3', 10),
      retryDelayMs: parseInt(process.env.TMS_RETRY_DELAY_MS || '1000', 10),
    };
  }

  return tmsConfig;
}

/**
 * Reset config (for testing)
 */
export function resetTMSConfig(): void {
  tmsConfig = null;
}
