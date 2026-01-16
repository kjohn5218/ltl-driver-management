import { api } from './api';
import {
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  EquipmentStatus,
  TruckType,
  TrailerType,
  DollyType,
  EquipmentResponse
} from '../types';

interface EquipmentFilters {
  search?: string;
  status?: EquipmentStatus;
  terminalId?: number;
  carrierId?: number;
  type?: TruckType | TrailerType | DollyType;
  available?: boolean;
  page?: number;
  limit?: number;
}

interface LocationUpdate {
  currentTerminalId?: number;
  latitude?: number;
  longitude?: number;
}

export const equipmentService = {
  // ==================== TRUCKS ====================

  // Get all trucks with filtering
  getTrucks: async (filters?: EquipmentFilters): Promise<EquipmentResponse<EquipmentTruck>> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.terminalId) params.append('terminalId', filters.terminalId.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/equipment/trucks?${params.toString()}`);
    return response.data;
  },

  // Get available trucks
  getAvailableTrucks: async (terminalId?: number): Promise<EquipmentTruck[]> => {
    const params = terminalId ? `?terminalId=${terminalId}` : '';
    const response = await api.get(`/equipment/trucks/available${params}`);
    return response.data;
  },

  // Get truck by ID
  getTruckById: async (id: number): Promise<EquipmentTruck> => {
    const response = await api.get(`/equipment/trucks/${id}`);
    return response.data;
  },

  // Create truck
  createTruck: async (data: Partial<EquipmentTruck>): Promise<EquipmentTruck> => {
    const response = await api.post('/equipment/trucks', data);
    return response.data;
  },

  // Update truck
  updateTruck: async (id: number, data: Partial<EquipmentTruck>): Promise<EquipmentTruck> => {
    const response = await api.put(`/equipment/trucks/${id}`, data);
    return response.data;
  },

  // Delete truck
  deleteTruck: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/equipment/trucks/${id}`);
    return response.data;
  },

  // Update truck status
  updateTruckStatus: async (id: number, status: EquipmentStatus, notes?: string): Promise<EquipmentTruck> => {
    const response = await api.patch(`/equipment/trucks/${id}/status`, { status, notes });
    return response.data;
  },

  // Update truck location
  updateTruckLocation: async (id: number, location: LocationUpdate): Promise<EquipmentTruck> => {
    const response = await api.patch(`/equipment/trucks/${id}/location`, location);
    return response.data;
  },

  // ==================== TRAILERS ====================

  // Get all trailers with filtering
  getTrailers: async (filters?: EquipmentFilters): Promise<EquipmentResponse<EquipmentTrailer>> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.terminalId) params.append('terminalId', filters.terminalId.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/equipment/trailers?${params.toString()}`);
    return response.data;
  },

  // Get available trailers
  getAvailableTrailers: async (terminalId?: number): Promise<EquipmentTrailer[]> => {
    const params = terminalId ? `?terminalId=${terminalId}` : '';
    const response = await api.get(`/equipment/trailers/available${params}`);
    return response.data;
  },

  // Get trailer by ID
  getTrailerById: async (id: number): Promise<EquipmentTrailer> => {
    const response = await api.get(`/equipment/trailers/${id}`);
    return response.data;
  },

  // Create trailer
  createTrailer: async (data: Partial<EquipmentTrailer>): Promise<EquipmentTrailer> => {
    const response = await api.post('/equipment/trailers', data);
    return response.data;
  },

  // Update trailer
  updateTrailer: async (id: number, data: Partial<EquipmentTrailer>): Promise<EquipmentTrailer> => {
    const response = await api.put(`/equipment/trailers/${id}`, data);
    return response.data;
  },

  // Delete trailer
  deleteTrailer: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/equipment/trailers/${id}`);
    return response.data;
  },

  // Update trailer status
  updateTrailerStatus: async (id: number, status: EquipmentStatus, notes?: string): Promise<EquipmentTrailer> => {
    const response = await api.patch(`/equipment/trailers/${id}/status`, { status, notes });
    return response.data;
  },

  // Update trailer location
  updateTrailerLocation: async (id: number, location: LocationUpdate): Promise<EquipmentTrailer> => {
    const response = await api.patch(`/equipment/trailers/${id}/location`, location);
    return response.data;
  },

  // ==================== DOLLIES ====================

  // Get all dollies with filtering
  getDollies: async (filters?: EquipmentFilters): Promise<EquipmentResponse<EquipmentDolly>> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.terminalId) params.append('terminalId', filters.terminalId.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/equipment/dollies?${params.toString()}`);
    return response.data;
  },

  // Get available dollies
  getAvailableDollies: async (terminalId?: number): Promise<EquipmentDolly[]> => {
    const params = terminalId ? `?terminalId=${terminalId}` : '';
    const response = await api.get(`/equipment/dollies/available${params}`);
    return response.data;
  },

  // Get dolly by ID
  getDollyById: async (id: number): Promise<EquipmentDolly> => {
    const response = await api.get(`/equipment/dollies/${id}`);
    return response.data;
  },

  // Create dolly
  createDolly: async (data: Partial<EquipmentDolly>): Promise<EquipmentDolly> => {
    const response = await api.post('/equipment/dollies', data);
    return response.data;
  },

  // Update dolly
  updateDolly: async (id: number, data: Partial<EquipmentDolly>): Promise<EquipmentDolly> => {
    const response = await api.put(`/equipment/dollies/${id}`, data);
    return response.data;
  },

  // Delete dolly
  deleteDolly: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/equipment/dollies/${id}`);
    return response.data;
  },

  // Update dolly status
  updateDollyStatus: async (id: number, status: EquipmentStatus, notes?: string): Promise<EquipmentDolly> => {
    const response = await api.patch(`/equipment/dollies/${id}/status`, { status, notes });
    return response.data;
  },

  // Update dolly location
  updateDollyLocation: async (id: number, location: LocationUpdate): Promise<EquipmentDolly> => {
    const response = await api.patch(`/equipment/dollies/${id}/location`, location);
    return response.data;
  }
};
