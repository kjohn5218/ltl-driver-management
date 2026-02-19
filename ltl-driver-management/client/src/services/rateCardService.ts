import { api } from './api';
import { RateCard, AccessorialRate, RateCardType, RateMethod, AccessorialType, RateCardsResponse } from '../types';

interface RateCardFilters {
  search?: string;
  rateType?: RateCardType;
  active?: boolean;
  driverId?: number;
  carrierId?: number;
  profileId?: number;
  page?: number;
  limit?: number;
}

interface ApplicableRateQuery {
  driverId?: number;
  carrierId?: number;
  profileId?: number;
  originTerminalId?: number;
  destinationTerminalId?: number;
}

export const rateCardService = {
  // Get all rate cards with filtering
  getRateCards: async (filters?: RateCardFilters): Promise<RateCardsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.rateType) params.append('type', filters.rateType);
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

  // Get applicable rate for a trip
  getApplicableRate: async (query: ApplicableRateQuery): Promise<RateCard | null> => {
    const params = new URLSearchParams();
    if (query.driverId) params.append('driverId', query.driverId.toString());
    if (query.carrierId) params.append('carrierId', query.carrierId.toString());
    if (query.profileId) params.append('profileId', query.profileId.toString());
    if (query.originTerminalId) params.append('originTerminalId', query.originTerminalId.toString());
    if (query.destinationTerminalId) params.append('destinationTerminalId', query.destinationTerminalId.toString());

    const response = await api.get(`/rate-cards/applicable?${params.toString()}`);
    return response.data;
  },

  // Create rate card
  createRateCard: async (data: {
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
  }): Promise<RateCard> => {
    const response = await api.post('/rate-cards', data);
    return response.data;
  },

  // Update rate card
  updateRateCard: async (id: number, data: Partial<RateCard>): Promise<RateCard> => {
    const response = await api.put(`/rate-cards/${id}`, data);
    return response.data;
  },

  // Delete rate card
  deleteRateCard: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/rate-cards/${id}`);
    return response.data;
  },

  // ==================== ACCESSORIAL RATES ====================

  // Get accessorial rates for a rate card
  getAccessorialRates: async (rateCardId: number): Promise<AccessorialRate[]> => {
    const response = await api.get(`/rate-cards/${rateCardId}/accessorials`);
    return response.data;
  },

  // Add accessorial rate
  addAccessorialRate: async (rateCardId: number, data: {
    type: AccessorialType;
    description?: string;
    rateAmount: number;
    rateUnit?: string;
    minimumCharge?: number;
    maximumCharge?: number;
  }): Promise<AccessorialRate> => {
    const response = await api.post(`/rate-cards/${rateCardId}/accessorials`, data);
    return response.data;
  },

  // Update accessorial rate
  updateAccessorialRate: async (rateCardId: number, rateId: number, data: Partial<AccessorialRate>): Promise<AccessorialRate> => {
    const response = await api.put(`/rate-cards/${rateCardId}/accessorials/${rateId}`, data);
    return response.data;
  },

  // Delete accessorial rate
  deleteAccessorialRate: async (rateCardId: number, rateId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/rate-cards/${rateCardId}/accessorials/${rateId}`);
    return response.data;
  },

  // Bulk update accessorial rates
  bulkUpdateAccessorialRates: async (rateCardId: number, rates: Partial<AccessorialRate>[]): Promise<AccessorialRate[]> => {
    const response = await api.put(`/rate-cards/${rateCardId}/accessorials`, { rates });
    return response.data;
  }
};
