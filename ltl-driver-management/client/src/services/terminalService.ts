import { api } from './api';
import { Terminal } from '../types';

interface TerminalFilters {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

interface TerminalsResponse {
  terminals: Terminal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Note: This service now uses the /locations API endpoints (migrated from /terminals)
// The Location table is the single source of truth for terminal/location data
export const terminalService = {
  // Get all terminals with filtering (uses /locations endpoint)
  getTerminals: async (filters?: TerminalFilters): Promise<TerminalsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/locations?${params.toString()}`);
    // Map locations response to terminals format for backwards compatibility
    return {
      terminals: response.data.locations || [],
      pagination: response.data.pagination
    };
  },

  // Get list of terminals for dropdowns (uses /locations/list endpoint)
  getTerminalsList: async (): Promise<Terminal[]> => {
    const response = await api.get('/locations/list');
    return response.data;
  },

  // Get terminal by ID (uses /locations endpoint)
  getTerminalById: async (id: number): Promise<Terminal> => {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  },

  // Get terminal by code (uses /locations endpoint)
  getTerminalByCode: async (code: string): Promise<Terminal> => {
    const response = await api.get(`/locations/code/${code}`);
    return response.data;
  }
};
