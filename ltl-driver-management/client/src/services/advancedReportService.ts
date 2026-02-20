import { api } from './api';
import { KPIDashboardData, CostPerMileData, CCFSContractReportData, EnhancedLoadFactorData, ReportFilters } from '../types/reports';

export const advancedReportService = {
  /**
   * Get KPI Dashboard data with week-over-week and YTD comparisons
   */
  getKPIDashboard: async (filters?: ReportFilters): Promise<KPIDashboardData> => {
    const params = new URLSearchParams();
    if (filters?.week) params.append('week', filters.week);
    if (filters?.year) params.append('year', filters.year.toString());

    const response = await api.get(`/reports/kpi-dashboard?${params}`);
    return response.data;
  },

  /**
   * Get Cost Per Mile analysis with breakdowns by lane and employer
   */
  getCostPerMile: async (filters?: ReportFilters): Promise<CostPerMileData> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/reports/cost-per-mile?${params}`);
    return response.data;
  },

  /**
   * Get CCFS vs Contract monthly comparison data
   */
  getCCFSContractMonthly: async (months?: number): Promise<CCFSContractReportData> => {
    const params = new URLSearchParams();
    if (months) params.append('months', months.toString());

    const response = await api.get(`/reports/ccfs-vs-contract-monthly?${params}`);
    return response.data;
  },

  /**
   * Get Enhanced Load Factor analysis with variance tracking
   */
  getEnhancedLoadFactor: async (filters?: ReportFilters): Promise<EnhancedLoadFactorData> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/reports/load-factor-enhanced?${params}`);
    return response.data;
  },
};

export default advancedReportService;
