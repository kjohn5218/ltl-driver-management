/**
 * Fuel Price API Configuration
 * Fetches fuel surcharge rates from external fuel price service
 */

export interface FuelPriceConfig {
  apiUrl: string;
  apiKey?: string;
  syncIntervalMinutes: number;
}

class FuelPriceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FuelPriceConfigError';
  }
}

export const getFuelPriceConfig = (): FuelPriceConfig => {
  const config: FuelPriceConfig = {
    apiUrl: process.env.FUEL_PRICE_API_URL || '',
    apiKey: process.env.FUEL_PRICE_API_KEY || undefined,
    syncIntervalMinutes: parseInt(process.env.FUEL_PRICE_SYNC_INTERVAL_MINUTES || '60', 10)
  };

  if (!config.apiUrl) {
    throw new FuelPriceConfigError(
      'Missing required Fuel Price API configuration: apiUrl. ' +
      'Please set FUEL_PRICE_API_URL in your .env file.'
    );
  }

  return config;
};

export const isFuelPriceConfigured = (): boolean => {
  try {
    getFuelPriceConfig();
    return true;
  } catch (error) {
    return false;
  }
};

export const logFuelPriceConfigStatus = (): void => {
  if (isFuelPriceConfigured()) {
    const config = getFuelPriceConfig();
    console.log('[FuelPrice] Configuration loaded:');
    console.log(`  - API URL: ${config.apiUrl}`);
    console.log(`  - API Key: ${config.apiKey ? '***configured***' : 'not set'}`);
    console.log(`  - Sync Interval: ${config.syncIntervalMinutes} minutes`);
  } else {
    console.log('[FuelPrice] Not configured - fuel price sync disabled');
  }
};
