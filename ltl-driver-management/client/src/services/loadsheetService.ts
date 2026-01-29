import { api } from './api';
import {
  Loadsheet,
  LoadsheetsResponse,
  LoadsheetFilters,
  CreateLoadsheetRequest,
  LoadsheetStatus,
  CheckDuplicateLoadsheetsRequest,
  CheckDuplicateLoadsheetsResponse,
  ManifestFreightItem
} from '../types';

// Response type for loadsheet shipments
export interface LoadsheetShipmentsResponse {
  loadsheetId: number;
  manifestNumber: string;
  shipments: ManifestFreightItem[];
  totalPieces: number;
  totalWeight: number;
  hazmatCount: number;
}

export const loadsheetService = {
  // Get all loadsheets with filtering
  getLoadsheets: async (filters?: LoadsheetFilters): Promise<LoadsheetsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.linehaulTripId) params.append('linehaulTripId', filters.linehaulTripId.toString());
    if (filters?.originTerminalId) params.append('originTerminalId', filters.originTerminalId.toString());
    if (filters?.originTerminalCode) params.append('originTerminalCode', filters.originTerminalCode);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/loadsheets?${params.toString()}`);
    return response.data;
  },

  // Get loadsheet by ID
  getLoadsheetById: async (id: number): Promise<Loadsheet> => {
    const response = await api.get(`/loadsheets/${id}`);
    return response.data;
  },

  // Get loadsheet by manifest number
  getLoadsheetByManifest: async (manifestNumber: string): Promise<Loadsheet> => {
    const response = await api.get(`/loadsheets/manifest/${manifestNumber}`);
    return response.data;
  },

  // Create new loadsheet
  createLoadsheet: async (data: CreateLoadsheetRequest): Promise<Loadsheet> => {
    const response = await api.post('/loadsheets', data);
    return response.data;
  },

  // Update loadsheet
  updateLoadsheet: async (id: number, data: Partial<CreateLoadsheetRequest> & { status?: LoadsheetStatus }): Promise<Loadsheet> => {
    const response = await api.put(`/loadsheets/${id}`, data);
    return response.data;
  },

  // Close loadsheet
  closeLoadsheet: async (id: number, sealNumber?: string): Promise<Loadsheet> => {
    const response = await api.patch(`/loadsheets/${id}/close`, { sealNumber });
    return response.data;
  },

  // Download loadsheet as PDF
  downloadLoadsheet: async (id: number): Promise<Blob> => {
    const response = await api.get(`/loadsheets/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Delete loadsheet (draft only)
  deleteLoadsheet: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/loadsheets/${id}`);
    return response.data;
  },

  // Check for duplicate loadsheets (same trailer, location, within 4 days, not DISPATCHED or CLOSED)
  checkDuplicateLoadsheets: async (data: CheckDuplicateLoadsheetsRequest): Promise<CheckDuplicateLoadsheetsResponse> => {
    const response = await api.post('/loadsheets/check-duplicates', data);
    return response.data;
  },

  // Get shipments loaded to a loadsheet
  getLoadsheetShipments: async (loadsheetId: number): Promise<LoadsheetShipmentsResponse> => {
    const response = await api.get(`/loadsheets/${loadsheetId}/shipments`);
    return response.data;
  }
};
