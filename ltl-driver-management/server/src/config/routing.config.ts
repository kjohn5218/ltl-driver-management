/**
 * Routing API Configuration
 * Supports multiple providers for road-based distance and ETA calculations
 *
 * DEFAULT: OSRM (Open Source Routing Machine)
 * - Free, no API key required
 * - Uses public demo server by default
 * - Good for development and testing
 *
 * Supported providers:
 * - osrm: Open Source Routing Machine (DEFAULT - free, no API key)
 * - google: Google Maps Directions API (most accurate, paid)
 * - here: HERE Routing API (accurate, paid)
 * - none: Fallback to straight-line calculation
 */

export type RoutingProvider = 'google' | 'here' | 'osrm' | 'none';

export interface RoutingConfig {
  provider: RoutingProvider;
  apiKey: string;
  baseUrl: string;
  // Cache duration in minutes for route calculations
  cacheDurationMinutes: number;
  // Whether to use truck-specific routing (avoids low bridges, residential areas)
  useTruckRouting: boolean;
  // Timeout for API requests in milliseconds
  timeoutMs: number;
}

export interface GoogleRoutingConfig extends RoutingConfig {
  provider: 'google';
}

export interface HereRoutingConfig extends RoutingConfig {
  provider: 'here';
}

export interface OsrmRoutingConfig extends RoutingConfig {
  provider: 'osrm';
}

class RoutingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingConfigError';
  }
}

export const getRoutingConfig = (): RoutingConfig => {
  const provider = (process.env.ROUTING_PROVIDER || 'none').toLowerCase() as RoutingProvider;
  const cacheDuration = parseInt(process.env.ROUTING_CACHE_MINUTES || '30', 10);
  const timeout = parseInt(process.env.ROUTING_TIMEOUT_MS || '10000', 10);

  const baseConfig = {
    cacheDurationMinutes: isNaN(cacheDuration) || cacheDuration < 1 ? 30 : cacheDuration,
    useTruckRouting: process.env.ROUTING_USE_TRUCK === 'true',
    timeoutMs: isNaN(timeout) || timeout < 1000 ? 10000 : timeout
  };

  switch (provider) {
    case 'google':
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || '';
      if (!googleApiKey) {
        throw new RoutingConfigError(
          'ROUTING_PROVIDER is set to "google" but GOOGLE_MAPS_API_KEY is not configured'
        );
      }
      return {
        ...baseConfig,
        provider: 'google',
        apiKey: googleApiKey,
        baseUrl: 'https://maps.googleapis.com/maps/api/directions/json'
      };

    case 'here':
      const hereApiKey = process.env.HERE_API_KEY || '';
      if (!hereApiKey) {
        throw new RoutingConfigError(
          'ROUTING_PROVIDER is set to "here" but HERE_API_KEY is not configured'
        );
      }
      return {
        ...baseConfig,
        provider: 'here',
        apiKey: hereApiKey,
        baseUrl: 'https://router.hereapi.com/v8/routes'
      };

    case 'osrm':
      return {
        ...baseConfig,
        provider: 'osrm',
        apiKey: '', // OSRM doesn't require an API key
        baseUrl: process.env.OSRM_API_URL || 'https://router.project-osrm.org'
      };

    case 'none':
    default:
      return {
        ...baseConfig,
        provider: 'none',
        apiKey: '',
        baseUrl: ''
      };
  }
};

export const isRoutingConfigured = (): boolean => {
  try {
    const config = getRoutingConfig();
    return config.provider !== 'none';
  } catch {
    return false;
  }
};

export const getRoutingProvider = (): RoutingProvider => {
  try {
    return getRoutingConfig().provider;
  } catch {
    return 'none';
  }
};
