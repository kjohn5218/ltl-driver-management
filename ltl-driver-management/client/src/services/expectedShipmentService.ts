import { api } from './api';
import {
  ExpectedLaneVolume,
  ExpectedShipmentDetail,
  ExpectedShipmentsResponse,
  ExpectedShipmentsSummary
} from '../types';

export interface ExpectedShipmentFilters {
  startDate?: string;
  endDate?: string;
  originTerminalCode?: string;
  destinationTerminalCode?: string;
  aggregated?: boolean;
}

export interface TMSExpectedShipmentsResponse {
  volumes: ExpectedLaneVolume[];
  summary: ExpectedShipmentsSummary;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface LaneShipmentDetailsResponse {
  lane: string;
  forecastDate: string;
  shipmentCount: number;
  details: ExpectedShipmentDetail[];
}

export interface DailySummaryResponse {
  date: string;
  totalShipments: number;
  totalPieces: number;
  totalWeight: number;
  totalTrailers: number;
  hazmatShipments: number;
  guaranteedShipments: number;
  laneCount: number;
}

export const expectedShipmentService = {
  // Get expected shipments from database
  getExpectedShipments: async (filters: ExpectedShipmentFilters = {}): Promise<ExpectedShipmentsResponse> => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.originTerminalCode) params.append('originTerminalCode', filters.originTerminalCode);
    if (filters.destinationTerminalCode) params.append('destinationTerminalCode', filters.destinationTerminalCode);

    const response = await api.get(`/expected-shipments?${params.toString()}`);
    return response.data;
  },

  // Get expected shipments from TMS (mock service)
  getExpectedShipmentsFromTMS: async (filters: ExpectedShipmentFilters = {}): Promise<TMSExpectedShipmentsResponse> => {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.originTerminalCode) params.append('originTerminalCode', filters.originTerminalCode);
    if (filters.destinationTerminalCode) params.append('destinationTerminalCode', filters.destinationTerminalCode);
    if (filters.aggregated !== undefined) params.append('aggregated', String(filters.aggregated));

    const response = await api.get(`/expected-shipments/tms?${params.toString()}`);
    return response.data;
  },

  // Get daily summary
  getDailySummary: async (date?: string): Promise<DailySummaryResponse> => {
    const params = date ? `?date=${date}` : '';
    const response = await api.get(`/expected-shipments/summary${params}`);
    return response.data;
  },

  // Get lane shipment details
  getLaneShipmentDetails: async (
    origin: string,
    destination: string,
    date: string
  ): Promise<LaneShipmentDetailsResponse> => {
    const response = await api.get(`/expected-shipments/lane/${origin}/${destination}/${date}`);
    return response.data;
  },

  // Sync from TMS
  syncFromTMS: async (): Promise<{ message: string; synced: number; errors: number; syncedAt: string }> => {
    const response = await api.post('/expected-shipments/sync');
    return response.data;
  },

  // Upsert expected shipment
  upsertExpectedShipment: async (data: Partial<ExpectedLaneVolume> & {
    forecastDate: string;
    originTerminalCode: string;
    destinationTerminalCode: string;
  }): Promise<ExpectedLaneVolume> => {
    const response = await api.put('/expected-shipments', data);
    return response.data;
  },

  // Delete expected shipments
  deleteExpectedShipments: async (filters: {
    startDate?: string;
    endDate?: string;
    originTerminalCode?: string;
  }): Promise<{ message: string; deleted: number }> => {
    const response = await api.delete('/expected-shipments', { data: filters });
    return response.data;
  }
};
