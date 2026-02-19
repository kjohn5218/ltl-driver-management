import { api } from './api';
import { LateReasonType } from './lateDepartureReasonService';

// Result for individual loadsheet disposition
export interface LoadsheetDispositionResult {
  loadsheetId: number;
  tripId?: number;
  manifestNumber?: string;
  lateReasonCreated: boolean;
  scheduledDepartureUpdated: boolean;
  deliveryDatesUpdated: boolean;
  delayNotesAdded: boolean;
  errors: string[];
}

// Aggregated result for bulk operations
export interface BulkDispositionResponse {
  success: boolean;
  processed: number;
  failed: number;
  results: LoadsheetDispositionResult[];
}

// Request body for bulk disposition
export interface BulkDispositionRequest {
  loadsheetIds: number[];
  lateReason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  newScheduledDepartDate: string;
}

// Request body for single disposition (from LateReasonModal)
export interface SingleDispositionRequest {
  lateReason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  newScheduledDepartDate: string;
  scheduledDepartTime?: string;
  actualDepartTime?: string;
  minutesLate?: number;
}

export const tmsDispositionService = {
  /**
   * Bulk disposition for multiple loadsheets
   * Records late departure reasons and calls TMS to update schedules
   */
  bulkDisposition: async (data: BulkDispositionRequest): Promise<BulkDispositionResponse> => {
    const response = await api.post('/tms-disposition/bulk', data);
    return response.data;
  },

  /**
   * Single disposition for a trip (used by LateReasonModal)
   * Records late departure reason and calls TMS to update schedules
   */
  singleDisposition: async (tripId: number, data: SingleDispositionRequest): Promise<LoadsheetDispositionResult> => {
    const response = await api.post(`/tms-disposition/single/${tripId}`, data);
    return response.data;
  }
};
