import { api } from './api';
import { Terminal } from '../types';

interface TerminalsResponse {
  terminals: Terminal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TerminalFilters {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
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

  // Get simple list of terminals for dropdowns
  getTerminalsList: async (): Promise<Terminal[]> => {
    const response = await api.get('/terminals/list');
    return response.data;
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
  },

  // Create terminal
  createTerminal: async (data: Partial<Terminal>): Promise<Terminal> => {
    const response = await api.post('/terminals', data);
    return response.data;
  },

  // Update terminal
  updateTerminal: async (id: number, data: Partial<Terminal>): Promise<Terminal> => {
    const response = await api.put(`/terminals/${id}`, data);
    return response.data;
  },

  // Delete terminal
  deleteTerminal: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/terminals/${id}`);
    return response.data;
  },

  // Toggle terminal active status
  toggleTerminalStatus: async (id: number): Promise<Terminal> => {
    const response = await api.patch(`/terminals/${id}/toggle-status`);
    return response.data;
  },

  // Get equipment requirements for a terminal
  getEquipmentRequirements: async (terminalId: number): Promise<Terminal['equipmentRequirements']> => {
    const response = await api.get(`/terminals/${terminalId}/equipment-requirements`);
    return response.data;
  },

  // Update equipment requirements for a terminal
  updateEquipmentRequirements: async (
    terminalId: number,
    requirements: Terminal['equipmentRequirements']
  ): Promise<Terminal['equipmentRequirements']> => {
    const response = await api.put(`/terminals/${terminalId}/equipment-requirements`, { requirements });
    return response.data;
  }
};
