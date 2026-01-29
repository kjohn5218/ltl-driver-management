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

export const terminalService = {
  // Get all terminals with filtering
  getTerminals: async (filters?: TerminalFilters): Promise<TerminalsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/terminals?${params.toString()}`);
    return response.data;
  },

  // Get list of terminals for dropdowns
  getTerminalsList: async (): Promise<Terminal[]> => {
    const response = await api.get('/terminals?limit=500&active=true');
    return response.data.terminals || response.data;
  },

  // Get terminal by ID
  getTerminalById: async (id: number): Promise<Terminal> => {
    const response = await api.get(`/terminals/${id}`);
    return response.data;
  },

  // Get terminal by code
  getTerminalByCode: async (code: string): Promise<Terminal> => {
    const response = await api.get(`/terminals/code/${code}`);
    return response.data;
  }
};
