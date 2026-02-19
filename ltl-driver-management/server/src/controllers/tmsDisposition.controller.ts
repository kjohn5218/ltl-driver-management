import { Request, Response } from 'express';
import { prisma } from '../index';
import { LateReasonType } from '@prisma/client';
import { tmsDispositionService, BulkDispositionData, LoadsheetDispositionResult } from '../services/tmsDisposition.service';

interface BulkDispositionRequestBody {
  loadsheetIds: number[];
  lateReason: LateReasonType;
  willCauseServiceFailure: boolean;
  accountableTerminalId?: number;
  accountableTerminalCode?: string;
  notes?: string;
  newScheduledDepartDate: string;
}

interface SingleDispositionRequestBody {
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

/**
 * Bulk disposition for multiple loadsheets
 * POST /api/tms-disposition/bulk
 */
export const bulkDisposition = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      loadsheetIds,
      lateReason,
      willCauseServiceFailure,
      accountableTerminalId,
      accountableTerminalCode,
      notes,
      newScheduledDepartDate
    } = req.body as BulkDispositionRequestBody;

    // Validate required fields
    if (!loadsheetIds || loadsheetIds.length === 0) {
      res.status(400).json({ message: 'At least one loadsheet must be selected' });
      return;
    }

    if (!lateReason) {
      res.status(400).json({ message: 'Late reason is required' });
      return;
    }

    if (!newScheduledDepartDate) {
      res.status(400).json({ message: 'New scheduled departure date is required' });
      return;
    }

    // Validate accountable terminal when service failure is true
    if (willCauseServiceFailure && !accountableTerminalId) {
      res.status(400).json({ message: 'Accountable terminal is required when this will cause a service failure' });
      return;
    }

    // Fetch loadsheets with their trip IDs
    const loadsheets = await prisma.loadsheet.findMany({
      where: { id: { in: loadsheetIds } },
      select: {
        id: true,
        manifestNumber: true,
        linehaulTripId: true,
        scheduledDepartDate: true,
        targetDispatchTime: true
      }
    });

    if (loadsheets.length === 0) {
      res.status(404).json({ message: 'No loadsheets found with the provided IDs' });
      return;
    }

    const results: LoadsheetDispositionResult[] = [];
    let processed = 0;
    let failed = 0;

    // Process each loadsheet
    for (const loadsheet of loadsheets) {
      const result: LoadsheetDispositionResult = {
        loadsheetId: loadsheet.id,
        tripId: loadsheet.linehaulTripId || undefined,
        manifestNumber: loadsheet.manifestNumber,
        lateReasonCreated: false,
        scheduledDepartureUpdated: false,
        deliveryDatesUpdated: false,
        delayNotesAdded: false,
        errors: []
      };

      try {
        // 1. Create late departure reason if trip exists and doesn't already have one
        if (loadsheet.linehaulTripId) {
          const existingReason = await prisma.lateDepartureReason.findUnique({
            where: { tripId: loadsheet.linehaulTripId }
          });

          if (!existingReason) {
            await prisma.lateDepartureReason.create({
              data: {
                tripId: loadsheet.linehaulTripId,
                reason: lateReason,
                willCauseServiceFailure,
                accountableTerminalId: accountableTerminalId || null,
                accountableTerminalCode: accountableTerminalCode || null,
                notes: notes || null,
                scheduledDepartTime: loadsheet.targetDispatchTime || null,
                createdBy: (req as any).user?.id || null
              }
            });
            result.lateReasonCreated = true;
          } else {
            result.errors.push('Trip already has a late departure reason');
          }
        } else {
          result.errors.push('Loadsheet is not linked to a trip');
        }

        // 2. Update loadsheet's scheduled departure date in local database
        await prisma.loadsheet.update({
          where: { id: loadsheet.id },
          data: { scheduledDepartDate: newScheduledDepartDate }
        });
        result.scheduledDepartureUpdated = true;

        // 3. Call TMS service for external updates (stubbed)
        const dispositionData: BulkDispositionData = {
          lateReason,
          willCauseServiceFailure,
          accountableTerminalId,
          accountableTerminalCode,
          notes,
          newScheduledDepartDate
        };

        const tmsResult = await tmsDispositionService.processSingleDisposition(
          loadsheet.id,
          loadsheet.manifestNumber,
          loadsheet.linehaulTripId || undefined,
          dispositionData
        );

        result.deliveryDatesUpdated = tmsResult.deliveryDatesUpdated;
        result.delayNotesAdded = tmsResult.delayNotesAdded;

        if (tmsResult.errors.length > 0) {
          result.errors.push(...tmsResult.errors);
        }

      } catch (error: any) {
        result.errors.push(error.message || 'Unknown error processing loadsheet');
      }

      results.push(result);

      if (result.errors.length === 0 || result.lateReasonCreated) {
        processed++;
      } else {
        failed++;
      }
    }

    res.json({
      success: failed === 0,
      processed,
      failed,
      results
    });
  } catch (error) {
    console.error('Error in bulk disposition:', error);
    res.status(500).json({ message: 'Failed to process bulk disposition' });
  }
};

