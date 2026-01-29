import { api } from './api';

// Workday Paycode interface
export interface WorkdayPaycode {
  id: number;
  code: string;
  workdayId: string;
  description: string;
  payType: string;
  trailerConfig?: string | null;
  isCutPay: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Driver Rate Info from Workday
export interface WorkdayDriverRateInfo {
  driver: {
    id: number;
    name: string;
    number?: string;
    workdayEmployeeId: string;
    lastSync?: string | null;
  };
  rateInfo: {
    employeeId: string;
    payRates: {
      singleMiles: number;
      doubleMiles: number;
      tripleMiles: number;
      singleCutMiles: number;
      doubleCutMiles: number;
      tripleCutMiles: number;
      dropHookSingle: number;
      dropHookDouble: number;
      dropHookTriple: number;
      chainUp: number;
      stopHours: number;
    };
    lastUpdated: string;
  };
}

// Workday Sync Status
export interface WorkdaySyncStatus {
  totalDrivers: number;
  driversWithWorkdayId: number;
  driversWithoutWorkdayId: number;
  recentlySynced: number;
  lastSyncTime: string | null;
}

// Sync Result
export interface WorkdaySyncResult {
  message: string;
  synced: number;
  errors: {
    driverId: number;
    name: string;
    error: string;
  }[];
}

// Workday Service
export const workdayService = {
  // Get all Workday paycodes
  getPaycodes: async (filters?: {
    payType?: string;
    trailerConfig?: string;
    isCutPay?: boolean;
    active?: boolean;
  }): Promise<WorkdayPaycode[]> => {
    const params = new URLSearchParams();
    if (filters?.payType) params.append('payType', filters.payType);
    if (filters?.trailerConfig) params.append('trailerConfig', filters.trailerConfig);
    if (filters?.isCutPay !== undefined) params.append('isCutPay', filters.isCutPay.toString());
    if (filters?.active !== undefined) params.append('active', filters.active.toString());

    const response = await api.get(`/workday/paycodes?${params.toString()}`);
    return response.data;
  },

  // Get paycode mapping for specific pay type and trailer config
  getPaycodeMapping: async (params: {
    payType?: string;
    trailerConfig?: string;
    isCutPay?: boolean;
  }): Promise<WorkdayPaycode> => {
    const searchParams = new URLSearchParams();
    if (params.payType) searchParams.append('payType', params.payType);
    if (params.trailerConfig) searchParams.append('trailerConfig', params.trailerConfig);
    if (params.isCutPay !== undefined) searchParams.append('isCutPay', params.isCutPay.toString());

    const response = await api.get(`/workday/paycodes/mapping?${searchParams.toString()}`);
    return response.data;
  },

  // Get driver rate info from Workday
  getDriverRateInfo: async (driverId: number): Promise<WorkdayDriverRateInfo> => {
    const response = await api.get(`/workday/driver/${driverId}/rates`);
    return response.data;
  },

  // Update driver Workday Employee ID
  updateDriverWorkdayId: async (driverId: number, workdayEmployeeId: string | null): Promise<{
    id: number;
    name: string;
    number?: string;
    workdayEmployeeId: string | null;
    workdayLastSync: string | null;
  }> => {
    const response = await api.put(`/workday/driver/${driverId}/workday-id`, { workdayEmployeeId });
    return response.data;
  },

  // Sync driver rates from Workday
  syncDriverRates: async (driverIds?: number[]): Promise<WorkdaySyncResult> => {
    const response = await api.post('/workday/sync', { driverIds });
    return response.data;
  },

  // Get Workday sync status
  getSyncStatus: async (): Promise<WorkdaySyncStatus> => {
    const response = await api.get('/workday/sync-status');
    return response.data;
  }
};
