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

// FormsApp Sync Types
interface SyncResultItem {
  created: number;
  updated: number;
  errors: string[];
  total: number;
}

interface SyncResult {
  success: boolean;
  message: string;
  trucks?: SyncResultItem;
  trailers?: SyncResultItem;
  dollies?: SyncResultItem;
}

interface SyncStatus {
  configured: boolean;
  message?: string;
  lastSyncAt?: string;
  lastResult?: {
    trucks: SyncResultItem;
    trailers: SyncResultItem;
    dollies: SyncResultItem;
    summary: string;
  };
}

// Motive GPS Location Types
export interface VehicleLocationData {
  unitNumber: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number;
  locatedAt: string;
  description: string;
  odometer: number;
  fuelPercentage: number | null;
  currentDriverName: string | null;
  currentDriverId: string | null;
}

// Equipment Allocation Types
export interface InboundEquipment {
  equipmentType: string;
  unitNumber: string;
  tripId: number;
  tripNumber: string;
}

export interface TerminalAllocationData {
  id: number;
  code: string;
  name: string;
  targets: Record<string, number>;
  current: Record<string, number>;
  dispatched: Record<string, number>;
  inbound: InboundEquipment[];
  inboundCounts: Record<string, number>;
  variance: Record<string, number>;
}

export interface AllocationSummaryResponse {
  terminals: TerminalAllocationData[];
  equipmentTypes: string[];
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
  },

  // ==================== FORMSAPP SYNC ====================

  // Sync all equipment from FormsApp
  syncAllEquipment: async (): Promise<SyncResult> => {
    const response = await api.post('/equipment/sync');
    return response.data;
  },

  // Sync trucks only from FormsApp
  syncTrucks: async (): Promise<SyncResult> => {
    const response = await api.post('/equipment/trucks/sync');
    return response.data;
  },

  // Sync trailers only from FormsApp
  syncTrailers: async (): Promise<SyncResult> => {
    const response = await api.post('/equipment/trailers/sync');
    return response.data;
  },

  // Sync dollies only from FormsApp
  syncDollies: async (): Promise<SyncResult> => {
    const response = await api.post('/equipment/dollies/sync');
    return response.data;
  },

  // Get sync status
  getSyncStatus: async (): Promise<SyncStatus> => {
    const response = await api.get('/equipment/sync/status');
    return response.data;
  },

  // ==================== MOTIVE GPS TRACKING ====================

  // Get truck location from Motive
  getTruckLocation: async (unitNumber: string): Promise<VehicleLocationData | null> => {
    const response = await api.get(`/equipment/trucks/${encodeURIComponent(unitNumber)}/location`);
    return response.data.location || null;
  },

  // Get all vehicle locations
  getAllVehicleLocations: async (): Promise<VehicleLocationData[]> => {
    const response = await api.get('/equipment/locations');
    return response.data;
  },

  // Sync vehicle locations from Motive
  syncVehicleLocations: async (): Promise<{ success: boolean; message: string; result?: any }> => {
    const response = await api.post('/equipment/locations/sync');
    return response.data;
  },

  // ==================== EQUIPMENT ALLOCATION ====================

  // Get allocation summary for all terminals
  getAllocationSummary: async (): Promise<AllocationSummaryResponse> => {
    const response = await api.get('/equipment/allocation/summary');
    return response.data;
  },

  // Get allocation targets for a specific terminal
  getTerminalAllocations: async (terminalId: number): Promise<{ terminalId: number; allocations: Record<string, number>; equipmentTypes: string[] }> => {
    const response = await api.get(`/equipment/allocation/terminal/${terminalId}`);
    return response.data;
  },

  // Update allocation targets for a terminal
  updateTerminalAllocations: async (terminalId: number, allocations: Record<string, number>): Promise<{ message: string; updated: number }> => {
    const response = await api.put(`/equipment/allocation/terminal/${terminalId}`, { allocations });
    return response.data;
  }
};
