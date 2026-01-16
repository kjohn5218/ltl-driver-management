import { api } from './api';
import { PayPeriod, TripPay, PayPeriodStatus, TripPayStatus, PayPeriodsResponse, TripPaysResponse } from '../types';

interface PayPeriodFilters {
  status?: PayPeriodStatus;
  year?: number;
  page?: number;
  limit?: number;
}

interface TripPayFilters {
  driverId?: number;
  carrierId?: number;
  status?: TripPayStatus;
  page?: number;
  limit?: number;
}

interface DriverPaySummary {
  driverId: number;
  driverName: string;
  payPeriod?: {
    id: number;
    periodStart: string;
    periodEnd: string;
  };
  tripCount: number;
  totalMiles: number;
  basePay: number;
  accessorialPay: number;
  bonusPay: number;
  deductions: number;
  totalPay: number;
  trips: Array<{
    id: number;
    tripNumber: string;
    dispatchDate: string;
    basePay: number;
    accessorialPay: number;
    status: TripPayStatus;
  }>;
}

export const payrollService = {
  // ==================== PAY PERIODS ====================

  // Get all pay periods with filtering
  getPayPeriods: async (filters?: PayPeriodFilters): Promise<PayPeriodsResponse> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/payroll/pay-periods?${params.toString()}`);
    return response.data;
  },

  // Get current/open pay period
  getCurrentPayPeriod: async (): Promise<PayPeriod | null> => {
    const response = await api.get('/payroll/pay-periods/current');
    return response.data;
  },

  // Get pay period by ID
  getPayPeriodById: async (id: number): Promise<PayPeriod> => {
    const response = await api.get(`/payroll/pay-periods/${id}`);
    return response.data;
  },

  // Create pay period
  createPayPeriod: async (data: {
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }): Promise<PayPeriod> => {
    const response = await api.post('/payroll/pay-periods', data);
    return response.data;
  },

  // Update pay period status
  updatePayPeriodStatus: async (id: number, status: PayPeriodStatus, notes?: string): Promise<PayPeriod> => {
    const response = await api.patch(`/payroll/pay-periods/${id}/status`, { status, notes });
    return response.data;
  },

  // Export pay period
  exportPayPeriod: async (id: number, format: 'json' | 'csv' = 'json'): Promise<Blob | object> => {
    const response = await api.get(`/payroll/pay-periods/${id}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  },

  // ==================== TRIP PAY ====================

  // Get trip pays for a pay period
  getTripPays: async (payPeriodId: number, filters?: TripPayFilters): Promise<TripPaysResponse> => {
    const params = new URLSearchParams();
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/payroll/pay-periods/${payPeriodId}/trip-pays?${params.toString()}`);
    return response.data;
  },

  // Get trip pay by ID
  getTripPayById: async (id: number): Promise<TripPay> => {
    const response = await api.get(`/payroll/trip-pays/${id}`);
    return response.data;
  },

  // Calculate pay for a trip
  calculateTripPay: async (tripId: number): Promise<TripPay> => {
    const response = await api.post(`/payroll/trips/${tripId}/calculate-pay`);
    return response.data;
  },

  // Update trip pay status
  updateTripPayStatus: async (id: number, data: {
    status: TripPayStatus;
    notes?: string;
    bonusPay?: number;
    deductions?: number;
  }): Promise<TripPay> => {
    const response = await api.patch(`/payroll/trip-pays/${id}/status`, data);
    return response.data;
  },

  // Bulk approve trip pays
  bulkApproveTripPays: async (tripPayIds: number[]): Promise<{ approved: number; failed: number }> => {
    const response = await api.post('/payroll/trip-pays/bulk-approve', { tripPayIds });
    return response.data;
  },

  // Get driver pay summary
  getDriverPaySummary: async (driverId: number, filters?: {
    payPeriodId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<DriverPaySummary> => {
    const params = new URLSearchParams();
    if (filters?.payPeriodId) params.append('payPeriodId', filters.payPeriodId.toString());
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/payroll/drivers/${driverId}/pay-summary?${params.toString()}`);
    return response.data;
  },

  // ==================== BULK OPERATIONS ====================

  // Calculate pay for all trips in a pay period
  calculateAllTripPays: async (payPeriodId: number): Promise<{
    calculated: number;
    failed: number;
    errors: Array<{ tripId: number; error: string }>;
  }> => {
    const response = await api.post(`/payroll/pay-periods/${payPeriodId}/calculate-all`);
    return response.data;
  },

  // Get payroll summary for a pay period
  getPayrollSummary: async (payPeriodId: number): Promise<{
    payPeriod: PayPeriod;
    totalDrivers: number;
    totalTrips: number;
    totalMiles: number;
    totalBasePay: number;
    totalAccessorialPay: number;
    totalBonusPay: number;
    totalDeductions: number;
    grandTotal: number;
    byStatus: Record<TripPayStatus, { count: number; amount: number }>;
  }> => {
    const response = await api.get(`/payroll/pay-periods/${payPeriodId}/summary`);
    return response.data;
  }
};
