import { api } from './api';
import { RateCard, AccessorialRate, RateCardType, RateMethod, AccessorialType, LinehaulProfile } from '../types';

// Types for Pay Rules module
export interface PayRulesFilters {
  search?: string;
  type?: RateCardType;
  active?: boolean;
  driverId?: number;
  carrierId?: number;
  profileId?: number;
  page?: number;
  limit?: number;
}

export interface RateCardsResponse {
  rateCards: RateCard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DriverWithRate {
  id: number;
  name: string;
  number?: string;
  phoneNumber?: string;
  email?: string;
  active: boolean;
  carrierId: number;
  carrier?: {
    id: number;
    name: string;
  };
  rateCard: RateCard | null;
}

export interface CarrierWithRate {
  id: number;
  name: string;
  mcNumber?: string;
  status: string;
  rateCard: RateCard | null;
}

export interface ProfileWithRate extends LinehaulProfile {
  rateCard: RateCard | null;
}

export interface DriversWithRatesResponse {
  drivers: DriverWithRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CarriersWithRatesResponse {
  carriers: CarrierWithRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProfilesWithRatesResponse {
  profiles: ProfileWithRate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateRateCardData {
  rateType: RateCardType;
  entityId?: number;
  linehaulProfileId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  rateMethod: RateMethod;
  rateAmount: number;
  minimumAmount?: number;
  maximumAmount?: number;
  effectiveDate: string;
  expirationDate?: string;
  equipmentType?: string;
  priority?: boolean;
  notes?: string;
  active?: boolean;
  // Flattened pay rule fields
  autoArrive?: boolean;
  perTrip?: number;
  perCutTrip?: number;
  cutMiles?: number;
  cutMilesType?: string;
  perSingleMile?: number;
  perDoubleMile?: number;
  perTripleMile?: number;
  perWorkHour?: number;
  perStopHour?: number;
  perSingleDH?: number;
  perDoubleDH?: number;
  perTripleDH?: number;
  perChainUp?: number;
  fuelSurcharge?: number;
}

export interface UpdateRateCardData {
  // Allow updating entity linkage (to fix unlinked driver/carrier references)
  rateType?: RateCardType;
  entityId?: number | null;
  linehaulProfileId?: number | null;
  originTerminalId?: number | null;
  destinationTerminalId?: number | null;
  rateMethod?: RateMethod;
  rateAmount?: number;
  minimumAmount?: number | null;
  maximumAmount?: number | null;
  effectiveDate?: string;
  expirationDate?: string | null;
  equipmentType?: string | null;
  priority?: boolean;
  notes?: string | null;
  active?: boolean;
  // Flattened pay rule fields
  autoArrive?: boolean;
  perTrip?: number | null;
  perCutTrip?: number | null;
  cutMiles?: number | null;
  cutMilesType?: string | null;
  perSingleMile?: number | null;
  perDoubleMile?: number | null;
  perTripleMile?: number | null;
  perWorkHour?: number | null;
  perStopHour?: number | null;
  perSingleDH?: number | null;
  perDoubleDH?: number | null;
  perTripleDH?: number | null;
  perChainUp?: number | null;
  fuelSurcharge?: number | null;
}

export interface CreateAccessorialRateData {
  type: AccessorialType;
  description?: string;
  rateAmount: number;
  rateMethod?: RateMethod;
  minimumCharge?: number;
  maximumCharge?: number;
}

export interface ImportRateCardData {
  rateType: RateCardType;
  entityId?: number;
  linehaulProfileId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
  rateMethod: RateMethod;
  rateAmount: number;
  minimumAmount?: number;
  maximumAmount?: number;
  effectiveDate: string;
  expirationDate?: string;
  equipmentType?: string;
  priority?: boolean;
  externalRateId?: string;
  notes?: string;
  active?: boolean;
  // Flattened pay rule fields
  autoArrive?: boolean;
  perTrip?: number;
  perCutTrip?: number;
  cutMiles?: number;
  cutMilesType?: string;
  perSingleMile?: number;
  perDoubleMile?: number;
  perTripleMile?: number;
  perWorkHour?: number;
  perStopHour?: number;
  perSingleDH?: number;
  perDoubleDH?: number;
  perTripleDH?: number;
  perChainUp?: number;
  fuelSurcharge?: number;
  accessorialRates?: CreateAccessorialRateData[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  results: {
    created: number;
    updated: number;
    errors: { index: number; error: string }[];
  };
}

// Pay Rules Service
export const payRulesService = {
  // Get all rate cards with filtering
  getRateCards: async (filters?: PayRulesFilters): Promise<RateCardsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.driverId) params.append('driverId', filters.driverId.toString());
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.profileId) params.append('profileId', filters.profileId.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/rate-cards?${params.toString()}`);
    return response.data;
  },

  // Get rate card by ID
  getRateCardById: async (id: number): Promise<RateCard> => {
    const response = await api.get(`/rate-cards/${id}`);
    return response.data;
  },

  // Create rate card
  createRateCard: async (data: CreateRateCardData): Promise<RateCard> => {
    const response = await api.post('/rate-cards', data);
    return response.data;
  },

  // Update rate card
  updateRateCard: async (id: number, data: UpdateRateCardData): Promise<RateCard> => {
    const response = await api.put(`/rate-cards/${id}`, data);
    return response.data;
  },

  // Delete rate card
  deleteRateCard: async (id: number): Promise<void> => {
    await api.delete(`/rate-cards/${id}`);
  },

  // Get applicable rate for a specific trip/driver combination
  getApplicableRate: async (params: {
    driverId?: number;
    carrierId?: number;
    profileId?: number;
    originTerminalId?: number;
    destinationTerminalId?: number;
  }): Promise<RateCard> => {
    const searchParams = new URLSearchParams();
    if (params.driverId) searchParams.append('driverId', params.driverId.toString());
    if (params.carrierId) searchParams.append('carrierId', params.carrierId.toString());
    if (params.profileId) searchParams.append('profileId', params.profileId.toString());
    if (params.originTerminalId) searchParams.append('originTerminalId', params.originTerminalId.toString());
    if (params.destinationTerminalId) searchParams.append('destinationTerminalId', params.destinationTerminalId.toString());

    const response = await api.get(`/rate-cards/applicable?${searchParams.toString()}`);
    return response.data;
  },

  // === Accessorial Rates ===

  // Get accessorial rates for a rate card
  getAccessorialRates: async (rateCardId: number): Promise<AccessorialRate[]> => {
    const response = await api.get(`/rate-cards/${rateCardId}/accessorials`);
    return response.data;
  },

  // Add accessorial rate
  addAccessorialRate: async (rateCardId: number, data: CreateAccessorialRateData): Promise<AccessorialRate> => {
    const response = await api.post(`/rate-cards/${rateCardId}/accessorials`, data);
    return response.data;
  },

  // Update accessorial rate
  updateAccessorialRate: async (
    rateCardId: number,
    rateId: number,
    data: Partial<CreateAccessorialRateData>
  ): Promise<AccessorialRate> => {
    const response = await api.put(`/rate-cards/${rateCardId}/accessorials/${rateId}`, data);
    return response.data;
  },

  // Delete accessorial rate
  deleteAccessorialRate: async (rateCardId: number, rateId: number): Promise<void> => {
    await api.delete(`/rate-cards/${rateCardId}/accessorials/${rateId}`);
  },

  // Bulk update accessorial rates
  bulkUpdateAccessorialRates: async (
    rateCardId: number,
    rates: CreateAccessorialRateData[]
  ): Promise<AccessorialRate[]> => {
    const response = await api.put(`/rate-cards/${rateCardId}/accessorials`, { rates });
    return response.data;
  },

  // === Import ===

  // Import rate cards from file (CSV/JSON parsed data)
  importRateCards: async (rateCards: ImportRateCardData[]): Promise<ImportResult> => {
    const response = await api.post('/rate-cards/import', { rateCards });
    return response.data;
  },

  // === Pay Rules UI Helpers ===

  // Get drivers with their rate cards
  getDriversWithRates: async (filters?: {
    search?: string;
    carrierId?: number;
    page?: number;
    limit?: number;
  }): Promise<DriversWithRatesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.carrierId) params.append('carrierId', filters.carrierId.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/rate-cards/drivers-with-rates?${params.toString()}`);
    return response.data;
  },

  // Get carriers with their rate cards
  getCarriersWithRates: async (filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<CarriersWithRatesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/rate-cards/carriers-with-rates?${params.toString()}`);
    return response.data;
  },

  // Get linehaul profiles with their rate cards
  getProfilesWithRates: async (filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ProfilesWithRatesResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/rate-cards/profiles-with-rates?${params.toString()}`);
    return response.data;
  },

  // Get OD pair rate cards
  getODPairRates: async (filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<RateCardsResponse> => {
    const params = new URLSearchParams();
    params.append('type', 'OD_PAIR');
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/rate-cards?${params.toString()}`);
    return response.data;
  },

  // Get default rate cards (legacy)
  getDefaultRateCards: async (): Promise<RateCardsResponse> => {
    const params = new URLSearchParams();
    params.append('type', 'DEFAULT');

    const response = await api.get(`/rate-cards?${params.toString()}`);
    return response.data;
  },

  // Get default rates (structured)
  getDefaultRates: async (): Promise<{
    defaultRates: any | null;
    systemFuelSurcharge: number;
    fuelSurchargeSource: string;
  }> => {
    const response = await api.get('/rate-cards/defaults');
    return response.data;
  },

  // Update default rates
  updateDefaultRates: async (data: any): Promise<any> => {
    const response = await api.put('/rate-cards/defaults', data);
    return response.data;
  }
};
