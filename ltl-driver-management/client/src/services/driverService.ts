import { api } from './api';
import { CarrierDriver } from '../types';

interface DriversResponse {
  drivers: CarrierDriver[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface DriverFilters {
  active?: boolean;
  carrierId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreateDriverData {
  carrierId: number;
  name: string;
  number?: string;
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
}

interface UpdateDriverData {
  name?: string;
  number?: string;
  phoneNumber?: string;
  email?: string;
  licenseNumber?: string;
  active?: boolean;
  carrierId?: number;
}

export const driverService = {
  // Get all drivers with filtering
  getDrivers: async (filters?: DriverFilters): Promise<DriversResponse> => {
    const params = new URLSearchParams();
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/drivers?${params.toString()}`);
    return response.data;
  },

  // Get all drivers (no filtering)
  getAllDrivers: async (): Promise<CarrierDriver[]> => {
    const allDrivers: CarrierDriver[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await driverService.getDrivers({ 
        active: true, 
        limit: 100, 
        page 
      });
      
      allDrivers.push(...response.drivers);
      hasMore = page < response.pagination.pages;
      page++;
    }
    
    return allDrivers;
  },

  // Get drivers by carrier
  getDriversByCarrier: async (carrierId: number): Promise<CarrierDriver[]> => {
    const response = await api.get(`/drivers/carrier/${carrierId}`);
    return response.data;
  },

  // Get driver by ID
  getDriverById: async (id: number): Promise<CarrierDriver> => {
    const response = await api.get(`/drivers/${id}`);
    return response.data;
  },

  // Create new driver
  createDriver: async (data: CreateDriverData): Promise<CarrierDriver> => {
    const response = await api.post('/drivers', data);
    return response.data;
  },

  // Update driver
  updateDriver: async (id: number, data: UpdateDriverData): Promise<CarrierDriver> => {
    const response = await api.put(`/drivers/${id}`, data);
    return response.data;
  },

  // Delete driver (soft delete)
  deleteDriver: async (id: number): Promise<void> => {
    await api.delete(`/drivers/${id}`);
  }
};