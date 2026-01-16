import { api } from './api';
import { LinehaulProfile } from '../types';

interface ProfilesResponse {
  profiles: LinehaulProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ProfileFilters {
  search?: string;
  active?: boolean;
  originTerminalId?: number;
  destinationTerminalId?: number;
  page?: number;
  limit?: number;
}

export const linehaulProfileService = {
  // Get all linehaul profiles with filtering
  getProfiles: async (filters?: ProfileFilters): Promise<ProfilesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.originTerminalId) params.append('originTerminalId', filters.originTerminalId.toString());
    if (filters?.destinationTerminalId) params.append('destinationTerminalId', filters.destinationTerminalId.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/linehaul-profiles?${params.toString()}`);
    return response.data;
  },

  // Get simple list of profiles for dropdowns
  getProfilesList: async (): Promise<LinehaulProfile[]> => {
    const response = await api.get('/linehaul-profiles/list');
    return response.data;
  },

  // Get profile by ID
  getProfileById: async (id: number): Promise<LinehaulProfile> => {
    const response = await api.get(`/linehaul-profiles/${id}`);
    return response.data;
  },

  // Get profile by code
  getProfileByCode: async (code: string): Promise<LinehaulProfile> => {
    const response = await api.get(`/linehaul-profiles/code/${code}`);
    return response.data;
  },

  // Get profiles for a specific terminal
  getProfilesByTerminal: async (terminalId: number, direction?: 'origin' | 'destination' | 'both'): Promise<LinehaulProfile[]> => {
    const params = direction ? `?direction=${direction}` : '';
    const response = await api.get(`/linehaul-profiles/terminal/${terminalId}${params}`);
    return response.data;
  },

  // Create linehaul profile
  createProfile: async (data: Partial<LinehaulProfile>): Promise<LinehaulProfile> => {
    const response = await api.post('/linehaul-profiles', data);
    return response.data;
  },

  // Update linehaul profile
  updateProfile: async (id: number, data: Partial<LinehaulProfile>): Promise<LinehaulProfile> => {
    const response = await api.put(`/linehaul-profiles/${id}`, data);
    return response.data;
  },

  // Delete linehaul profile
  deleteProfile: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/linehaul-profiles/${id}`);
    return response.data;
  },

  // Toggle profile active status
  toggleProfileStatus: async (id: number): Promise<LinehaulProfile> => {
    const response = await api.patch(`/linehaul-profiles/${id}/toggle-status`);
    return response.data;
  },

  // Duplicate a profile
  duplicateProfile: async (id: number, newCode: string, newName?: string): Promise<LinehaulProfile> => {
    const response = await api.post(`/linehaul-profiles/${id}/duplicate`, { newCode, newName });
    return response.data;
  }
};
