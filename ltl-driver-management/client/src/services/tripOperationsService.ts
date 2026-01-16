import { api } from './api';
import { TripShipment, TripDelay, DelayType } from '../types';

// ==================== SHIPMENTS ====================

export const tripOperationsService = {
  // Get shipments for a trip
  getTripShipments: async (tripId: number): Promise<TripShipment[]> => {
    const response = await api.get(`/trip-operations/trips/${tripId}/shipments`);
    return response.data;
  },

  // Add shipment to trip
  addShipment: async (tripId: number, data: Partial<TripShipment>): Promise<TripShipment> => {
    const response = await api.post(`/trip-operations/trips/${tripId}/shipments`, data);
    return response.data;
  },

  // Update shipment
  updateShipment: async (shipmentId: number, data: Partial<TripShipment>): Promise<TripShipment> => {
    const response = await api.put(`/trip-operations/shipments/${shipmentId}`, data);
    return response.data;
  },

  // Remove shipment from trip
  removeShipment: async (shipmentId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/trip-operations/shipments/${shipmentId}`);
    return response.data;
  },

  // Get shipment by ID
  getShipmentById: async (shipmentId: number): Promise<TripShipment> => {
    const response = await api.get(`/trip-operations/shipments/${shipmentId}`);
    return response.data;
  },

  // Get shipment by PRO number
  getShipmentByProNumber: async (proNumber: string): Promise<TripShipment> => {
    const response = await api.get(`/trip-operations/shipments/pro/${proNumber}`);
    return response.data;
  },

  // Bulk add shipments to trip
  bulkAddShipments: async (tripId: number, shipments: Partial<TripShipment>[]): Promise<TripShipment[]> => {
    const response = await api.post(`/trip-operations/trips/${tripId}/shipments/bulk`, { shipments });
    return response.data;
  },

  // ==================== DELAYS ====================

  // Get delays for a trip
  getTripDelays: async (tripId: number): Promise<TripDelay[]> => {
    const response = await api.get(`/trip-operations/trips/${tripId}/delays`);
    return response.data;
  },

  // Record a delay
  recordDelay: async (tripId: number, data: {
    delayType: DelayType;
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
    location?: string;
    description?: string;
    billable?: boolean;
  }): Promise<TripDelay> => {
    const response = await api.post(`/trip-operations/trips/${tripId}/delays`, data);
    return response.data;
  },

  // Update delay
  updateDelay: async (delayId: number, data: Partial<TripDelay>): Promise<TripDelay> => {
    const response = await api.put(`/trip-operations/delays/${delayId}`, data);
    return response.data;
  },

  // Delete delay
  deleteDelay: async (delayId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/trip-operations/delays/${delayId}`);
    return response.data;
  },

  // End a delay (set end time)
  endDelay: async (delayId: number, endTime?: string): Promise<TripDelay> => {
    const response = await api.patch(`/trip-operations/delays/${delayId}/end`, { endTime });
    return response.data;
  },

  // Get active delays for a trip
  getActiveDelays: async (tripId: number): Promise<TripDelay[]> => {
    const response = await api.get(`/trip-operations/trips/${tripId}/delays/active`);
    return response.data;
  },

  // ==================== TRIP SUMMARY ====================

  // Get trip operations summary (shipments, delays, totals)
  getTripSummary: async (tripId: number): Promise<{
    tripId: number;
    shipmentCount: number;
    totalWeight: number;
    totalPieces: number;
    delayCount: number;
    totalDelayMinutes: number;
    billableDelayMinutes: number;
  }> => {
    const response = await api.get(`/trip-operations/trips/${tripId}/summary`);
    return response.data;
  },

  // Get delays summary by type
  getDelaysSummary: async (filters?: {
    tripId?: number;
    driverId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    byType: Record<DelayType, { count: number; totalMinutes: number }>;
    total: { count: number; totalMinutes: number; billableMinutes: number };
  }> => {
    const params = new URLSearchParams();
    if (filters?.tripId) params.append('tripId', filters.tripId.toString());
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/trip-operations/delays/summary?${params.toString()}`);
    return response.data;
  }
};
