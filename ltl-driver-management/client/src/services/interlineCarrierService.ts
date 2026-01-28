import { api } from './api';
import { InterlineCarrier } from '../types';

export interface InterlineCarriersResponse {
  carriers: InterlineCarrier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InterlineCarrierFilters {
  search?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateInterlineCarrierRequest {
  code: string;
  name: string;
  scacCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  active?: boolean;
}

export interface UpdateInterlineCarrierRequest extends Partial<CreateInterlineCarrierRequest> {}

export const interlineCarrierService = {
  // Get all interline carriers with filtering
  getCarriers: async (filters: InterlineCarrierFilters = {}): Promise<InterlineCarriersResponse> => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.active !== undefined) params.append('active', String(filters.active));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await api.get(`/interline-carriers?${params.toString()}`);
    return response.data;
  },

  // Get simple list of active carriers for dropdowns
  getCarriersList: async (): Promise<InterlineCarrier[]> => {
    const response = await api.get('/interline-carriers/list');
    return response.data;
  },

  // Get carrier by ID
  getCarrierById: async (id: number): Promise<InterlineCarrier> => {
    const response = await api.get(`/interline-carriers/${id}`);
    return response.data;
  },

  // Create new carrier
  createCarrier: async (data: CreateInterlineCarrierRequest): Promise<InterlineCarrier> => {
    const response = await api.post('/interline-carriers', data);
    return response.data;
  },

  // Update carrier
  updateCarrier: async (id: number, data: UpdateInterlineCarrierRequest): Promise<InterlineCarrier> => {
    const response = await api.put(`/interline-carriers/${id}`, data);
    return response.data;
  },

  // Delete carrier
  deleteCarrier: async (id: number): Promise<void> => {
    await api.delete(`/interline-carriers/${id}`);
  },

  // Toggle carrier active status
  toggleCarrierStatus: async (id: number): Promise<InterlineCarrier> => {
    const response = await api.patch(`/interline-carriers/${id}/toggle-status`);
    return response.data;
  }
};
