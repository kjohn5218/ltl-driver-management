/**
 * FormsApp Fleet API Configuration
 */

export interface FormsAppConfig {
  apiKey: string;
  apiUrl: string;
  syncIntervalMinutes: number;
}

class FormsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormsAppConfigError';
  }
}

export const getFormsAppConfig = (): FormsAppConfig => {
  const config: FormsAppConfig = {
    apiKey: process.env.FORMSAPP_API_KEY || '',
    apiUrl: process.env.FORMSAPP_API_URL || '',
    syncIntervalMinutes: parseInt(process.env.FORMSAPP_SYNC_INTERVAL_MINUTES || '60', 10)
  };

  // Validate required fields
  const requiredFields: (keyof FormsAppConfig)[] = ['apiKey', 'apiUrl'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new FormsAppConfigError(
      `Missing required FormsApp configuration: ${missingFields.join(', ')}. ` +
      `Please check your .env file and ensure FORMSAPP_API_KEY and FORMSAPP_API_URL are set.`
    );
  }

  return config;
};

// Check if FormsApp is configured (doesn't throw, just returns boolean)
export const isFormsAppConfigured = (): boolean => {
  try {
    getFormsAppConfig();
    return true;
  } catch (error) {
    return false;
  }
};

// Log configuration status (for debugging)
export const logFormsAppConfigStatus = (): void => {
  console.log('FormsApp Fleet API Configuration Status:');
  console.log('- API URL:', process.env.FORMSAPP_API_URL || 'Not set');
  console.log('- API Key:', process.env.FORMSAPP_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('- Sync Interval:', process.env.FORMSAPP_SYNC_INTERVAL_MINUTES || '60', 'minutes');
  console.log('- Configuration valid:', isFormsAppConfigured() ? '✓ Yes' : '✗ No');
};
