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
<<<<<<< HEAD
    const params = new URLSearchParams();
    params.append('active', 'true');
    params.append('limit', '5000');

    console.log('getAllDrivers: Making request to:', `/drivers?${params.toString()}`);
    try {
      const response = await api.get(`/drivers?${params.toString()}`);
      console.log('getAllDrivers: Response received:', response.data);
      return response.data.drivers;
    } catch (error) {
      console.error('getAllDrivers: Full error:', error);
      console.error('getAllDrivers: Error response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('getAllDrivers: Error status:', error.response?.status);
      console.error('getAllDrivers: Error message:', error.message);
      console.error('getAllDrivers: Request URL:', error.config?.url);
      throw error;
    }
=======
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
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
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