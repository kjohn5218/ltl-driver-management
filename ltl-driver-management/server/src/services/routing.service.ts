/**
 * Routing Service
 * Provides road-based distance and travel time calculations using various providers
 */

import { getRoutingConfig, isRoutingConfigured, RoutingProvider } from '../config/routing.config';
import { log } from '../utils/logger';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMiles: number;
  durationMinutes: number;
  durationInTraffic?: number; // Duration considering current traffic (if available)
  provider: RoutingProvider;
  cached: boolean;
  polyline?: string; // Encoded polyline for route visualization
}

export interface RouteError {
  error: true;
  message: string;
  fallbackUsed: boolean;
  fallbackResult?: RouteResult;
}

// Simple in-memory cache for route calculations
interface CacheEntry {
  result: RouteResult;
  expiresAt: number;
}

class RouteCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize = 1000;

  private generateKey(origin: Coordinates, destination: Coordinates): string {
    // Round to 4 decimal places (~11m precision) for cache key
    const oLat = origin.latitude.toFixed(4);
    const oLon = origin.longitude.toFixed(4);
    const dLat = destination.latitude.toFixed(4);
    const dLon = destination.longitude.toFixed(4);
    return `${oLat},${oLon}:${dLat},${dLon}`;
  }

  get(origin: Coordinates, destination: Coordinates): RouteResult | null {
    const key = this.generateKey(origin, destination);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry.result, cached: true };
  }

  set(origin: Coordinates, destination: Coordinates, result: RouteResult, ttlMinutes: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const key = this.generateKey(origin, destination);
    this.cache.set(key, {
      result: { ...result, cached: false },
      expiresAt: Date.now() + ttlMinutes * 60 * 1000
    });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

class RoutingService {
  private cache: RouteCache;

  constructor() {
    this.cache = new RouteCache();
  }

  /**
   * Calculate route between two points
   * Returns road distance and estimated travel time
   */
  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    options: { useCache?: boolean; departureTime?: Date } = {}
  ): Promise<RouteResult | RouteError> {
    const { useCache = true, departureTime } = options;

    // Check cache first
    if (useCache) {
      const cached = this.cache.get(origin, destination);
      if (cached) {
        log.debug('ROUTING', 'Cache hit', {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`
        });
        return cached;
      }
    }

    // Check if routing is configured
    if (!isRoutingConfigured()) {
      return this.calculateFallback(origin, destination);
    }

    const config = getRoutingConfig();

    try {
      let result: RouteResult;

      switch (config.provider) {
        case 'google':
          result = await this.calculateGoogleRoute(origin, destination, departureTime);
          break;
        case 'here':
          result = await this.calculateHereRoute(origin, destination, departureTime);
          break;
        case 'osrm':
          result = await this.calculateOsrmRoute(origin, destination);
          break;
        default:
          return this.calculateFallback(origin, destination);
      }

      // Cache the result
      this.cache.set(origin, destination, result, config.cacheDurationMinutes);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.warn('ROUTING', `${config.provider} routing failed, using fallback`, { error: message });

      // Return fallback with error indication
      const fallback = this.calculateFallback(origin, destination);
      return {
        error: true,
        message: `Routing API error: ${message}`,
        fallbackUsed: true,
        fallbackResult: fallback
      };
    }
  }

  /**
   * Google Maps Directions API
   */
  private async calculateGoogleRoute(
    origin: Coordinates,
    destination: Coordinates,
    departureTime?: Date
  ): Promise<RouteResult> {
    const config = getRoutingConfig();

    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      key: config.apiKey,
      mode: 'driving',
      units: 'imperial'
    });

    // Add departure time for traffic-based estimates
    if (departureTime) {
      params.append('departure_time', Math.floor(departureTime.getTime() / 1000).toString());
    }

    // Use truck routing if configured (requires additional API setup)
    if (config.useTruckRouting) {
      params.append('avoid', 'ferries');
    }

    const response = await fetch(`${config.baseUrl}?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Google Maps API returned ${response.status}`);
    }

    const data = await response.json() as {
      status: string;
      routes?: Array<{
        legs: Array<{
          distance: { value: number }; // meters
          duration: { value: number }; // seconds
          duration_in_traffic?: { value: number };
        }>;
        overview_polyline?: { points: string };
      }>;
      error_message?: string;
    };

    if (data.status !== 'OK' || !data.routes?.[0]) {
      throw new Error(data.error_message || `Google Maps API status: ${data.status}`);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Convert meters to miles and seconds to minutes
    const distanceMiles = leg.distance.value / 1609.34;
    const durationMinutes = leg.duration.value / 60;
    const durationInTraffic = leg.duration_in_traffic
      ? leg.duration_in_traffic.value / 60
      : undefined;

    return {
      distanceMiles,
      durationMinutes,
      durationInTraffic,
      provider: 'google',
      cached: false,
      polyline: route.overview_polyline?.points
    };
  }

  /**
   * HERE Routing API
   */
  private async calculateHereRoute(
    origin: Coordinates,
    destination: Coordinates,
    departureTime?: Date
  ): Promise<RouteResult> {
    const config = getRoutingConfig();

    const params = new URLSearchParams({
      apiKey: config.apiKey,
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      transportMode: config.useTruckRouting ? 'truck' : 'car',
      return: 'summary,polyline'
    });

    if (departureTime) {
      params.append('departureTime', departureTime.toISOString());
    }

    const response = await fetch(`${config.baseUrl}?${params}`, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`HERE API returned ${response.status}`);
    }

    const data = await response.json() as {
      routes?: Array<{
        sections: Array<{
          summary: {
            length: number; // meters
            duration: number; // seconds
            baseDuration?: number;
          };
          polyline?: string;
        }>;
      }>;
      title?: string;
      cause?: string;
    };

    if (!data.routes?.[0]) {
      throw new Error(data.title || data.cause || 'HERE API returned no routes');
    }

    const route = data.routes[0];
    const section = route.sections[0];

    const distanceMiles = section.summary.length / 1609.34;
    const durationMinutes = section.summary.duration / 60;
    const durationInTraffic = section.summary.baseDuration
      ? section.summary.baseDuration / 60
      : undefined;

    return {
      distanceMiles,
      durationMinutes,
      durationInTraffic,
      provider: 'here',
      cached: false,
      polyline: section.polyline
    };
  }

  /**
   * OSRM (Open Source Routing Machine)
   * Free, open source routing - uses public demo server by default
   */
  private async calculateOsrmRoute(
    origin: Coordinates,
    destination: Coordinates
  ): Promise<RouteResult> {
    const config = getRoutingConfig();

    // OSRM uses longitude,latitude order (opposite of most APIs)
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${config.baseUrl}/route/v1/driving/${coords}?overview=full&geometries=polyline`;

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`OSRM API returned ${response.status}`);
    }

    const data = await response.json() as {
      code: string;
      routes?: Array<{
        distance: number; // meters
        duration: number; // seconds
        geometry?: string;
      }>;
      message?: string;
    };

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      throw new Error(data.message || `OSRM API code: ${data.code}`);
    }

    const route = data.routes[0];
    const distanceMiles = route.distance / 1609.34;
    const durationMinutes = route.duration / 60;

    return {
      distanceMiles,
      durationMinutes,
      provider: 'osrm',
      cached: false,
      polyline: route.geometry
    };
  }

  /**
   * Fallback calculation using Haversine formula
   * Used when no routing API is configured or API fails
   */
  private calculateFallback(origin: Coordinates, destination: Coordinates): RouteResult {
    const distanceMiles = this.haversineDistance(origin, destination);

    // Estimate duration based on average truck speed of 55 mph
    // Add 15% for non-highway roads and stops
    const avgSpeedMph = 55;
    const adjustmentFactor = 1.15;
    const durationMinutes = (distanceMiles / avgSpeedMph) * 60 * adjustmentFactor;

    return {
      distanceMiles,
      durationMinutes,
      provider: 'none',
      cached: false
    };
  }

  /**
   * Haversine formula for straight-line distance
   */
  private haversineDistance(origin: Coordinates, destination: Coordinates): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(destination.latitude - origin.latitude);
    const dLon = this.toRad(destination.longitude - origin.longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(origin.latitude)) *
        Math.cos(this.toRad(destination.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; provider: RoutingProvider; configured: boolean } {
    return {
      size: this.cache.size,
      provider: isRoutingConfigured() ? getRoutingConfig().provider : 'none',
      configured: isRoutingConfigured()
    };
  }

  /**
   * Clear the route cache
   */
  clearCache(): void {
    this.cache.clear();
    log.info('ROUTING', 'Route cache cleared');
  }
}

// Singleton instance
export const routingService = new RoutingService();
