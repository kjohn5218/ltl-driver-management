import { api } from './api';
import { LinehaulTrip, TripStatus, TripsResponse, TripArrivalData, DriverTripReport, EquipmentIssue } from '../types';

interface TripFilters {
  search?: string;
  status?: TripStatus;
  statuses?: TripStatus[];  // Multiple status filter
  profileId?: number;
  driverId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  date?: string;  // Single date filter
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
  actualDeparture?: string;
  actualArrival?: string;
  actualMiles?: number;
}

export const linehaulTripService = {
  // Get all trips with filtering
  getTrips: async (filters?: TripFilters): Promise<TripsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    // Support multiple statuses filter
    if (filters?.statuses && filters.statuses.length > 0) {
      params.append('statuses', filters.statuses.join(','));
    }
    if (filters?.profileId) params.append('profileId', filters.profileId.toString());
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.originTerminalId) params.append('originTerminalId', filters.originTerminalId.toString());
    if (filters?.destinationTerminalId) params.append('destinationTerminalId', filters.destinationTerminalId.toString());
    // Single date filter - use as both start and end date
    if (filters?.date) {
      params.append('startDate', filters.date);
      params.append('endDate', filters.date);
    } else {
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
    }
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
  },

  // Get ETA for a single trip
  getTripEta: async (tripId: number): Promise<EtaResult> => {
    const response = await api.get(`/linehaul-trips/${tripId}/eta`);
    return response.data;
  },

  // Get ETA for multiple trips (batch)
  getTripEtaBatch: async (tripIds: number[]): Promise<{ etas: Record<number, EtaResult> }> => {
    const response = await api.post('/linehaul-trips/eta/batch', { tripIds });
    return response.data;
  },

  // Get vehicle location from GoMotive API
  getVehicleLocation: async (vehicleId: string): Promise<VehicleLocationResult> => {
    const response = await api.get(`/linehaul-trips/vehicle-location/${vehicleId}`);
    return response.data;
  },

  // Submit arrival details and create driver trip report
  submitArrival: async (tripId: number, arrivalData: TripArrivalData): Promise<ArrivalResponse> => {
    const response = await api.post(`/linehaul-trips/${tripId}/arrive`, arrivalData);
    return response.data;
  },

  // Get driver trip report for a trip
  getDriverReport: async (tripId: number): Promise<DriverTripReport> => {
    const response = await api.get(`/linehaul-trips/${tripId}/driver-report`);
    return response.data;
  },

  // Get equipment issues for a trip
  getEquipmentIssues: async (tripId: number): Promise<EquipmentIssue[]> => {
    const response = await api.get(`/linehaul-trips/${tripId}/equipment-issues`);
    return response.data;
  },

  // Check driver arrival count in last 24 hours
  checkDriverArrivalCount: async (driverId: number): Promise<DriverArrivalCountResult> => {
    const response = await api.get(`/linehaul-trips/driver/${driverId}/arrival-count`);
    return response.data;
  },

  // Save morale rating
  saveMoraleRating: async (data: SaveMoraleRatingRequest): Promise<MoraleRating> => {
    const response = await api.post('/linehaul-trips/morale-rating', data);
    return response.data;
  },

  // Get morale report
  getMoraleReport: async (filters?: MoraleReportFilters): Promise<MoraleReportResponse> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/linehaul-trips/reports/morale?${params.toString()}`);
    return response.data;
  }
};

export interface EtaResult {
  estimatedArrival: string | null;
  source: 'GPS' | 'PROFILE' | 'NONE';
  distanceRemaining?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface VehicleLocationResult {
  vehicleId: string;
  unitNumber: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    speed?: number;
    heading?: number;
    timestamp?: string;
  };
  error?: string;
}

export interface ArrivalResponse {
  message: string;
  trip: LinehaulTrip;
  driverReport: DriverTripReport;
  equipmentIssue?: EquipmentIssue | null;
}

export interface DriverArrivalCountResult {
  driverId: number;
  arrivalCount: number;
  isSecondArrival: boolean;
}

export interface SaveMoraleRatingRequest {
  tripId: number;
  driverId: number;
  rating: number;
}

export interface MoraleRating {
  id: number;
  tripId: number;
  driverId: number;
  rating: number;
  arrivedAt: string;
  createdAt: string;
  driver?: {
    id: number;
    name: string;
  };
}

export interface MoraleReportFilters {
  startDate?: string;
  endDate?: string;
  driverId?: number;
  page?: number;
  limit?: number;
}

export interface MoraleReportResponse {
  ratings: Array<MoraleRating & {
    trip?: {
      tripNumber: string;
      linehaulProfile?: {
        originTerminal?: { code: string };
        destinationTerminal?: { code: string };
      };
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    averageRating: number | null;
    totalRatings: number;
    ratingDistribution: Record<number, number>;
    driverAverages: Array<{
      driverId: number;
      driverName: string;
      averageRating: number | null;
      ratingCount: number;
    }>;
  };
}
