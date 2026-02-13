import { api } from './api';
import { LinehaulProfile, Route, Terminal } from '../types';

export interface OkayToLoadResponse {
  profileId: number;
  profileCode: string;
  profileName: string;
  originTerminal: Terminal;
  okayToLoadTerminals: Terminal[];
}

export interface OkayToDispatchResponse {
  profileId: number;
  profileCode: string;
  profileName: string;
  originTerminal: Terminal;
  okayToDispatchTerminals: Terminal[];
}

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
          equipmentConfig: { truckType: 'SEMI_TRUCK', trailerType: 'DRY_VAN_53' },
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

  // Get list of profiles for dropdowns - tries linehaul-profiles first, falls back to routes
  getProfilesList: async (): Promise<LinehaulProfile[]> => {
    try {
      // Try the actual linehaul-profiles endpoint first
      const response = await api.get('/linehaul-profiles/list');
      console.log('Fetched from /linehaul-profiles/list:', response.data);

      // If linehaul-profiles returns data, use it
      if (response.data && response.data.length > 0) {
        return response.data;
      }

      // If empty, fall back to routes
      console.log('linehaul-profiles/list returned empty, falling back to routes');
    } catch (error) {
      console.warn('Failed to fetch from /linehaul-profiles/list, trying /routes fallback');
    }

    // Fallback to routes endpoint
    try {
      const response = await api.get('/routes?limit=1500');
      const routes = response.data.routes || response.data || [];
      console.log('Fetched from /routes fallback:', routes.length, 'routes');
      return routes
        .filter((route: Route) => route.active)
        .map((route: Route) => ({
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
          equipmentConfig: { truckType: 'SEMI_TRUCK', trailerType: 'DRY_VAN_53' },
          requiresTeamDriver: false,
          hazmatRequired: false,
          active: route.active,
          createdAt: route.createdAt,
          updatedAt: route.updatedAt
        } as unknown as LinehaulProfile));
    } catch (routesError) {
      console.error('Failed to fetch linehaul profiles from both endpoints:', routesError);
      return [];
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
        equipmentConfig: { truckType: 'SEMI_TRUCK', trailerType: 'DRY_VAN_53' },
        requiresTeamDriver: false,
        hazmatRequired: false,
        active: route.active,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt
      } as unknown as LinehaulProfile;
    }
  },

  // Get okay-to-load terminals for a profile
  getOkayToLoadTerminals: async (profileId: number): Promise<OkayToLoadResponse> => {
    const response = await api.get(`/linehaul-profiles/${profileId}/okay-to-load`);
    return response.data;
  },

  // Update okay-to-load terminals for a profile
  updateOkayToLoadTerminals: async (profileId: number, terminalIds: number[]): Promise<OkayToLoadResponse> => {
    const response = await api.put(`/linehaul-profiles/${profileId}/okay-to-load`, { terminalIds });
    return response.data;
  },

  // Get okay-to-dispatch terminals for a profile
  getOkayToDispatchTerminals: async (profileId: number): Promise<OkayToDispatchResponse> => {
    const response = await api.get(`/linehaul-profiles/${profileId}/okay-to-dispatch`);
    return response.data;
  },

  // Update okay-to-dispatch terminals for a profile
  updateOkayToDispatchTerminals: async (profileId: number, terminalIds: number[]): Promise<OkayToDispatchResponse> => {
    const response = await api.put(`/linehaul-profiles/${profileId}/okay-to-dispatch`, { terminalIds });
    return response.data;
  },

  // Get route by name to look up origin/destination when profile name doesn't match
  getRouteByName: async (routeName: string): Promise<Route | null> => {
    try {
      const response = await api.get(`/routes?search=${encodeURIComponent(routeName)}&limit=10`);
      const routes = response.data.routes || response.data || [];
      // Find exact match
      const exactMatch = routes.find((r: Route) => r.name === routeName);
      return exactMatch || null;
    } catch (error) {
      console.warn('Failed to fetch route by name:', routeName, error);
      return null;
    }
  },

  // Find profile by origin and destination terminal codes
  findProfileByTerminals: async (originCode: string, destinationCode: string): Promise<LinehaulProfile | null> => {
    try {
      const profiles = await linehaulProfileService.getProfilesList();
      const match = profiles.find(p =>
        p.originTerminal?.code?.toUpperCase() === originCode.toUpperCase() &&
        p.destinationTerminal?.code?.toUpperCase() === destinationCode.toUpperCase()
      );
      return match || null;
    } catch (error) {
      console.warn('Failed to find profile by terminals:', originCode, destinationCode, error);
      return null;
    }
  }
};
