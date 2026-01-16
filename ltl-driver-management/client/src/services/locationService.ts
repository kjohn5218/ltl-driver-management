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
  }
};
