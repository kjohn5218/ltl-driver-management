import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, DelayCode } from '@prisma/client';

// ==================== TRIP SHIPMENTS ====================

// Get all shipments for a trip
export const getTripShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;

    const shipments = await prisma.tripShipment.findMany({
      where: { tripId: parseInt(tripId, 10) },
      orderBy: { proNumber: 'asc' }
    });

    res.json(shipments);
  } catch (error) {
    console.error('Error fetching trip shipments:', error);
    res.status(500).json({ message: 'Failed to fetch trip shipments' });
  }
};

// Add shipment to trip
export const addTripShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const {
      proNumber,
      originTerminal,
      destinationTerminal,
      pieces,
      weight,
      handlingUnits,
      serviceLevel,
      specialInstructions,
      hazmat,
      hazmatClass,
      externalShipmentId
    } = req.body;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(tripId, 10) }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const shipment = await prisma.tripShipment.create({
      data: {
        tripId: parseInt(tripId, 10),
        proNumber,
        originTerminal,
        destinationTerminal,
        pieces: pieces ? parseInt(pieces, 10) : null,
        weight: weight ? parseInt(weight, 10) : null,
        handlingUnits: handlingUnits ? parseInt(handlingUnits, 10) : null,
        serviceLevel,
        specialInstructions,
        hazmat: hazmat || false,
        hazmatClass,
        externalShipmentId
      }
    });

    res.status(201).json(shipment);
  } catch (error) {
    console.error('Error adding trip shipment:', error);
    res.status(500).json({ message: 'Failed to add trip shipment' });
  }
};

// Update shipment
export const updateTripShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, shipmentId } = req.params;
    const {
      proNumber,
      originTerminal,
      destinationTerminal,
      pieces,
      weight,
      handlingUnits,
      serviceLevel,
      specialInstructions,
      hazmat,
      hazmatClass,
      externalShipmentId
    } = req.body;

    const shipment = await prisma.tripShipment.findFirst({
      where: {
        id: parseInt(shipmentId, 10),
        tripId: parseInt(tripId, 10)
      }
    });

    if (!shipment) {
      res.status(404).json({ message: 'Shipment not found' });
      return;
    }

    const updatedShipment = await prisma.tripShipment.update({
      where: { id: parseInt(shipmentId, 10) },
      data: {
        ...(proNumber !== undefined && { proNumber }),
        ...(originTerminal !== undefined && { originTerminal }),
        ...(destinationTerminal !== undefined && { destinationTerminal }),
        ...(pieces !== undefined && { pieces: pieces ? parseInt(pieces, 10) : null }),
        ...(weight !== undefined && { weight: weight ? parseInt(weight, 10) : null }),
        ...(handlingUnits !== undefined && { handlingUnits: handlingUnits ? parseInt(handlingUnits, 10) : null }),
        ...(serviceLevel !== undefined && { serviceLevel }),
        ...(specialInstructions !== undefined && { specialInstructions }),
        ...(hazmat !== undefined && { hazmat }),
        ...(hazmatClass !== undefined && { hazmatClass }),
        ...(externalShipmentId !== undefined && { externalShipmentId })
      }
    });

    res.json(updatedShipment);
  } catch (error) {
    console.error('Error updating trip shipment:', error);
    res.status(500).json({ message: 'Failed to update trip shipment' });
  }
};

// Delete shipment
export const deleteTripShipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, shipmentId } = req.params;

    const shipment = await prisma.tripShipment.findFirst({
      where: {
        id: parseInt(shipmentId, 10),
        tripId: parseInt(tripId, 10)
      }
    });

    if (!shipment) {
      res.status(404).json({ message: 'Shipment not found' });
      return;
    }

    await prisma.tripShipment.delete({
      where: { id: parseInt(shipmentId, 10) }
    });

    res.json({ message: 'Shipment deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip shipment:', error);
    res.status(500).json({ message: 'Failed to delete trip shipment' });
  }
};

