/**
 * Drivers API Configuration
 * External API for syncing driver data
 */

export interface DriversApiConfig {
  baseUrl: string;
  username: string;
  password: string;
  carrierCode: string;
}

class DriversApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriversApiConfigError';
  }
}

export const getDriversApiConfig = (): DriversApiConfig => {
  const config: DriversApiConfig = {
    baseUrl: process.env.DRIVERS_API_URL || '',
    username: process.env.DRIVERS_API_USERNAME || '',
    password: process.env.DRIVERS_API_PASSWORD || '',
    carrierCode: process.env.DRIVERS_API_CARRIER_CODE || 'CCYQ'
  };

  const requiredFields: (keyof DriversApiConfig)[] = ['baseUrl', 'username', 'password'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new DriversApiConfigError(
      `Missing required Drivers API configuration: ${missingFields.join(', ')}. ` +
      `Please check your .env file.`
    );
  }

  return config;
};

export const isDriversApiConfigured = (): boolean => {
  try {
    getDriversApiConfig();
    return true;
  } catch (error) {
    return false;
  }
};

export const logDriversApiConfigStatus = (): void => {
  console.log('Drivers API Configuration Status:');
  console.log('- Base URL:', process.env.DRIVERS_API_URL || 'Not set');
  console.log('- Username:', process.env.DRIVERS_API_USERNAME ? '✓ Set' : '✗ Not set');
  console.log('- Password:', process.env.DRIVERS_API_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('- Carrier Code:', process.env.DRIVERS_API_CARRIER_CODE || 'CCYQ (default)');
  console.log('- Configuration valid:', isDriversApiConfigured() ? '✓ Yes' : '✗ No');
};
