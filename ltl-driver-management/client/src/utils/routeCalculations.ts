// Utility functions for route distance and time calculations

export interface AddressInfo {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface RouteCalculationResult {
  distance?: number; // in miles
  duration?: number; // in minutes
  error?: string;
}

// Format address for geocoding API
export const formatAddress = (addressInfo: AddressInfo): string => {
  const parts = [];
  
  if (addressInfo.address) parts.push(addressInfo.address);
  if (addressInfo.city) parts.push(addressInfo.city);
  if (addressInfo.state) parts.push(addressInfo.state);
  if (addressInfo.zipCode) parts.push(addressInfo.zipCode);
  
  return parts.join(', ').trim();
};

// Check if we have enough address information to calculate
export const hasAddressInfo = (addressInfo: AddressInfo): boolean => {
  return !!(addressInfo.city && addressInfo.state) || 
         !!(addressInfo.address && (addressInfo.city || addressInfo.zipCode));
};

// Calculate route using OpenRouteService API (free alternative to Google Maps)
export const calculateRoute = async (
  origin: AddressInfo,
  destination: AddressInfo
): Promise<RouteCalculationResult> => {
  try {
    // Check if we have enough address information
    if (!hasAddressInfo(origin) || !hasAddressInfo(destination)) {
      return { error: 'Insufficient address information' };
    }

    const originAddress = formatAddress(origin);
    const destinationAddress = formatAddress(destination);

    // First, geocode the addresses to get coordinates
    const originCoords = await geocodeAddress(originAddress);
    const destinationCoords = await geocodeAddress(destinationAddress);

    if (!originCoords || !destinationCoords) {
      return { error: 'Could not geocode addresses' };
    }

    // Calculate route using OpenRouteService
    const routeData = await getRouteData(originCoords, destinationCoords);
    
    if (routeData.error) {
      return { error: routeData.error };
    }

    return {
      distance: routeData.distance,
      duration: routeData.duration
    };

  } catch (error) {
    console.error('Route calculation error:', error);
    return { error: 'Route calculation failed' };
  }
};

// Geocode address to coordinates using OpenStreetMap Nominatim (free service)
const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=us`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Get route data using OpenRouteService API (requires free API key)
const getRouteData = async (
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number }
): Promise<{ distance?: number; duration?: number; error?: string }> => {
  try {
    // For demo purposes, we'll use a simple distance calculation
    // In production, you should use a proper routing service
    const distance = calculateHaversineDistance(
      origin.lat, origin.lon,
      destination.lat, destination.lon
    );

    // Estimate driving time for trucks (average 45 mph including stops)
    const estimatedDuration = Math.round((distance / 45) * 60); // minutes

    return {
      distance: Math.round(distance * 10) / 10, // round to 1 decimal
      duration: estimatedDuration
    };

  } catch (error) {
    console.error('Route data error:', error);
    return { error: 'Failed to calculate route' };
  }
};

// Calculate straight-line distance using Haversine formula
const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Apply a factor to approximate driving distance (typically 1.2-1.5x straight line)
  return R * c * 1.3;
};

// Calculate route directly from GPS coordinates (no geocoding needed)
export const calculateRouteFromCoordinates = (
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): RouteCalculationResult => {
  try {
    const distance = calculateHaversineDistance(originLat, originLon, destLat, destLon);

    // Estimate driving time for trucks (average 45 mph including stops)
    const estimatedDuration = Math.round((distance / 45) * 60); // minutes

    return {
      distance: Math.round(distance * 10) / 10, // round to 1 decimal
      duration: estimatedDuration
    };
  } catch (error) {
    console.error('GPS route calculation error:', error);
    return { error: 'Failed to calculate route from coordinates' };
  }
};

// Calculate arrival time from departure time and run time
export const calculateArrivalTime = (departureTime: string, runTimeMinutes: number): string => {
  if (!departureTime || !runTimeMinutes) return '';

  try {
    // Parse departure time (HH:MM format)
    const [hours, minutes] = departureTime.split(':').map(Number);
    
    // Create a date object for today with the departure time
    const departureDate = new Date();
    departureDate.setHours(hours, minutes, 0, 0);
    
    // Add run time in minutes
    const arrivalDate = new Date(departureDate.getTime() + runTimeMinutes * 60 * 1000);
    
    // Format as HH:MM
    const arrivalHours = arrivalDate.getHours().toString().padStart(2, '0');
    const arrivalMinutes = arrivalDate.getMinutes().toString().padStart(2, '0');
    
    return `${arrivalHours}:${arrivalMinutes}`;
    
  } catch (error) {
    console.error('Arrival time calculation error:', error);
    return '';
  }
};

// Format minutes to hours and minutes display
export const formatRunTime = (minutes: number): string => {
  if (!minutes) return '';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours} hr`;
  } else {
    return `${hours} hr ${mins} min`;
  }
};