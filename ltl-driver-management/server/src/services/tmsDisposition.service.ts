/**
 * TMS Disposition Service
 *
 * This service provides stubbed methods for integrating with an external TMS system
 * to update loadsheet schedules, shipment delivery dates, and add delay notes.
 *
 * In production, these methods will be replaced with actual TMS API calls.
 */

import { LateReasonType } from '@prisma/client';

// Result interface for TMS operations
export interface TMSDispositionResult {
  success: boolean;
  message: string;
  errorCode?: string;
}

// Bulk disposition request data
export interface BulkDispositionData {
  lateReason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  newScheduledDepartDate: string;
}

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
export interface BulkDispositionResult {
  success: boolean;
  processed: number;
  failed: number;
  results: LoadsheetDispositionResult[];
}

// Human-readable labels for late reason types
const LATE_REASON_LABELS: Record<LateReasonType, string> = {
  PRE_LOAD: 'Pre-load issues',
  DOCK_ISSUE: 'Dock issue',
  STAFFING: 'Staffing shortage',
  DRIVER_ISSUE: 'Driver issue',
  WEATHER: 'Weather conditions',
  LATE_INBOUND: 'Late inbound freight',
  DISPATCH_ISSUE: 'Dispatch issue'
};

/**
 * TMS Disposition Service
 *
 * All methods are currently stubbed and simulate TMS integration.
 * When connecting to actual TMS, replace the implementations with real API calls.
 */
export const tmsDispositionService = {
  /**
   * Update the scheduled departure date for a loadsheet in TMS
   *
   * @param loadsheetId - The loadsheet ID
   * @param manifestNumber - The manifest number
   * @param newDate - New scheduled departure date (YYYY-MM-DD)
   * @returns Promise<TMSDispositionResult>
   */
  updateLoadsheetScheduledDeparture: async (
    loadsheetId: number,
    manifestNumber: string,
    newDate: string
  ): Promise<TMSDispositionResult> => {
    // TODO: Replace with actual TMS API call
    // Example: await tmsApi.put(`/loadsheets/${manifestNumber}/scheduled-departure`, { date: newDate });

    console.log(`[TMS STUB] Updating scheduled departure for loadsheet ${loadsheetId} (${manifestNumber}) to ${newDate}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      success: true,
      message: `Scheduled departure updated to ${newDate} for manifest ${manifestNumber}`
    };
  },

  /**
   * Update delivery dates for all shipments on a loadsheet
   *
   * @param loadsheetId - The loadsheet ID
   * @param manifestNumber - The manifest number
   * @param newDeliveryDate - New planned delivery date (YYYY-MM-DD)
   * @returns Promise<TMSDispositionResult>
   */
  updateShipmentDeliveryDates: async (
    loadsheetId: number,
    manifestNumber: string,
    newDeliveryDate: string
  ): Promise<TMSDispositionResult> => {
    // TODO: Replace with actual TMS API call
    // Example: await tmsApi.put(`/manifests/${manifestNumber}/shipments/delivery-dates`, { date: newDeliveryDate });

    console.log(`[TMS STUB] Updating shipment delivery dates for loadsheet ${loadsheetId} (${manifestNumber}) to ${newDeliveryDate}`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      success: true,
      message: `Shipment delivery dates updated to ${newDeliveryDate} for manifest ${manifestNumber}`
    };
  },

  /**
   * Add delay notes to all orders on a loadsheet
   *
   * @param loadsheetId - The loadsheet ID
   * @param manifestNumber - The manifest number
   * @param reason - The late reason type
   * @param newDeliveryDate - The new delivery date for the note
   * @returns Promise<TMSDispositionResult>
   */
  addDelayNotesToOrders: async (
    loadsheetId: number,
    manifestNumber: string,
    reason: LateReasonType,
    newDeliveryDate: string
  ): Promise<TMSDispositionResult> => {
    // Generate auto-formatted delay note
    const reasonLabel = LATE_REASON_LABELS[reason] || reason;
    const delayNote = `DELAY: Late departure due to ${reasonLabel}. New scheduled delivery: ${newDeliveryDate}`;

    // TODO: Replace with actual TMS API call
    // Example: await tmsApi.post(`/manifests/${manifestNumber}/orders/notes`, { note: delayNote, type: 'DELAY' });

    console.log(`[TMS STUB] Adding delay notes to orders for loadsheet ${loadsheetId} (${manifestNumber}): "${delayNote}"`);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      success: true,
      message: `Delay notes added to orders for manifest ${manifestNumber}`
    };
  },

  /**
   * Process single loadsheet disposition with all TMS updates
   *
   * @param loadsheetId - The loadsheet ID
   * @param manifestNumber - The manifest number
   * @param tripId - The associated trip ID (if any)
   * @param data - Disposition data
   * @returns Promise<LoadsheetDispositionResult>
   */
  processSingleDisposition: async (
    loadsheetId: number,
    manifestNumber: string,
    tripId: number | undefined,
    data: BulkDispositionData
  ): Promise<LoadsheetDispositionResult> => {
    const result: LoadsheetDispositionResult = {
      loadsheetId,
      tripId,
      manifestNumber,
      lateReasonCreated: false,
      scheduledDepartureUpdated: false,
      deliveryDatesUpdated: false,
      delayNotesAdded: false,
      errors: []
    };

    try {
      // 1. Update scheduled departure date
      const schedResult = await tmsDispositionService.updateLoadsheetScheduledDeparture(
        loadsheetId,
        manifestNumber,
        data.newScheduledDepartDate
      );
      result.scheduledDepartureUpdated = schedResult.success;
      if (!schedResult.success) {
        result.errors.push(schedResult.message);
      }

      // 2. Update shipment delivery dates
      const deliveryResult = await tmsDispositionService.updateShipmentDeliveryDates(
        loadsheetId,
        manifestNumber,
        data.newScheduledDepartDate
      );
      result.deliveryDatesUpdated = deliveryResult.success;
      if (!deliveryResult.success) {
        result.errors.push(deliveryResult.message);
      }

      // 3. Add delay notes to orders
      const notesResult = await tmsDispositionService.addDelayNotesToOrders(
        loadsheetId,
        manifestNumber,
        data.lateReason,
        data.newScheduledDepartDate
      );
      result.delayNotesAdded = notesResult.success;
      if (!notesResult.success) {
        result.errors.push(notesResult.message);
      }

    } catch (error: any) {
      result.errors.push(error.message || 'Unknown error during TMS disposition');
    }

    return result;
  },

  /**
   * Process bulk disposition for multiple loadsheets
   *
   * @param loadsheets - Array of loadsheet data with IDs, manifest numbers, and trip IDs
   * @param data - Disposition data to apply to all loadsheets
   * @returns Promise<BulkDispositionResult>
   */
  bulkDisposition: async (
    loadsheets: Array<{ id: number; manifestNumber: string; tripId?: number }>,
    data: BulkDispositionData
  ): Promise<BulkDispositionResult> => {
    const results: LoadsheetDispositionResult[] = [];
    let processed = 0;
    let failed = 0;

    for (const loadsheet of loadsheets) {
      const result = await tmsDispositionService.processSingleDisposition(
        loadsheet.id,
        loadsheet.manifestNumber,
        loadsheet.tripId,
        data
      );

      results.push(result);

      if (result.errors.length === 0) {
        processed++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      processed,
      failed,
      results
    };
  }
};
