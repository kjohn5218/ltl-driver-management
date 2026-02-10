/**
 * Motive (formerly KeepTruckin) API Configuration
 * GPS tracking and vehicle location data
 */

export interface MotiveConfig {
  apiKey: string;
  baseUrl: string;
}

class MotiveConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MotiveConfigError';
  }
}

export const getMotiveConfig = (): MotiveConfig => {
  const config: MotiveConfig = {
    apiKey: process.env.MOTIVE_API_KEY || '',
    baseUrl: process.env.MOTIVE_API_URL || 'https://api.gomotive.com/v1'
  };

  if (!config.apiKey) {
    throw new MotiveConfigError(
      'Missing required Motive API configuration: apiKey. ' +
      'Please set MOTIVE_API_KEY in your .env file.'
    );
  }

  return config;
};

export const isMotiveConfigured = (): boolean => {
  try {
    getMotiveConfig();
    return true;
  } catch (error) {
    return false;
  }
};