/**
 * Single loadsheet disposition (for LateReasonModal integration)
 * POST /api/tms-disposition/single/:tripId
 */
export const singleDisposition = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const tripIdNum = parseInt(tripId, 10);

    const {
      lateReason,
      willCauseServiceFailure,
      accountableTerminalId,
      accountableTerminalCode,
      notes,
      newScheduledDepartDate,
      scheduledDepartTime,
      actualDepartTime,
      minutesLate
    } = req.body as SingleDispositionRequestBody;

    // Validate required fields
    if (!lateReason) {
      res.status(400).json({ message: 'Late reason is required' });
      return;
    }

    if (!newScheduledDepartDate) {
      res.status(400).json({ message: 'New scheduled departure date is required' });
      return;
    }

    // Validate accountable terminal when service failure is true
    if (willCauseServiceFailure && !accountableTerminalId) {
      res.status(400).json({ message: 'Accountable terminal is required when this will cause a service failure' });
      return;
    }

    // Get the trip and its loadsheets
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      include: {
        loadsheets: {
          select: {
            id: true,
            manifestNumber: true,
            scheduledDepartDate: true,
            targetDispatchTime: true
          }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const result: LoadsheetDispositionResult = {
      loadsheetId: trip.loadsheets[0]?.id || 0,
      tripId: tripIdNum,
      manifestNumber: trip.loadsheets[0]?.manifestNumber,
      lateReasonCreated: false,
      scheduledDepartureUpdated: false,
      deliveryDatesUpdated: false,
      delayNotesAdded: false,
      errors: []
    };

    try {
      // 1. Check if late reason already exists
      const existingReason = await prisma.lateDepartureReason.findUnique({
        where: { tripId: tripIdNum }
      });

      if (!existingReason) {
        // Create late departure reason
        await prisma.lateDepartureReason.create({
          data: {
            tripId: tripIdNum,
            reason: lateReason,
            willCauseServiceFailure,
            accountableTerminalId: accountableTerminalId || null,
            accountableTerminalCode: accountableTerminalCode || null,
            notes: notes || null,
            scheduledDepartTime: scheduledDepartTime || null,
            actualDepartTime: actualDepartTime || null,
            minutesLate: minutesLate || null,
            createdBy: (req as any).user?.id || null
          }
        });
        result.lateReasonCreated = true;
      } else {
        result.errors.push('Trip already has a late departure reason');
      }

      // 2. Update loadsheets' scheduled departure dates
      if (trip.loadsheets.length > 0) {
        await prisma.loadsheet.updateMany({
          where: { linehaulTripId: tripIdNum },
          data: { scheduledDepartDate: newScheduledDepartDate }
        });
        result.scheduledDepartureUpdated = true;

        // 3. Call TMS service for each loadsheet (stubbed)
        const dispositionData: BulkDispositionData = {
          lateReason,
          willCauseServiceFailure,
          accountableTerminalId,
          accountableTerminalCode,
          notes,
          newScheduledDepartDate
        };

        for (const loadsheet of trip.loadsheets) {
          const tmsResult = await tmsDispositionService.processSingleDisposition(
            loadsheet.id,
            loadsheet.manifestNumber,
            tripIdNum,
            dispositionData
          );

          // Aggregate TMS results
          if (tmsResult.deliveryDatesUpdated) result.deliveryDatesUpdated = true;
          if (tmsResult.delayNotesAdded) result.delayNotesAdded = true;
          if (tmsResult.errors.length > 0) {
            result.errors.push(...tmsResult.errors);
          }
        }
      } else {
        result.errors.push('No loadsheets found for this trip');
      }

    } catch (error: any) {
      result.errors.push(error.message || 'Unknown error processing disposition');
    }

    res.json(result);
  } catch (error) {
    console.error('Error in single disposition:', error);
    res.status(500).json({ message: 'Failed to process disposition' });
  }
};
