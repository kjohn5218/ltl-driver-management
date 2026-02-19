import { api } from './api';
import { Location } from '../types';

interface LocationFilters {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

interface LocationsResponse {
  locations: Location[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Terminal location for Okay to Load/Dispatch lists
export interface TerminalLocation {
  id: number;
  code: string;
  name?: string;
  city?: string;
  state?: string;
  isPhysicalTerminal: boolean;
  isVirtualTerminal: boolean;
  isDispatchLocation: boolean;
}

// Mileage lookup result
export interface MileageLookupResult {
  miles: number | null;
  originCode: string;
  destinationCode: string;
  source?: 'profile' | 'gps';
  profileCode?: string;
}

export const locationService = {
  // Get all locations with filtering
  getLocations: async (filters?: LocationFilters): Promise<LocationsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/locations?${params.toString()}`);
    return response.data;
  },

  // Get list of locations for dropdowns (simplified)
  getLocationsList: async (): Promise<Location[]> => {
    const response = await api.get('/locations?limit=500&active=true');
    return response.data.locations || response.data;
  },

  // Get location by ID
  getLocationById: async (id: number): Promise<Location> => {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  },

  // Get terminal locations (where isPhysicalTerminal or isVirtualTerminal is true)
  getTerminalLocations: async (): Promise<TerminalLocation[]> => {
    const response = await api.get('/locations/terminals');
    return response.data;
  },

  // Lookup mileage between two locations (uses profile first, GPS fallback)
  lookupMileage: async (origin: string, destination: string): Promise<MileageLookupResult> => {
    try {
      const response = await api.get(
        `/locations/mileage?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
      );
      return response.data;
    } catch (error: any) {
      // Return null miles if not found (404)
      if (error.response?.status === 404) {
        return {
          miles: null,
          originCode: origin,
          destinationCode: destination
        };
      }
      throw error;
    }
  }
};
