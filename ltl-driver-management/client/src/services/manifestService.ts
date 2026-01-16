import { api } from './api';
import {
  Manifest,
  ManifestShipment,
  ManifestsResponse,
  ManifestStatus,
  TransferShipmentRequest,
  HazmatBOLRequest
} from '../types';

interface ManifestFilters {
  search?: string;
  status?: ManifestStatus;
  tripId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const manifestService = {
  // Get all manifests with filtering
  getManifests: async (filters?: ManifestFilters): Promise<ManifestsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tripId) params.append('tripId', filters.tripId.toString());
    if (filters?.originTerminalId) params.append('originTerminalId', filters.originTerminalId.toString());
    if (filters?.destinationTerminalId) params.append('destinationTerminalId', filters.destinationTerminalId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/manifests?${params.toString()}`);
    return response.data;
  },

  // Get manifest by ID
  getManifestById: async (id: number): Promise<Manifest> => {
    const response = await api.get(`/manifests/${id}`);
    return response.data;
  },

  // Get manifest by number
  getManifestByNumber: async (manifestNumber: string): Promise<Manifest> => {
    const response = await api.get(`/manifests/number/${manifestNumber}`);
    return response.data;
  },

  // Get manifest shipments
  getManifestShipments: async (manifestId: number): Promise<ManifestShipment[]> => {
    const response = await api.get(`/manifests/${manifestId}/shipments`);
    return response.data;
  },

  // Create manifest
  createManifest: async (data: Partial<Manifest>): Promise<Manifest> => {
    const response = await api.post('/manifests', data);
    return response.data;
  },

  // Update manifest
  updateManifest: async (id: number, data: Partial<Manifest>): Promise<Manifest> => {
    const response = await api.put(`/manifests/${id}`, data);
    return response.data;
  },

  // Close manifest
  closeManifest: async (id: number, sealNumber?: string): Promise<Manifest> => {
    const response = await api.patch(`/manifests/${id}/close`, { sealNumber });
    return response.data;
  },

  // Add shipment to manifest
  addShipment: async (manifestId: number, shipment: Partial<ManifestShipment>): Promise<ManifestShipment> => {
    const response = await api.post(`/manifests/${manifestId}/shipments`, shipment);
    return response.data;
  },

  // Remove shipment from manifest
  removeShipment: async (manifestId: number, shipmentId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/manifests/${manifestId}/shipments/${shipmentId}`);
    return response.data;
  },

  // Transfer shipments between manifests
  transferShipments: async (request: TransferShipmentRequest): Promise<{ message: string; manifest?: Manifest }> => {
    const response = await api.post('/manifests/transfer', request);
    return response.data;
  },

  // Print Hazmat BOL
  printHazmatBOL: async (request: HazmatBOLRequest): Promise<{ message: string; jobId?: string }> => {
    const response = await api.post('/manifests/hazmat-bol/print', request);
    return response.data;
  },

  // Download Hazmat BOL as PDF
  downloadHazmatBOL: async (request: HazmatBOLRequest): Promise<Blob> => {
    const response = await api.post('/manifests/hazmat-bol/download', request, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get manifests for a specific trip
  getManifestsByTrip: async (tripId: number): Promise<Manifest[]> => {
    const response = await api.get(`/manifests/trip/${tripId}`);
    return response.data;
  },

  // Get open manifests (for dispatch)
  getOpenManifests: async (terminalId?: number): Promise<Manifest[]> => {
    const params = new URLSearchParams();
    params.append('status', 'OPEN');
    if (terminalId) params.append('originTerminalId', terminalId.toString());

    const response = await api.get(`/manifests?${params.toString()}`);
    return response.data.manifests || response.data;
  },

  // Get hazmat shipments on manifest
  getHazmatShipments: async (manifestId: number): Promise<ManifestShipment[]> => {
    const response = await api.get(`/manifests/${manifestId}/shipments?hazmat=true`);
    return response.data;
  }
};
