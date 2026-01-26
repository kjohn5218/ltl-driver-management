import { api } from './api';

// Cut Pay Status
export type CutPayStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

// Trailer Configuration
export type TrailerConfig = 'SINGLE' | 'DOUBLE' | 'TRIPLE';

// Cut Pay Type
export type CutPayType = 'HOURS' | 'MILES';

// Cut Pay Request interface
export interface CutPayRequest {
  id: number;
  driverId: number;
  requestDate: string;
  tripId?: number | null;
  status: CutPayStatus;
  trailerConfig?: string | null;
  cutPayType?: CutPayType;
  hoursRequested?: number | string | null;
  milesRequested?: number | string | null;
  reason?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  rateApplied?: number | string | null;
  totalPay?: number | string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  driver?: {
    id: number;
    name: string;
    number?: string;
    carrier?: {
      id: number;
      name: string;
    };
  };
  approver?: {
    id: number;
    name: string;
  } | null;
  trip?: {
    id: number;
    tripNumber?: string;
    dispatchDate?: string;
  } | null;
}

// Create Cut Pay Request Data
export interface CreateCutPayRequestData {
  driverId: number;
  tripId?: number;
  trailerConfig?: TrailerConfig;
  cutPayType?: CutPayType;
  hoursRequested?: number;
  milesRequested?: number;
  reason?: string;
  notes?: string;
}

// Cut Pay Filters
export interface CutPayFilters {
  status?: CutPayStatus;
  driverId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Cut Pay Requests Response
export interface CutPayRequestsResponse {
  requests: CutPayRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Cut Pay Stats Response
export interface CutPayStatsResponse {
  totalRequests: number;
  byStatus: {
    pending: number;
    approved: number;
    rejected: number;
    paid: number;
  };
  totalPaidAmount: number | string;
  topDrivers: {
    driver: {
      id: number;
      name: string;
      number?: string;
    };
    totalPay: number | string;
    totalHours: number | string;
    requestCount: number;
  }[];
}

// Cut Pay Service
export const cutPayService = {
  // Get all cut pay requests with filtering
  getCutPayRequests: async (filters?: CutPayFilters): Promise<CutPayRequestsResponse> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/cut-pay-requests?${params.toString()}`);
    return response.data;
  },

  // Get cut pay request by ID
  getCutPayRequestById: async (id: number): Promise<CutPayRequest> => {
    const response = await api.get(`/cut-pay-requests/${id}`);
    return response.data;
  },

  // Create cut pay request
  createCutPayRequest: async (data: CreateCutPayRequestData): Promise<CutPayRequest> => {
    const response = await api.post('/cut-pay-requests', data);
    return response.data;
  },

  // Approve cut pay request
  approveCutPayRequest: async (id: number, data?: { notes?: string; rateOverride?: number }): Promise<{
    message: string;
    request: CutPayRequest;
  }> => {
    const response = await api.put(`/cut-pay-requests/${id}/approve`, data || {});
    return response.data;
  },

  // Reject cut pay request
  rejectCutPayRequest: async (id: number, data?: { notes?: string }): Promise<{
    message: string;
    request: CutPayRequest;
  }> => {
    const response = await api.put(`/cut-pay-requests/${id}/reject`, data || {});
    return response.data;
  },

  // Mark cut pay as paid
  markCutPayAsPaid: async (id: number, data?: { externalPayrollId?: string; notes?: string }): Promise<{
    message: string;
    request: CutPayRequest;
  }> => {
    const response = await api.put(`/cut-pay-requests/${id}/paid`, data || {});
    return response.data;
  },

  // Get cut pay statistics
  getCutPayStats: async (filters?: { startDate?: string; endDate?: string }): Promise<CutPayStatsResponse> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/cut-pay-requests/stats?${params.toString()}`);
    return response.data;
  }
};
