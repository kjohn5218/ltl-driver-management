import { prisma } from '../index';

// GoMotive API configuration for GPS tracking
const GOMOTIVE_API_URL = process.env.GOMOTIVE_API_URL || 'https://api.gomotive.com/v3';
const GOMOTIVE_API_KEY = process.env.GOMOTIVE_API_KEY || '';

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
  distanceRemaining?: number; // miles
  currentLocation?: {
    latitude: number;
    longitude: number;
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
    destinationTerminal: {
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
          destinationTerminal: {
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
 */
async function calculateGpsBasedEta(trip: TripWithProfile): Promise<EtaResult> {
  if (!trip.truck) {
    return { estimatedArrival: null, source: 'NONE' };
  }

  const destinationLat = trip.linehaulProfile?.destinationTerminal?.latitude;
  const destinationLon = trip.linehaulProfile?.destinationTerminal?.longitude;

  if (!destinationLat || !destinationLon) {
    return { estimatedArrival: null, source: 'NONE' };
  }

  try {
    // Fetch current GPS location from GoMotive API or use mock data
    let gpsLocation: GpsLocation | null = null;

    if (trip.truck.externalFleetId && GOMOTIVE_API_KEY) {
      gpsLocation = await fetchGpsLocationFromGoMotive(trip.truck.externalFleetId);
    }

    // Use mock GPS data if no real data available (for development)
    if (!gpsLocation) {
      gpsLocation = generateMockGpsLocation(trip);
    }

    if (!gpsLocation) {
      return { estimatedArrival: null, source: 'NONE' };
    }

    // Calculate distance remaining
    const distanceRemaining = calculateDistance(
      gpsLocation.latitude,
      gpsLocation.longitude,
      Number(destinationLat),
      Number(destinationLon)
    );

    // Calculate ETA based on current speed
    // If speed is 0 or very low, use average highway speed of 55 mph
    const effectiveSpeed = gpsLocation.speed > 5 ? gpsLocation.speed : 55;
    const hoursRemaining = distanceRemaining / effectiveSpeed;
    const minutesRemaining = hoursRemaining * 60;

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
      currentLocation: {
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude
      }
    };
  } catch (error) {
    console.error('Error fetching GPS data:', error);
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
 * Fetch GPS location from GoMotive API
 * Uses the same API endpoint pattern as the vehicle location controller
 */
async function fetchGpsLocationFromGoMotive(externalFleetId: string): Promise<GpsLocation | null> {
  if (!GOMOTIVE_API_KEY || !GOMOTIVE_API_URL) {
    return null;
  }

  try {
    // Calculate date range for API (last 24 hours)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const apiUrl = `${GOMOTIVE_API_URL}/vehicle_locations/${externalFleetId}?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GOMOTIVE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`GoMotive API returned status ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      vehicle_locations?: GpsApiResponse[];
      locations?: GpsApiResponse[];
    };

    // GoMotive API returns an array of location records - get the most recent
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
    console.error('Error fetching GPS location from GoMotive:', error);
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
  const destLat = trip.linehaulProfile.destinationTerminal?.latitude;
  const destLon = trip.linehaulProfile.destinationTerminal?.longitude;

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

export const etaService = {
  calculateEta,
  calculateEtaBatch
};
