/**
 * TMS API Service
 *
 * HTTP client for communicating with external TMS (Transportation Management System).
 * Handles authentication, request/response, retries, and rate limiting.
 */

import { getTMSConfig, isTMSConfigured, TMSConfig } from '../config/tms.config';
import { log } from '../utils/logger';

// Response interfaces
export interface TMSApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface TMSShipment {
  proNumber: string;
  destTerminal: string;
  destTerminalSub?: string;
  scans: number;
  pieces: number;
  weight: number;
  consignee: {
    name: string;
    city: string;
    state: string;
  };
  shipper: {
    name: string;
    city: string;
    state: string;
  };
  expDeliveryDate: string;
  loadedTerminal: string;
  unloadedTerminal?: string;
  hazmat?: {
    unNumber: string;
    hazardClass: string;
    packingGroup?: string;
    shippingName: string;
    isBulk: boolean;
    isLimitedQty: boolean;
  };
}

export interface TMSManifest {
  manifestNumber: string;
  tripNumber?: string;
  originCode: string;
  destCode: string;
  driverName?: string;
  trailerNumber?: string;
  effort?: string;
  timeDue?: string;
  lastLoad?: string;
  dispatchedAt?: string;
  arrivedAt?: string;
  shipments: TMSShipment[];
}

export interface TMSLaneVolume {
  originTerminalCode: string;
  destinationTerminalCode: string;
  forecastDate: string;
  expectedShipmentCount: number;
  expectedPieces: number;
  expectedWeight: number;
  guaranteedCount: number;
  standardCount: number;
  expeditedCount: number;
  hazmatCount: number;
  estimatedTrailers: number;
}

// Rate limiting state
let requestCount = 0;
let windowStart = Date.now();

class TMSApiService {
  private config: TMSConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Initialize the service and get config
   */
  private getConfig(): TMSConfig {
    if (!this.config) {
      if (!isTMSConfigured()) {
        throw new Error('TMS API is not configured');
      }
      this.config = getTMSConfig();
    }
    return this.config;
  }

  /**
   * Check rate limit and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const config = this.getConfig();
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    // Reset window if expired
    if (now - windowStart >= windowMs) {
      requestCount = 0;
      windowStart = now;
    }

    // If at limit, wait for window to reset
    if (requestCount >= config.rateLimitPerMinute) {
      const waitTime = windowMs - (now - windowStart);
      log.warn('TMS', `Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      windowStart = Date.now();
    }

    requestCount++;
  }

  /**
   * Get authorization header based on auth type
   */
  private async getAuthHeader(): Promise<Record<string, string>> {
    const config = this.getConfig();

    switch (config.authType) {
      case 'api_key':
        return { 'X-API-Key': config.apiKey };

      case 'basic':
        if (!config.username || !config.password) {
          throw new Error('Basic auth requires username and password');
        }
        const basicAuth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        return { Authorization: `Basic ${basicAuth}` };

      case 'oauth2':
        const token = await this.getOAuthToken();
        return { Authorization: `Bearer ${token}` };

      default:
        return {};
    }
  }

  /**
   * Get OAuth2 access token (with caching)
   */
  private async getOAuthToken(): Promise<string> {
    const config = this.getConfig();

    // Return cached token if valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new token
    const tokenUrl = `${config.apiUrl}/oauth/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId || '',
      client_secret: config.apiKey,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`OAuth token request failed: ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    // Expire 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken as string;
  }

