import { api } from './api';
import { Carrier } from '../types';

interface CarriersResponse {
  carriers: Carrier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface CarrierFilters {
  status?: string;
  onboardingComplete?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const carrierService = {
  // Get all carriers with filtering
  getCarriers: async (filters?: CarrierFilters): Promise<CarriersResponse> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.onboardingComplete !== undefined) {
      params.append('onboardingComplete', filters.onboardingComplete.toString());
    }
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/carriers?${params.toString()}`);
    return response.data;
  },

  // Get carrier by ID
  getCarrierById: async (id: number): Promise<Carrier> => {
    const response = await api.get(`/carriers/${id}`);
    return response.data;
  },

  // Search carriers
  searchCarriers: async (query: string): Promise<Carrier[]> => {
    const response = await api.get(`/carriers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }
};