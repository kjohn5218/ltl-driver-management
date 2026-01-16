import { api } from './api';
import { LinehaulProfile, Route } from '../types';

interface ProfileFilters {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

interface ProfilesResponse {
  profiles: LinehaulProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// This service provides linehaul profiles for dispatch
// It can use either the LinehaulProfile model or Route model depending on backend setup
export const linehaulProfileService = {
  // Get all profiles with filtering
  getProfiles: async (filters?: ProfileFilters): Promise<ProfilesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    // Try linehaul-profiles endpoint first, fallback to routes
    try {
      const response = await api.get(`/linehaul-profiles?${params.toString()}`);
      return response.data;
    } catch {
      // Fallback to routes endpoint and map to profile format
      const response = await api.get(`/routes?${params.toString()}`);
      const routes = response.data.routes || response.data;
      return {
        profiles: routes.map((route: Route) => ({
          id: route.id,
          profileCode: route.name,
          name: route.name,
          originTerminalId: 0,
          destinationTerminalId: 0,
          origin: route.origin,
          destination: route.destination,
          distanceMiles: route.distance,
          transitTimeMinutes: route.runTime,
          standardDepartureTime: route.departureTime,
          standardArrivalTime: route.arrivalTime,
          frequency: route.frequency,
          equipmentConfig: { truckType: 'DAY_CAB', trailerType: 'DRY_VAN_53' },
          requiresTeamDriver: false,
          hazmatRequired: false,
          active: route.active,
          createdAt: route.createdAt,
          updatedAt: route.updatedAt
        } as unknown as LinehaulProfile)),
        pagination: response.data.pagination || { page: 1, limit: 100, total: routes.length, totalPages: 1 }
      };
    }
  },

  // Get list of profiles for dropdowns
  getProfilesList: async (): Promise<LinehaulProfile[]> => {
    try {
      const response = await api.get('/linehaul-profiles?limit=500&active=true');
      return response.data.profiles || response.data;
    } catch {
      // Fallback to routes
      const response = await api.get('/routes?limit=500');
      const routes = response.data.routes || response.data;
      return routes.map((route: Route) => ({
        id: route.id,
        profileCode: route.name,
        name: route.name,
        originTerminalId: 0,
        destinationTerminalId: 0,
        origin: route.origin,
        destination: route.destination,
        distanceMiles: route.distance,
        transitTimeMinutes: route.runTime,
        standardDepartureTime: route.departureTime,
        standardArrivalTime: route.arrivalTime,
        frequency: route.frequency,
        equipmentConfig: { truckType: 'DAY_CAB', trailerType: 'DRY_VAN_53' },
        requiresTeamDriver: false,
        hazmatRequired: false,
        active: route.active,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt
      } as unknown as LinehaulProfile));
    }
  },

  // Get profile by ID
  getProfileById: async (id: number): Promise<LinehaulProfile> => {
    try {
      const response = await api.get(`/linehaul-profiles/${id}`);
      return response.data;
    } catch {
      const response = await api.get(`/routes/${id}`);
      const route = response.data;
      return {
        id: route.id,
        profileCode: route.name,
        name: route.name,
        originTerminalId: 0,
        destinationTerminalId: 0,
        origin: route.origin,
        destination: route.destination,
        distanceMiles: route.distance,
        transitTimeMinutes: route.runTime,
        standardDepartureTime: route.departureTime,
        standardArrivalTime: route.arrivalTime,
        frequency: route.frequency,
        equipmentConfig: { truckType: 'DAY_CAB', trailerType: 'DRY_VAN_53' },
        requiresTeamDriver: false,
        hazmatRequired: false,
        active: route.active,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt
      } as unknown as LinehaulProfile;
    }
  }
};
