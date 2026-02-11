import axios, { AxiosInstance, AxiosError } from 'axios';
import { getFuelPriceConfig, FuelPriceConfig } from '../config/fuelPrice.config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Fuel Price API Response Type
// CCFS API: GET Service/FuelInfo
// Returns: { Code, Effective, Index, Price, Rate }
// Rate is returned as decimal (0.3 = 30%)
interface FuelInfoResponse {
  Code?: string;
  Effective?: string;
  Index?: string;
  Price?: number;
  Rate?: number;
  // Fallback field names for other APIs
  FuelSurchargeRate?: number;
  fuelSurchargeRate?: number;
  rate?: number;
  Percentage?: number;
  percentage?: number;
  EffectiveDate?: string;
  effectiveDate?: string;
  Source?: string;
  source?: string;
  // Allow for additional fields we might not know about
  [key: string]: any;
}

export interface FuelPriceSyncResult {
  success: boolean;
  previousRate: number | null;
  newRate: number | null;
  source: string;
  effectiveDate: string;
  error?: string;
  syncedAt: Date;
}

class FuelPriceError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'FuelPriceError';
  }
}

export class FuelPriceService {
  private apiClient: AxiosInstance;
  private config: FuelPriceConfig;
  private lastSyncAt: Date | null = null;
  private lastSyncResult: FuelPriceSyncResult | null = null;

  constructor() {
    this.config = getFuelPriceConfig();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Add API key if configured
    if (this.config.apiKey) {
      headers['X-Api-Key'] = this.config.apiKey;
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    this.apiClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000,
      headers
    });

