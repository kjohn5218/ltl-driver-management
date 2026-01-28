import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { expectedShipmentsMockService } from '../services/expectedShipments.mock.service';

// Get expected shipments by lane with filtering
export const getExpectedShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startDate,
      endDate,
      originTerminalCode,
      destinationTerminalCode,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ExpectedShipmentWhereInput = {};

    // Date filter (required for meaningful results)
    if (startDate || endDate) {
      where.forecastDate = {};
      if (startDate) {
        where.forecastDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.forecastDate.lte = new Date(endDate as string);
      }
    }

    if (originTerminalCode) {
      where.originTerminalCode = originTerminalCode as string;
    }

    if (destinationTerminalCode) {
      where.destinationTerminalCode = destinationTerminalCode as string;
    }

    const [shipments, total] = await Promise.all([
      prisma.expectedShipment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { forecastDate: 'asc' },
          { originTerminalCode: 'asc' },
          { destinationTerminalCode: 'asc' }
        ]
      }),
      prisma.expectedShipment.count({ where })
    ]);

    res.json({
      shipments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching expected shipments:', error);
    res.status(500).json({ message: 'Failed to fetch expected shipments' });
  }
};

// Get expected shipments from mock service (external TMS simulation)
export const getExpectedShipmentsFromTMS = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startDate,
      endDate,
      originTerminalCode,
      destinationTerminalCode,
      aggregated
    } = req.query;

    // Default to today and next 7 days if no dates provided
    const start = startDate ? new Date(startDate as string) : new Date();
    const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let volumes;
    if (aggregated === 'true') {
      volumes = await expectedShipmentsMockService.getLaneVolumesAggregated(
        start,
        end,
        originTerminalCode as string | undefined
      );
    } else {
      volumes = await expectedShipmentsMockService.getLaneVolumes(
        start,
        end,
        originTerminalCode as string | undefined,
        destinationTerminalCode as string | undefined
      );
    }

    // Calculate summary statistics
    const summary = {
      totalShipments: volumes.reduce((sum, v) => sum + v.expectedShipmentCount, 0),
      totalPieces: volumes.reduce((sum, v) => sum + v.expectedPieces, 0),
      totalWeight: volumes.reduce((sum, v) => sum + v.expectedWeight, 0),
      totalTrailers: parseFloat(volumes.reduce((sum, v) => sum + v.estimatedTrailers, 0).toFixed(1)),
      hazmatShipments: volumes.reduce((sum, v) => sum + v.hazmatCount, 0),
      guaranteedShipments: volumes.reduce((sum, v) => sum + v.guaranteedCount, 0),
      laneCount: new Set(volumes.map(v => `${v.originTerminalCode}-${v.destinationTerminalCode}`)).size
    };

    res.json({
      volumes,
      summary,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching expected shipments from TMS:', error);
    res.status(500).json({ message: 'Failed to fetch expected shipments from TMS' });
  }
};

// Get lane shipment details from mock service
export const getLaneShipmentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, destination, date } = req.params;

    if (!origin || !destination || !date) {
      res.status(400).json({ message: 'Origin, destination, and date are required' });
      return;
    }

    const forecastDate = new Date(date);
    const details = await expectedShipmentsMockService.getLaneShipmentDetails(
      origin,
      destination,
      forecastDate
    );

    res.json({
      lane: `${origin}-${destination}`,
      forecastDate: forecastDate.toISOString(),
      shipmentCount: details.length,
      details
    });
  } catch (error) {
    console.error('Error fetching lane shipment details:', error);
    res.status(500).json({ message: 'Failed to fetch lane shipment details' });
  }
};

// Get daily summary from mock service
export const getDailySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query;

    const forecastDate = date ? new Date(date as string) : new Date();
    const summary = await expectedShipmentsMockService.getDailySummary(forecastDate);

    res.json({
      date: forecastDate.toISOString().split('T')[0],
      ...summary
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ message: 'Failed to fetch daily summary' });
  }
};

// Sync expected shipments from TMS (would be called by scheduler or manually)
export const syncFromTMS = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await expectedShipmentsMockService.syncFromTMS();

    res.json({
      message: 'Sync completed',
      synced: result.synced,
      errors: result.errors,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing from TMS:', error);
    res.status(500).json({ message: 'Failed to sync from TMS' });
  }
};

// Upsert expected shipment (for manual entry or external API)
export const upsertExpectedShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;

    const shipment = await prisma.expectedShipment.upsert({
      where: {
        forecastDate_originTerminalCode_destinationTerminalCode: {
          forecastDate: new Date(data.forecastDate),
          originTerminalCode: data.originTerminalCode,
          destinationTerminalCode: data.destinationTerminalCode
        }
      },
      update: {
        laneName: data.laneName,
        expectedShipmentCount: data.expectedShipmentCount || 0,
        expectedPieces: data.expectedPieces || 0,
        expectedWeight: data.expectedWeight || 0,
        expectedCube: data.expectedCube,
        guaranteedCount: data.guaranteedCount || 0,
        standardCount: data.standardCount || 0,
        expeditedCount: data.expeditedCount || 0,
        hazmatCount: data.hazmatCount || 0,
        highValueCount: data.highValueCount || 0,
        oversizeCount: data.oversizeCount || 0,
        estimatedTrailers: data.estimatedTrailers,
        trailerUtilization: data.trailerUtilization,
        dataSource: data.dataSource || 'MANUAL',
        confidenceLevel: data.confidenceLevel,
        notes: data.notes,
        lastSyncAt: new Date()
      },
      create: {
        externalId: data.externalId,
        forecastDate: new Date(data.forecastDate),
        originTerminalCode: data.originTerminalCode,
        destinationTerminalCode: data.destinationTerminalCode,
        laneName: data.laneName || `${data.originTerminalCode}-${data.destinationTerminalCode}`,
        expectedShipmentCount: data.expectedShipmentCount || 0,
        expectedPieces: data.expectedPieces || 0,
        expectedWeight: data.expectedWeight || 0,
        expectedCube: data.expectedCube,
        guaranteedCount: data.guaranteedCount || 0,
        standardCount: data.standardCount || 0,
        expeditedCount: data.expeditedCount || 0,
        hazmatCount: data.hazmatCount || 0,
        highValueCount: data.highValueCount || 0,
        oversizeCount: data.oversizeCount || 0,
        estimatedTrailers: data.estimatedTrailers,
        trailerUtilization: data.trailerUtilization,
        dataSource: data.dataSource || 'MANUAL',
        confidenceLevel: data.confidenceLevel,
        notes: data.notes
      }
    });

    res.json(shipment);
  } catch (error) {
    console.error('Error upserting expected shipment:', error);
    res.status(500).json({ message: 'Failed to upsert expected shipment' });
  }
};

// Delete expected shipments by date range
export const deleteExpectedShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, originTerminalCode } = req.body;

    const where: Prisma.ExpectedShipmentWhereInput = {};

    if (startDate || endDate) {
      where.forecastDate = {};
      if (startDate) where.forecastDate.gte = new Date(startDate);
      if (endDate) where.forecastDate.lte = new Date(endDate);
    }

    if (originTerminalCode) {
      where.originTerminalCode = originTerminalCode;
    }

    const result = await prisma.expectedShipment.deleteMany({ where });

    res.json({
      message: 'Expected shipments deleted',
      deleted: result.count
    });
  } catch (error) {
    console.error('Error deleting expected shipments:', error);
    res.status(500).json({ message: 'Failed to delete expected shipments' });
  }
};
