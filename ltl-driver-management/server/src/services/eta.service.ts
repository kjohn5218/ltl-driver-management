import { prisma } from '../index';
import { getMotiveConfig, isMotiveConfigured } from '../config/motive.config';
import { routingService } from './routing.service';
import { isRoutingConfigured, getRoutingProvider } from '../config/routing.config';

interface GpsLocation {
  latitude: number;
  longitude: number;
  speed: number; // mph
  heading: number;
  timestamp: Date;
}

interface GpsApiResponse {
  latitude?: number;
  lat?: number;
  longitude?: number;
  lng?: number;
  lon?: number;
  speed?: number;
  velocity?: number;
  heading?: number;
  bearing?: number;
  timestamp?: string | number;
  time?: string | number;
}

interface EtaResult {
  estimatedArrival: Date | null;
  source: 'GPS' | 'PROFILE' | 'NONE';
  distanceRemaining?: number; // miles (road distance if routing enabled)
  durationRemaining?: number; // minutes (from routing API)
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  routing?: {
    provider: string;
    roadDistance: number; // miles
    straightLineDistance: number; // miles
    cached: boolean;
    durationInTraffic?: number; // minutes, if available
  };
}

interface TripWithProfile {
  id: number;
  tripNumber: string;
  actualDeparture: Date | null;
  truckId: number | null;
  lastKnownLatitude: number | null;
  lastKnownLongitude: number | null;
  lastLocationUpdate: Date | null;
  linehaulProfile: {
    id: number;
    transitTimeMinutes: number | null;
    distanceMiles: number | null;
    destinationLocation: {
      latitude: number | null;
      longitude: number | null;
    } | null;
  };
  truck: {
    id: number;
    unitNumber: string;
    externalFleetId: string | null;
  } | null;
}

/**
 * Calculate ETA for a trip
 * 1. If GPS data is available and truck is not OWNOP (has truckId), use GPS-based ETA
 * 2. Otherwise, calculate from transit time + actual departure
 */
export const calculateEta = async (tripId: number): Promise<EtaResult> => {
  const trip = await prisma.linehaulTrip.findUnique({
    where: { id: tripId },
    include: {
      linehaulProfile: {
        include: {
          destinationLocation: {
            select: { latitude: true, longitude: true }
          }
        }
      },
      truck: {
        select: { id: true, unitNumber: true, externalFleetId: true }
      }
    }
  }) as TripWithProfile | null;

  if (!trip) {
    return { estimatedArrival: null, source: 'NONE' };
  }

  // OWNOP power units (no truck assigned) always use profile-based ETA
  const isOwnop = !trip.truckId;

  if (!isOwnop && trip.truck) {
    // Try GPS-based ETA first for company trucks
    const gpsEta = await calculateGpsBasedEta(trip);
    if (gpsEta.estimatedArrival) {
      return gpsEta;
    }
  }

  // Fall back to profile-based ETA
  return calculateProfileBasedEta(trip);
};

/**
 * Calculate ETA using GPS data from external API or mock data
 * Uses routing API for accurate road-based distance and time when configured
 */