// Bulk add shipments to trip
export const bulkAddTripShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { shipments } = req.body;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(tripId, 10) }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const createdShipments = await prisma.tripShipment.createMany({
      data: shipments.map((s: any) => ({
        tripId: parseInt(tripId, 10),
        proNumber: s.proNumber,
        originTerminal: s.originTerminal,
        destinationTerminal: s.destinationTerminal,
        pieces: s.pieces ? parseInt(s.pieces, 10) : null,
        weight: s.weight ? parseInt(s.weight, 10) : null,
        handlingUnits: s.handlingUnits ? parseInt(s.handlingUnits, 10) : null,
        serviceLevel: s.serviceLevel,
        specialInstructions: s.specialInstructions,
        hazmat: s.hazmat || false,
        hazmatClass: s.hazmatClass,
        externalShipmentId: s.externalShipmentId
      }))
    });

    // Return all shipments for the trip
    const allShipments = await prisma.tripShipment.findMany({
      where: { tripId: parseInt(tripId, 10) },
      orderBy: { proNumber: 'asc' }
    });

    res.status(201).json({
      added: createdShipments.count,
      shipments: allShipments
    });
  } catch (error) {
    console.error('Error bulk adding trip shipments:', error);
    res.status(500).json({ message: 'Failed to add trip shipments' });
  }
};

// Get shipments for trip (alternative endpoint)
export const reorderTripShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(tripId, 10) }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const shipments = await prisma.tripShipment.findMany({
      where: { tripId: parseInt(tripId, 10) },
      orderBy: { proNumber: 'asc' }
    });

    res.json(shipments);
  } catch (error) {
    console.error('Error fetching trip shipments:', error);
    res.status(500).json({ message: 'Failed to fetch trip shipments' });
  }
};

// Get load manifest summary
export const getTripLoadManifest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(tripId, 10) },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true
          }
        },
        driver: {
          select: { id: true, name: true, phoneNumber: true }
        },
        truck: {
          select: { unitNumber: true }
        },
        trailer: {
          select: { unitNumber: true }
        },
        trailer2: {
          select: { unitNumber: true }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const shipments = await prisma.tripShipment.findMany({
      where: { tripId: parseInt(tripId, 10) },
      orderBy: { proNumber: 'asc' }
    });

    // Calculate totals
    const totalPieces = shipments.reduce((sum, s) => sum + (s.pieces || 0), 0);
    const totalWeight = shipments.reduce((sum, s) => sum + Number(s.weight || 0), 0);
    const hasHazmat = shipments.some(s => s.hazmat);

    res.json({
      trip: {
        tripNumber: trip.tripNumber,
        dispatchDate: trip.dispatchDate,
        plannedDeparture: trip.plannedDeparture,
        plannedArrival: trip.plannedArrival,
        status: trip.status
      },
      route: trip.linehaulProfile ? {
        origin: {
          code: trip.linehaulProfile.originTerminal.code,
          name: trip.linehaulProfile.originTerminal.name,
          city: trip.linehaulProfile.originTerminal.city,
          state: trip.linehaulProfile.originTerminal.state
        },
        destination: {
          code: trip.linehaulProfile.destinationTerminal.code,
          name: trip.linehaulProfile.destinationTerminal.name,
          city: trip.linehaulProfile.destinationTerminal.city,
          state: trip.linehaulProfile.destinationTerminal.state
        }
      } : null,
      driver: trip.driver,
      equipment: {
        truck: trip.truck?.unitNumber,
        trailer: trip.trailer?.unitNumber,
        trailer2: trip.trailer2?.unitNumber
      },
      shipments,
      summary: {
        totalShipments: shipments.length,
        totalPieces,
        totalWeight,
        hasHazmat
      }
    });
  } catch (error) {
    console.error('Error fetching load manifest:', error);
    res.status(500).json({ message: 'Failed to fetch load manifest' });
  }
};

// ==================== TRIP DELAYS ====================

