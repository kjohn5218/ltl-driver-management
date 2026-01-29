import { api } from './api';

export type LateReasonType =
  | 'PRE_LOAD'
  | 'DOCK_ISSUE'
  | 'STAFFING'
  | 'DRIVER_ISSUE'
  | 'WEATHER'
  | 'LATE_INBOUND'
  | 'DISPATCH_ISSUE';

export const LATE_REASON_LABELS: Record<LateReasonType, string> = {
  PRE_LOAD: 'Pre-load',
  DOCK_ISSUE: 'Dock Issue',
  STAFFING: 'Staffing',
  DRIVER_ISSUE: 'Driver Issue',
  WEATHER: 'Weather',
  LATE_INBOUND: 'Late Inbound',
  DISPATCH_ISSUE: 'Dispatch Issue'
};

export interface LateDepartureReason {
  id: number;
  tripId: number;
  reason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  scheduledDepartTime?: string;
  actualDepartTime?: string;
  minutesLate?: number;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  trip?: {
    id: number;
    tripNumber: string;
    dispatchDate: string;
    status: string;
    linehaulProfile?: {
      profileCode: string;
      name: string;
      originTerminal?: { code: string };
      destinationTerminal?: { code: string };
    };
    driver?: { name: string };
  };
  accountableTerminal?: {
    id: number;
    code: string;
    name: string;
  };
  creator?: {
    id: number;
    name: string;
  };
}

export interface LateDepartureReasonFilters {
  reason?: LateReasonType;
  willCauseServiceFailure?: boolean;
  accountableTerminalId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface LateDepartureReasonsResponse {
  reasons: LateDepartureReason[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateLateDepartureReasonRequest {
  tripId: number;
  reason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  scheduledDepartTime?: string;
  actualDepartTime?: string;
  minutesLate?: number;
}

export interface LateDepartureReasonStats {
  total: number;
  byReason: Array<{ reason: LateReasonType; count: number }>;
  byServiceFailure: Array<{ willCauseServiceFailure: boolean; count: number }>;
  byTerminal: Array<{ terminalId: number; terminalCode: string; count: number }>;
  avgMinutesLate: number | null;
}

export const lateDepartureReasonService = {
  // Get all late departure reasons with filters
  getLateDepartureReasons: async (filters?: LateDepartureReasonFilters): Promise<LateDepartureReasonsResponse> => {
    const params = new URLSearchParams();
    if (filters?.reason) params.append('reason', filters.reason);
    if (filters?.willCauseServiceFailure !== undefined) params.append('willCauseServiceFailure', String(filters.willCauseServiceFailure));
    if (filters?.accountableTerminalId) params.append('accountableTerminalId', String(filters.accountableTerminalId));
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await api.get(`/late-departure-reasons?${params.toString()}`);
    return response.data;
  },

  // Get late departure reason by trip ID
  getByTripId: async (tripId: number): Promise<LateDepartureReason> => {
    const response = await api.get(`/late-departure-reasons/trip/${tripId}`);
    return response.data;
  },

  // Create new late departure reason
  create: async (data: CreateLateDepartureReasonRequest): Promise<LateDepartureReason> => {
    const response = await api.post('/late-departure-reasons', data);
    return response.data;
  },

  // Update late departure reason
  update: async (id: number, data: Partial<CreateLateDepartureReasonRequest>): Promise<LateDepartureReason> => {
    const response = await api.put(`/late-departure-reasons/${id}`, data);
    return response.data;
  },

  // Delete late departure reason
  delete: async (id: number): Promise<void> => {
    await api.delete(`/late-departure-reasons/${id}`);
  },

  // Get statistics
  getStats: async (startDate?: string, endDate?: string): Promise<LateDepartureReasonStats> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/late-departure-reasons/stats?${params.toString()}`);
    return response.data;
  }
};