async function calculateGpsBasedEta(trip: TripWithProfile): Promise<EtaResult> {
  if (!trip.truck) {
    return { estimatedArrival: null, source: 'NONE' };
  }

  const destinationLat = trip.linehaulProfile?.destinationLocation?.latitude;
  const destinationLon = trip.linehaulProfile?.destinationLocation?.longitude;

  if (!destinationLat || !destinationLon) {
    return { estimatedArrival: null, source: 'NONE' };
  }

  try {
    // Fetch current GPS location from Motive API or use mock data
    let gpsLocation: GpsLocation | null = null;

    if (trip.truck.externalFleetId && isMotiveConfigured()) {
      gpsLocation = await fetchGpsLocationFromMotive(trip.truck.externalFleetId);
    }

    // Use mock GPS data if no real data available (for development)
    if (!gpsLocation) {
      gpsLocation = generateMockGpsLocation(trip);
    }

    if (!gpsLocation) {
      return { estimatedArrival: null, source: 'NONE' };
    }

    const origin = { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude };
    const destination = { latitude: Number(destinationLat), longitude: Number(destinationLon) };

    // Calculate straight-line distance for comparison
    const straightLineDistance = calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    let distanceRemaining: number;
    let minutesRemaining: number;
    let routingInfo: EtaResult['routing'] | undefined;

    // Try routing API for accurate road-based calculation
    if (isRoutingConfigured()) {
      const routeResult = await routingService.calculateRoute(origin, destination);

      if ('error' in routeResult) {
        // Routing failed, use fallback result if available
        if (routeResult.fallbackResult) {
          distanceRemaining = routeResult.fallbackResult.distanceMiles;
          minutesRemaining = routeResult.fallbackResult.durationMinutes;
          routingInfo = {
            provider: 'none (fallback)',
            roadDistance: distanceRemaining,
            straightLineDistance,
            cached: false
          };
        } else {
          // No fallback, use simple calculation
          distanceRemaining = straightLineDistance;
          const effectiveSpeed = gpsLocation.speed > 5 ? gpsLocation.speed : 55;
          minutesRemaining = (distanceRemaining / effectiveSpeed) * 60;
        }
      } else {
        // Routing succeeded
        distanceRemaining = routeResult.distanceMiles;
        minutesRemaining = routeResult.durationInTraffic || routeResult.durationMinutes;
        routingInfo = {
          provider: routeResult.provider,
          roadDistance: routeResult.distanceMiles,
          straightLineDistance,
          cached: routeResult.cached,
          durationInTraffic: routeResult.durationInTraffic
        };
      }
    } else {
      // No routing configured, use simple speed-based calculation
      distanceRemaining = straightLineDistance;
      // If speed is 0 or very low, use average highway speed of 55 mph
      const effectiveSpeed = gpsLocation.speed > 5 ? gpsLocation.speed : 55;
      minutesRemaining = (distanceRemaining / effectiveSpeed) * 60;
    }

    const estimatedArrival = new Date();
    estimatedArrival.setMinutes(estimatedArrival.getMinutes() + minutesRemaining);

    // Update trip with latest location
    await prisma.linehaulTrip.update({
      where: { id: trip.id },
      data: {
        lastKnownLatitude: gpsLocation.latitude,
        lastKnownLongitude: gpsLocation.longitude,
        lastLocationUpdate: new Date(),
        estimatedArrival
      }
    });

    return {
      estimatedArrival,
      source: 'GPS',
      distanceRemaining,
      durationRemaining: minutesRemaining,
      currentLocation: {
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude
      },
      routing: routingInfo
    };
  } catch (error) {
    console.error('Error calculating GPS-based ETA:', error);
    return { estimatedArrival: null, source: 'NONE' };
  }
}

/**
 * Calculate ETA based on linehaul profile transit time
 */
function calculateProfileBasedEta(trip: TripWithProfile): EtaResult {
  const transitTimeMinutes = trip.linehaulProfile?.transitTimeMinutes;

  // If no transit time in profile, estimate based on distance
  // Average truck speed is ~55 mph
  let effectiveTransitMinutes = transitTimeMinutes;
  if (!effectiveTransitMinutes && trip.linehaulProfile?.distanceMiles) {
    effectiveTransitMinutes = Math.round((trip.linehaulProfile.distanceMiles / 55) * 60);
  }

  // Default to 4 hours if no transit time or distance available
  if (!effectiveTransitMinutes) {
    effectiveTransitMinutes = 240; // 4 hours default
  }

  // Use actual departure if available, otherwise estimate from current time
  // (assuming the trip just started or is about to start)
  const departureTime = trip.actualDeparture || new Date();

  const estimatedArrival = new Date(departureTime);
  estimatedArrival.setMinutes(estimatedArrival.getMinutes() + effectiveTransitMinutes);

  return {
    estimatedArrival,
    source: 'PROFILE'
  };
}

/**
 * Fetch GPS location from Motive API
 * Uses the centralized Motive config for API credentials
 */