// Get all delays for a trip
export const getTripDelays = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;

    const delays = await prisma.tripDelay.findMany({
      where: { tripId: parseInt(tripId, 10) },
      orderBy: { reportedAt: 'desc' },
      include: {
        reporter: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(delays);
  } catch (error) {
    console.error('Error fetching trip delays:', error);
    res.status(500).json({ message: 'Failed to fetch trip delays' });
  }
};

// Report delay for a trip
export const reportTripDelay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const {
      delayCode,
      delayReason,
      delayMinutes,
      affectsShipments
    } = req.body;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(tripId, 10) }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Get user from request (set by auth middleware)
    const userId = (req as any).user?.id;

    const delay = await prisma.tripDelay.create({
      data: {
        tripId: parseInt(tripId, 10),
        delayCode: delayCode as DelayCode,
        delayReason,
        delayMinutes: delayMinutes ? parseInt(delayMinutes, 10) : 0,
        affectsShipments: affectsShipments !== undefined ? affectsShipments : true,
        reportedBy: userId,
        reportedAt: new Date()
      },
      include: {
        reporter: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json(delay);
  } catch (error) {
    console.error('Error reporting trip delay:', error);
    res.status(500).json({ message: 'Failed to report trip delay' });
  }
};

// Update trip delay
export const updateTripDelay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, delayId } = req.params;
    const {
      delayCode,
      delayReason,
      delayMinutes,
      affectsShipments,
      resolvedAt,
      resolutionNotes
    } = req.body;

    const delay = await prisma.tripDelay.findFirst({
      where: {
        id: parseInt(delayId, 10),
        tripId: parseInt(tripId, 10)
      }
    });

    if (!delay) {
      res.status(404).json({ message: 'Delay not found' });
      return;
    }

    const updatedDelay = await prisma.tripDelay.update({
      where: { id: parseInt(delayId, 10) },
      data: {
        ...(delayCode && { delayCode: delayCode as DelayCode }),
        ...(delayReason !== undefined && { delayReason }),
        ...(delayMinutes !== undefined && { delayMinutes: parseInt(delayMinutes, 10) }),
        ...(affectsShipments !== undefined && { affectsShipments }),
        ...(resolvedAt !== undefined && { resolvedAt: resolvedAt ? new Date(resolvedAt) : null }),
        ...(resolutionNotes !== undefined && { resolutionNotes })
      },
      include: {
        reporter: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.json(updatedDelay);
  } catch (error) {
    console.error('Error updating trip delay:', error);
    res.status(500).json({ message: 'Failed to update trip delay' });
  }
};

// Resolve trip delay
export const resolveTripDelay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, delayId } = req.params;
    const { resolutionNotes } = req.body;

    const delay = await prisma.tripDelay.findFirst({
      where: {
        id: parseInt(delayId, 10),
        tripId: parseInt(tripId, 10)
      }
    });

    if (!delay) {
      res.status(404).json({ message: 'Delay not found' });
      return;
    }

    const resolvedDelay = await prisma.tripDelay.update({
      where: { id: parseInt(delayId, 10) },
      data: {
        resolvedAt: new Date(),
        resolutionNotes
      }
    });

    res.json(resolvedDelay);
  } catch (error) {
    console.error('Error resolving trip delay:', error);
    res.status(500).json({ message: 'Failed to resolve trip delay' });
  }
};

// Delete trip delay
export const deleteTripDelay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, delayId } = req.params;

    const delay = await prisma.tripDelay.findFirst({
      where: {
        id: parseInt(delayId, 10),
        tripId: parseInt(tripId, 10)
      }
    });

    if (!delay) {
      res.status(404).json({ message: 'Delay not found' });
      return;
    }

    await prisma.tripDelay.delete({
      where: { id: parseInt(delayId, 10) }
    });

    res.json({ message: 'Delay deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip delay:', error);
    res.status(500).json({ message: 'Failed to delete trip delay' });
  }
};

// Get delay statistics
export const getDelayStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, profileId } = req.query;

    const where: Prisma.TripDelayWhereInput = {};

    if (startDate || endDate) {
      where.reportedAt = {};
      if (startDate) {
        where.reportedAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.reportedAt.lte = new Date(endDate as string);
      }
    }

    if (profileId) {
      where.trip = {
        linehaulProfileId: parseInt(profileId as string, 10)
      };
    }

    const [delaysByCode, totalDelays, avgDelayMinutes] = await Promise.all([
      prisma.tripDelay.groupBy({
        by: ['delayCode'],
        where,
        _count: { id: true },
        _avg: { delayMinutes: true }
      }),
      prisma.tripDelay.count({ where }),
      prisma.tripDelay.aggregate({
        where,
        _avg: { delayMinutes: true }
      })
    ]);

    res.json({
      totalDelays,
      averageDelayMinutes: avgDelayMinutes._avg.delayMinutes || 0,
      byDelayCode: delaysByCode.map(d => ({
        code: d.delayCode,
        count: d._count.id,
        avgMinutes: d._avg.delayMinutes || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching delay statistics:', error);
    res.status(500).json({ message: 'Failed to fetch delay statistics' });
  }
};
