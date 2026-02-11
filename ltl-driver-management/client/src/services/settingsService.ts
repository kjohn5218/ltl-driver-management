import { api } from './api';

// Types for Settings
export interface SystemSettings {
  id: number;
  fuelSurchargeRate: number;
  fuelSurchargeSource: string;
  fuelSurchargeExternalId?: string;
  updatedAt: string;
  updatedBy?: number;
}

export interface FuelSurchargeSyncResult {
  success: boolean;
  previousRate?: number | null;
  newRate?: number | null;
  source?: string;
  effectiveDate?: string;
  syncedAt?: string;
  message?: string;
}

export interface FuelPriceSyncStatus {
  configured: boolean;
  message?: string;
  currentRate?: number;
  source?: string;
  lastUpdated?: string;
  lastSyncAt?: string;
  lastSyncResult?: FuelSurchargeSyncResult;
}

// Settings Service
export const settingsService = {
  // Get system settings
  getSettings: async (): Promise<SystemSettings> => {
    const response = await api.get('/settings');
    return response.data;
  },

  // Update fuel surcharge rate manually
  updateFuelSurchargeRate: async (rate: number): Promise<SystemSettings> => {
    const response = await api.put('/settings/fuel-surcharge', {
      fuelSurchargeRate: rate
    });
    return response.data;
  },

  // Sync fuel surcharge from external API
  syncFuelSurcharge: async (effectiveDate?: string): Promise<FuelSurchargeSyncResult> => {
    const params = new URLSearchParams();
    if (effectiveDate) {
      params.append('effectiveDate', effectiveDate);
    }

    const url = params.toString()
      ? `/settings/fuel-surcharge/sync?${params.toString()}`
      : '/settings/fuel-surcharge/sync';

    const response = await api.post(url);
    return response.data;
  },

  // Get fuel price sync status
  getFuelPriceSyncStatus: async (): Promise<FuelPriceSyncStatus> => {
    const response = await api.get('/settings/fuel-surcharge/status');
    return response.data;
  }
};