async function fetchGpsLocationFromMotive(externalFleetId: string): Promise<GpsLocation | null> {
  if (!isMotiveConfigured()) {
    return null;
  }

  try {
    const config = getMotiveConfig();

    // Calculate date range for API (last 24 hours)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const apiUrl = `${config.baseUrl}/vehicle_locations/${externalFleetId}?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Api-Key': config.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`Motive API returned status ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      vehicle_locations?: GpsApiResponse[];
      locations?: GpsApiResponse[];
    };

    // Motive API returns an array of location records - get the most recent
    const locations = data.vehicle_locations || data.locations || [];
    const latestLocation = locations.length > 0 ? locations[locations.length - 1] : null;

    if (!latestLocation) {
      return null;
    }

    return {
      latitude: latestLocation.latitude ?? latestLocation.lat ?? 0,
      longitude: latestLocation.longitude ?? latestLocation.lng ?? latestLocation.lon ?? 0,
      speed: latestLocation.speed ?? latestLocation.velocity ?? 0,
      heading: latestLocation.heading ?? latestLocation.bearing ?? 0,
      timestamp: new Date(latestLocation.timestamp ?? latestLocation.time ?? Date.now())
    };
  } catch (error) {
    console.error('Error fetching GPS location from Motive:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Generate mock GPS location for development/testing
 * Simulates a truck position along the route based on departure time and transit time
 */
function generateMockGpsLocation(trip: TripWithProfile): GpsLocation | null {
  if (!trip.actualDeparture || !trip.linehaulProfile) {
    return null;
  }

  const transitTimeMinutes = trip.linehaulProfile.transitTimeMinutes;
  const distanceMiles = trip.linehaulProfile.distanceMiles;
  const destLat = trip.linehaulProfile.destinationLocation?.latitude;
  const destLon = trip.linehaulProfile.destinationLocation?.longitude;

  if (!transitTimeMinutes || !distanceMiles || !destLat || !destLon) {
    return null;
  }

  // Calculate progress along the route (0 to 1)
  const now = new Date();
  const departureTime = new Date(trip.actualDeparture);
  const elapsedMinutes = (now.getTime() - departureTime.getTime()) / (1000 * 60);
  const progress = Math.min(Math.max(elapsedMinutes / transitTimeMinutes, 0), 0.95);

  // Use last known location or estimate based on a default origin (Atlanta)
  const originLat = trip.lastKnownLatitude || 33.7490;
  const originLon = trip.lastKnownLongitude || -84.3880;

  // Interpolate position along straight line (simplified)
  const currentLat = originLat + (Number(destLat) - originLat) * progress;
  const currentLon = originLon + (Number(destLon) - originLon) * progress;

  // Simulate speed (average highway speed with some variation)
  const avgSpeed = distanceMiles / (transitTimeMinutes / 60);
  const speed = avgSpeed * (0.9 + Math.random() * 0.2); // ±10% variation

  // Calculate heading towards destination
  const heading = calculateBearing(currentLat, currentLon, Number(destLat), Number(destLon));

  return {
    latitude: currentLat,
    longitude: currentLon,
    speed: Math.round(speed),
    heading: Math.round(heading),
    timestamp: now
  };
}

/**
 * Calculate bearing between two coordinates
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

/**
 * Get ETA for multiple trips (batch operation)
 */
export const calculateEtaBatch = async (tripIds: number[]): Promise<Map<number, EtaResult>> => {
  const results = new Map<number, EtaResult>();

  // Process in parallel with a limit to avoid overwhelming the GPS API
  const batchSize = 10;
  for (let i = 0; i < tripIds.length; i += batchSize) {
    const batch = tripIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (tripId) => ({
        tripId,
        result: await calculateEta(tripId)
      }))
    );

    batchResults.forEach(({ tripId, result }) => {
      results.set(tripId, result);
    });
  }

  return results;
};

/**
 * Get routing configuration status
 */
export const getRoutingStatus = () => {
  const cacheStats = routingService.getCacheStats();
  return {
    configured: isRoutingConfigured(),
    provider: getRoutingProvider(),
    cacheSize: cacheStats.size
  };
};

/**
 * Clear the routing cache
 */
export const clearRoutingCache = () => {
  routingService.clearCache();
};

export const etaService = {
  calculateEta,
  calculateEtaBatch,
  getRoutingStatus,
  clearRoutingCache
};
