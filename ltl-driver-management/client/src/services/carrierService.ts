import { api } from './api';
import { Carrier } from '../types';

interface CarriersResponse {
  carriers: Carrier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface CarrierFilters {
  status?: string;
  onboardingComplete?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const carrierService = {
  // Get all carriers with filtering
  getCarriers: async (filters?: CarrierFilters): Promise<CarriersResponse> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.onboardingComplete !== undefined) {
      params.append('onboardingComplete', filters.onboardingComplete.toString());
    }
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/carriers?${params.toString()}`);
    return response.data;
  },

  // Get carrier by ID
  getCarrierById: async (id: number): Promise<Carrier> => {
    const response = await api.get(`/carriers/${id}`);
    return response.data;
  },

  // Search carriers
  searchCarriers: async (query: string): Promise<Carrier[]> => {
    const response = await api.get(`/carriers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Get monitored carriers from MyCarrierPackets
  getMonitoredCarriers: async (pageNumber = 1, pageSize = 2500) => {
    const response = await api.get(`/carriers/mcp/monitored`, {
      params: { pageNumber, pageSize }
    });
    return response.data;
  },

  // Sync monitored carriers with local database
  syncMonitoredCarriers: async () => {
    const response = await api.get(`/carriers/mcp/monitored`);
    return response.data;
  },

  // Batch update all carriers from MyCarrierPackets
  batchUpdateCarriers: async (): Promise<{
    success: boolean;
    summary: {
      processed: number;
      updated: number;
      errors: number;
      timestamp: Date;
    };
    details: Array<{
      dotNumber: string;
      status: 'updated' | 'error';
      message?: string;
    }>;
  }> => {
    const response = await api.post(`/carriers/mcp/batch-update`);
    return response.data;
  },

  // Request insurance certificate from carrier
  requestInsuranceCertificate: async (
    carrierId: number,
    options?: {
      sendEmail?: boolean;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    carrier: {
      id: number;
      name: string;
      dotNumber: string;
      mcNumber: string;
    };
    requestUrl: string;
    emailSent: boolean;
  }> => {
    const response = await api.post(`/carriers/${carrierId}/mcp/request-insurance`, options || {});
    return response.data;
  },

  // Check completed packets
  checkCompletedPackets: async (options?: {
    fromDate?: string;
    toDate?: string;
    sync?: boolean;
  }): Promise<{
    success: boolean;
    mode: 'check' | 'sync';
    dateRange: {
      from: string;
      to: string;
    };
    // For check mode
    totalCount?: number;
    packets?: Array<{
      dotNumber: string;
      mcNumber?: string;
      carrierName: string;
      completedAt: string;
    }>;
    // For sync mode
    summary?: {
      checked: number;
      synced: number;
      newPackets: number;
      errors: number;
      timestamp: Date;
    };
    details?: Array<{
      dotNumber: string;
      carrierName: string;
      status: 'synced' | 'new' | 'error';
      message?: string;
    }>;
  }> => {
    const params = new URLSearchParams();
    if (options?.fromDate) params.append('fromDate', options.fromDate);
    if (options?.toDate) params.append('toDate', options.toDate);
    if (options?.sync !== undefined) params.append('sync', options.sync.toString());

    const response = await api.get(`/carriers/mcp/completed-packets?${params.toString()}`);
    return response.data;
  },

  // Sync documents from MCP
  syncDocuments: async (carrierId: number): Promise<{
    success: boolean;
    message: string;
    carrier: {
      id: number;
      name: string;
      dotNumber: string;
    };
    summary: {
      downloaded: number;
      failed: number;
    };
    documents: Array<{
      type: string;
      fileName: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> => {
    const response = await api.post(`/carriers/${carrierId}/mcp/sync-documents`);
    return response.data;
  },

  // Get MCP document download URL
  getMCPDocumentUrl: (blobName: string, carrierId?: number) => {
    const baseUrl = `/api/carriers/mcp/document/${encodeURIComponent(blobName)}`;
    return carrierId ? `${baseUrl}?carrierId=${carrierId}` : baseUrl;
  }
};