    this.apiClient.interceptors.response.use(
      response => response,
      this.handleAxiosError.bind(this)
    );
  }

  private async handleAxiosError(error: AxiosError) {
    if (error.response) {
      const { status, data } = error.response;
      let message = 'Fuel Price API request failed';

      if (status === 401) {
        message = 'Fuel Price API authentication failed. Check your API key.';
      } else if (status === 404) {
        message = 'Fuel Price API endpoint not found. Check your API URL.';
      } else if (data && typeof data === 'object' && 'error' in data) {
        message = (data as any).error;
      } else if (data && typeof data === 'object' && 'message' in data) {
        message = (data as any).message;
      }

      throw new FuelPriceError(status, message, data);
    } else if (error.request) {
      throw new FuelPriceError(0, 'No response from Fuel Price API', error.request);
    } else {
      throw new FuelPriceError(0, error.message);
    }
  }

  /**
   * Fetch current fuel info from the external API
   * CCFS API: GET Service/FuelInfo (no date parameter needed - returns current rate)
   */
  async fetchFuelInfo(_effectiveDate?: string): Promise<FuelInfoResponse> {
    console.log(`[FuelPrice] Fetching current fuel info from API`);

    const response = await this.apiClient.get<FuelInfoResponse>(`/Service/FuelInfo`);

    console.log('[FuelPrice] API Response:', JSON.stringify(response.data, null, 2));

    return response.data;
  }

  /**
   * Extract the fuel surcharge rate from the API response
   * Handles different possible field names in the response
   * CCFS API returns Rate as decimal (0.3 = 30%), converts to percentage
   */
  private extractRate(data: FuelInfoResponse): number | null {
    // Try different possible field names
    // Fields that return decimal values (0.3 = 30%) - need to multiply by 100
    const decimalFields = ['Rate', 'rate'];
    // Fields that already return percentage values (30 = 30%)
    const percentageFields = [
      'FuelSurchargeRate',
      'fuelSurchargeRate',
      'Percentage',
      'percentage',
      'FSCRate',
      'fscRate',
      'SurchargeRate',
      'surchargeRate'
    ];

    // First try decimal fields (CCFS API format)
    for (const field of decimalFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(String(data[field]));
        if (!isNaN(value)) {
          // Convert decimal to percentage (0.3 -> 30)
          const percentage = value <= 1 ? value * 100 : value;
          console.log(`[FuelPrice] Found rate in field '${field}': ${value} -> ${percentage}%`);
          return percentage;
        }
      }
    }

    // Then try percentage fields
    for (const field of percentageFields) {
      if (data[field] !== undefined && data[field] !== null) {
        const value = parseFloat(String(data[field]));
        if (!isNaN(value)) {
          console.log(`[FuelPrice] Found rate in field '${field}': ${value}%`);
          return value;
        }
      }
    }

    return null;
  }

  /**
   * Sync fuel surcharge rate from external API to system settings
   */
  async syncFuelSurcharge(effectiveDate?: string): Promise<FuelPriceSyncResult> {
    const date = effectiveDate || new Date().toISOString().split('T')[0];
    const result: FuelPriceSyncResult = {
      success: false,
      previousRate: null,
      newRate: null,
      source: 'fuel-price-api',
      effectiveDate: date,
      syncedAt: new Date()
    };

    try {
      // Get current settings
      const currentSettings = await prisma.systemSettings.findFirst({
        orderBy: { id: 'desc' }
      });

      if (currentSettings) {
        result.previousRate = currentSettings.fuelSurchargeRate?.toNumber() || null;
      }

      // Fetch fuel info from API
      const fuelInfo = await this.fetchFuelInfo(date);

      // Extract the rate from the response
      const newRate = this.extractRate(fuelInfo);

      if (newRate === null) {
        throw new FuelPriceError(
          400,
          'Could not extract fuel surcharge rate from API response',
          fuelInfo
        );
      }

      // Validate rate is within acceptable range (0-100%)
      if (newRate < 0 || newRate > 100) {
        throw new FuelPriceError(
          400,
          `Invalid fuel surcharge rate: ${newRate}. Must be between 0 and 100.`
        );
      }

      result.newRate = newRate;

      // Get effective date from response
      const effectiveDateFromApi = fuelInfo.Effective || fuelInfo.EffectiveDate ||
                                   fuelInfo.effectiveDate || date;
      result.effectiveDate = effectiveDateFromApi;

      // Determine the source identifier
      const sourceId = fuelInfo.Code || fuelInfo.Source || fuelInfo.source ||
                       effectiveDateFromApi || `fuel-api-${date}`;

      // Update system settings
      if (currentSettings) {
        await prisma.systemSettings.update({
          where: { id: currentSettings.id },
          data: {
            fuelSurchargeRate: newRate,
            fuelSurchargeSource: 'external',
            fuelSurchargeExternalId: String(sourceId)
          }
        });
      } else {
        await prisma.systemSettings.create({
          data: {
            fuelSurchargeRate: newRate,
            fuelSurchargeSource: 'external',
            fuelSurchargeExternalId: String(sourceId)
          }
        });
      }

      result.success = true;
      result.source = String(sourceId);

      console.log(`[FuelPrice] Sync complete: Rate updated from ${result.previousRate}% to ${result.newRate}%`);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.error = message;
      console.error(`[FuelPrice] Sync failed: ${message}`);

      if (error instanceof FuelPriceError && error.details) {
        console.error('[FuelPrice] Error details:', error.details);
      }
    }

    this.lastSyncAt = new Date();
    this.lastSyncResult = result;

    return result;
  }

  /**
   * Get the current fuel surcharge rate without syncing
   */
  async getCurrentRate(): Promise<{ rate: number; source: string; updatedAt: Date | null } | null> {
    const settings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (!settings) {
      return null;
    }

    return {
      rate: settings.fuelSurchargeRate?.toNumber() || 0,
      source: settings.fuelSurchargeSource || 'manual',
      updatedAt: settings.updatedAt
    };
  }

  /**
   * Get sync status information
   */
  getSyncStatus(): {
    lastSyncAt: Date | null;
    lastResult: FuelPriceSyncResult | null;
    configured: boolean;
  } {
    return {
      lastSyncAt: this.lastSyncAt,
      lastResult: this.lastSyncResult,
      configured: true
    };
  }
}

// Singleton instance
let fuelPriceServiceInstance: FuelPriceService | null = null;

export const getFuelPriceService = (): FuelPriceService => {
  if (!fuelPriceServiceInstance) {
    fuelPriceServiceInstance = new FuelPriceService();
  }
  return fuelPriceServiceInstance;
};
