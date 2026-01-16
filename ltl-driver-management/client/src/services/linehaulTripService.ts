import { api } from './api';
import { LinehaulTrip, TripStatus, TripsResponse } from '../types';

interface TripFilters {
  search?: string;
  status?: TripStatus;
  profileId?: number;
  driverId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface TripAssignment {
  driverId?: number;
  coDriverId?: number;
  truckId?: number;
  trailer1Id?: number;
  trailer2Id?: number;
  dollyId?: number;
}

interface StatusUpdate {
  status: TripStatus;
  notes?: string;
  actualDepartureTime?: string;
  actualArrivalTime?: string;
  actualMiles?: number;
}

export const linehaulTripService = {
  // Get all trips with filtering
  getTrips: async (filters?: TripFilters): Promise<TripsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.profileId) params.append('profileId', filters.profileId.toString());
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.originTerminalId) params.append('originTerminalId', filters.originTerminalId.toString());
    if (filters?.destinationTerminalId) params.append('destinationTerminalId', filters.destinationTerminalId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/linehaul-trips?${params.toString()}`);
    return response.data;
  },

  // Get trips for dispatch board (date range view)
  getTripsForDispatch: async (startDate: string, endDate: string, profileId?: number): Promise<LinehaulTrip[]> => {
    const params = new URLSearchParams({ startDate, endDate });
    if (profileId) params.append('profileId', profileId.toString());

    const response = await api.get(`/linehaul-trips/dispatch?${params.toString()}`);
    return response.data;
  },

  // Get trip by ID
  getTripById: async (id: number): Promise<LinehaulTrip> => {
    const response = await api.get(`/linehaul-trips/${id}`);
    return response.data;
  },

  // Get trip by number
  getTripByNumber: async (tripNumber: string): Promise<LinehaulTrip> => {
    const response = await api.get(`/linehaul-trips/number/${tripNumber}`);
    return response.data;
  },

  // Create trip
  createTrip: async (data: Partial<LinehaulTrip>): Promise<LinehaulTrip> => {
    const response = await api.post('/linehaul-trips', data);
    return response.data;
  },

  // Update trip
  updateTrip: async (id: number, data: Partial<LinehaulTrip>): Promise<LinehaulTrip> => {
    const response = await api.put(`/linehaul-trips/${id}`, data);
    return response.data;
  },

  // Delete trip
  deleteTrip: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/linehaul-trips/${id}`);
    return response.data;
  },

  // Assign driver and equipment to trip
  assignTrip: async (id: number, assignment: TripAssignment): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/assign`, assignment);
    return response.data;
  },

  // Update trip status
  updateTripStatus: async (id: number, statusUpdate: StatusUpdate): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/status`, statusUpdate);
    return response.data;
  },

  // Dispatch trip (mark as dispatched)
  dispatchTrip: async (id: number, notes?: string): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/dispatch`, { notes });
    return response.data;
  },

  // Start trip (mark as in transit)
  startTrip: async (id: number, actualDepartureTime?: string): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/start`, { actualDepartureTime });
    return response.data;
  },

  // Complete trip
  completeTrip: async (id: number, actualArrivalTime?: string, actualMiles?: number): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/complete`, { actualArrivalTime, actualMiles });
    return response.data;
  },

  // Cancel trip
  cancelTrip: async (id: number, reason: string): Promise<LinehaulTrip> => {
    const response = await api.patch(`/linehaul-trips/${id}/cancel`, { reason });
    return response.data;
  },

  // Get trips by driver
  getTripsByDriver: async (driverId: number, filters?: { startDate?: string; endDate?: string; status?: TripStatus }): Promise<LinehaulTrip[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await api.get(`/linehaul-trips/driver/${driverId}?${params.toString()}`);
    return response.data;
  },

  // Get trips by profile
  getTripsByProfile: async (profileId: number, filters?: { startDate?: string; endDate?: string; status?: TripStatus }): Promise<LinehaulTrip[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);

    const response = await api.get(`/linehaul-trips/profile/${profileId}?${params.toString()}`);
    return response.data;
  },

  // Bulk create trips from a schedule
  bulkCreateTrips: async (profileId: number, dates: string[]): Promise<LinehaulTrip[]> => {
    const response = await api.post('/linehaul-trips/bulk-create', { profileId, dates });
    return response.data;
  }
};