  /**
   * Make HTTP request with retries
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<TMSApiResponse<T>> {
    const config = this.getConfig();
    const url = `${config.apiUrl}${endpoint}`;

    await this.checkRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const authHeaders = await this.getAuthHeader();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          log.error('TMS', `Request failed: ${response.status}`, { url, errorText });

          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            return {
              success: false,
              error: errorText || `HTTP ${response.status}`,
              statusCode: response.status,
            };
          }

          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as T;
        return { success: true, data, statusCode: response.status };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn('TMS', `Request attempt ${attempt + 1} failed: ${lastError.message}`);

        if (attempt < config.maxRetries) {
          await new Promise(resolve =>
            setTimeout(resolve, config.retryDelayMs * (attempt + 1))
          );
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Request failed after retries',
    };
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string): Promise<TMSApiResponse<T>> {
    return this.request<T>('GET', endpoint);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body: Record<string, unknown>): Promise<TMSApiResponse<T>> {
    return this.request<T>('POST', endpoint, body);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body: Record<string, unknown>): Promise<TMSApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body);
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body: Record<string, unknown>): Promise<TMSApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body);
  }

  // ============================================
  // High-level TMS API Methods
  // ============================================

  /**
   * Get manifest/loadsheet data with shipments
   */
  async getManifest(manifestNumber: string): Promise<TMSApiResponse<TMSManifest>> {
    log.info('TMS', `Fetching manifest ${manifestNumber}`);
    return this.get<TMSManifest>(`/manifests/${manifestNumber}`);
  }

  /**
   * Get shipments for a manifest
   */
  async getManifestShipments(manifestNumber: string): Promise<TMSApiResponse<TMSShipment[]>> {
    log.info('TMS', `Fetching shipments for manifest ${manifestNumber}`);
    return this.get<TMSShipment[]>(`/manifests/${manifestNumber}/shipments`);
  }

  /**
   * Update scheduled departure date for a manifest
   */
  async updateScheduledDeparture(
    manifestNumber: string,
    newDate: string
  ): Promise<TMSApiResponse<{ updated: boolean }>> {
    log.info('TMS', `Updating scheduled departure for ${manifestNumber} to ${newDate}`);
    return this.put<{ updated: boolean }>(`/manifests/${manifestNumber}/scheduled-departure`, {
      scheduledDepartDate: newDate,
    });
  }

  /**
   * Update delivery dates for all shipments on a manifest
   */
  async updateDeliveryDates(
    manifestNumber: string,
    newDeliveryDate: string
  ): Promise<TMSApiResponse<{ updated: number }>> {
    log.info('TMS', `Updating delivery dates for ${manifestNumber} to ${newDeliveryDate}`);
    return this.put<{ updated: number }>(`/manifests/${manifestNumber}/shipments/delivery-dates`, {
      deliveryDate: newDeliveryDate,
    });
  }

  /**
   * Add delay note to all orders on a manifest
   */
  async addDelayNotes(
    manifestNumber: string,
    delayNote: string,
    reason: string
  ): Promise<TMSApiResponse<{ added: number }>> {
    log.info('TMS', `Adding delay notes to ${manifestNumber}`);
    return this.post<{ added: number }>(`/manifests/${manifestNumber}/orders/notes`, {
      note: delayNote,
      type: 'DELAY',
      reason,
    });
  }

  /**
   * Get expected lane volumes for planning
   */
  async getLaneVolumes(
    startDate: string,
    endDate: string,
    originTerminal?: string
  ): Promise<TMSApiResponse<TMSLaneVolume[]>> {
    log.info('TMS', `Fetching lane volumes from ${startDate} to ${endDate}`);
    let endpoint = `/forecasts/lane-volumes?startDate=${startDate}&endDate=${endDate}`;
    if (originTerminal) {
      endpoint += `&origin=${originTerminal}`;
    }
    return this.get<TMSLaneVolume[]>(endpoint);
  }

  /**
   * Get detailed expected shipments for a lane
   */
  async getLaneShipmentDetails(
    originTerminal: string,
    destTerminal: string,
    forecastDate: string
  ): Promise<TMSApiResponse<TMSShipment[]>> {
    log.info('TMS', `Fetching shipment details for ${originTerminal}-${destTerminal} on ${forecastDate}`);
    return this.get<TMSShipment[]>(
      `/forecasts/shipments?origin=${originTerminal}&dest=${destTerminal}&date=${forecastDate}`
    );
  }

  /**
   * Check TMS API health/connectivity
   */
  async healthCheck(): Promise<TMSApiResponse<{ status: string; version?: string }>> {
    return this.get<{ status: string; version?: string }>('/health');
  }
}

// Singleton instance
export const tmsApiService = new TMSApiService();
