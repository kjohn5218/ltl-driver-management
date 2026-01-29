import { api } from './api';

export interface MileageEntry {
  id: number;
  originCode: string;
  destinationCode: string;
  miles: number;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MileageFilters {
  search?: string;
  active?: boolean;
  originCode?: string;
  destinationCode?: string;
  page?: number;
  limit?: number;
}

export interface MileageResponse {
  entries: MileageEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MileageLookupResult {
  miles: number | null;
  originCode: string;
  destinationCode: string;
  source?: string;
}

export interface BulkUpsertResult {
  message: string;
  created: number;
  updated: number;
  errors?: string[];
}

export interface AutoPopulateResult {
  message: string;
  locationsProcessed: number;
  pairsProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors?: string[];
}

export const mileageMatrixService = {
  // Get all entries with pagination and filtering
  getEntries: async (filters?: MileageFilters): Promise<MileageResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.originCode) params.append('originCode', filters.originCode);
    if (filters?.destinationCode) params.append('destinationCode', filters.destinationCode);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/mileage-matrix?${params.toString()}`);
    return response.data;
  },

  // Lookup miles for a specific origin-destination pair
  lookupMiles: async (origin: string, destination: string): Promise<MileageLookupResult> => {
    try {
      const response = await api.get(`/mileage-matrix/lookup?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
      return response.data;
    } catch (error: any) {
      // Return null miles if not found (404)
      if (error.response?.status === 404) {
        return {
          miles: null,
          originCode: origin,
          destinationCode: destination
        };
      }
      throw error;
    }
  },

  // Get single entry by ID
  getById: async (id: number): Promise<MileageEntry> => {
    const response = await api.get(`/mileage-matrix/${id}`);
    return response.data;
  },

  // Create a new entry
  create: async (data: {
    originCode: string;
    destinationCode: string;
    miles: number;
    notes?: string;
  }): Promise<MileageEntry> => {
    const response = await api.post('/mileage-matrix', data);
    return response.data;
  },

  // Bulk create/update entries
  bulkUpsert: async (entries: Array<{
    originCode: string;
    destinationCode: string;
    miles: number;
    notes?: string;
  }>): Promise<BulkUpsertResult> => {
    const response = await api.post('/mileage-matrix/bulk', { entries });
    return response.data;
  },

  // Update an entry
  update: async (id: number, data: Partial<{
    originCode: string;
    destinationCode: string;
    miles: number;
    notes: string;
    active: boolean;
  }>): Promise<MileageEntry> => {
    const response = await api.put(`/mileage-matrix/${id}`, data);
    return response.data;
  },

  // Delete an entry
  delete: async (id: number): Promise<void> => {
    await api.delete(`/mileage-matrix/${id}`);
  },

  // Get all unique terminal codes used in the matrix
  getTerminalCodes: async (): Promise<string[]> => {
    const response = await api.get('/mileage-matrix/terminal-codes');
    return response.data;
  },

  // Auto-populate mileage matrix from location GPS coordinates
  autoPopulate: async (options?: {
    roadFactor?: number;
    overwriteExisting?: boolean;
  }): Promise<AutoPopulateResult> => {
    const response = await api.post('/mileage-matrix/auto-populate', {
      roadFactor: options?.roadFactor || 1.3,
      overwriteExisting: options?.overwriteExisting || false
    });
    return response.data;
  }
};
