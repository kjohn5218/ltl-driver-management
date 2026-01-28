import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, TripStatus, EquipmentStatus } from '@prisma/client';
import { tripDocumentService } from '../services/tripDocument.service';
import { etaService } from '../services/eta.service';

// Get all trips with filtering
export const getTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      statuses,
      profileId,
      driverId,
      originTerminalId,
      destinationTerminalId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LinehaulTripWhereInput = {};

    if (search) {
      where.OR = [
        { tripNumber: { contains: search as string, mode: 'insensitive' } },
        { linehaulProfile: { profileCode: { contains: search as string, mode: 'insensitive' } } },
        { linehaulProfile: { name: { contains: search as string, mode: 'insensitive' } } },
        // Search by driver name
        { driver: { name: { contains: search as string, mode: 'insensitive' } } },
        // Search by driver number
        { driver: { number: { contains: search as string, mode: 'insensitive' } } },
        // Search by power unit (truck unit number)
        { truck: { unitNumber: { contains: search as string, mode: 'insensitive' } } },
        // Search by manifest number (via loadsheets)
        { loadsheets: { some: { manifestNumber: { contains: search as string, mode: 'insensitive' } } } }
      ];
    }

    if (status) {
      where.status = status as TripStatus;
    }

    // Support filtering by multiple statuses
    if (statuses) {
      const statusList = (statuses as string).split(',').map(s => s.trim()) as TripStatus[];
      where.status = { in: statusList };
    }

    if (profileId) {
      where.linehaulProfileId = parseInt(profileId as string, 10);
    }

    if (driverId) {
      where.OR = [
        { driverId: parseInt(driverId as string, 10) },
        { teamDriverId: parseInt(driverId as string, 10) }
      ];
    }

    if (originTerminalId) {
      where.linehaulProfile = {
        ...where.linehaulProfile as object,
        originTerminalId: parseInt(originTerminalId as string, 10)
      };
    }

    if (destinationTerminalId) {
      // Look up the terminal code for this ID to support filtering by code
      const terminal = await prisma.terminal.findUnique({
        where: { id: parseInt(destinationTerminalId as string, 10) },
        select: { code: true }
      });

      if (terminal) {
        // Match trips where the destination matches via:
        // 1. The linehaulProfile's destinationTerminalId, OR
        // 2. The trip's direct destinationTerminalCode, OR
        // 3. Any associated loadsheet's destinationTerminalCode
        // 4. LinehaulName contains the destination code (for multi-leg routes)
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              { linehaulProfile: { destinationTerminalId: parseInt(destinationTerminalId as string, 10) } },
              { destinationTerminalCode: terminal.code },
              { loadsheets: { some: { destinationTerminalCode: terminal.code } } },
              // Match linehaulName containing the destination code (handles multi-leg like "DENVIL..." or "DEN-VIL-...")
              { loadsheets: { some: { linehaulName: { contains: terminal.code } } } }
            ]
          }
        ];
      } else {
        // Fallback to just profile-based filtering if terminal not found
        where.linehaulProfile = {
          ...where.linehaulProfile as object,
          destinationTerminalId: parseInt(destinationTerminalId as string, 10)
        };
      }
    }

    if (startDate) {
      where.dispatchDate = {
        ...where.dispatchDate as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      // Set endDate to end of day to include all trips on that date
      const endOfDay = new Date(endDate as string);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.dispatchDate = {
        ...where.dispatchDate as object,
        lte: endOfDay
      };
    }

    const [trips, total] = await Promise.all([
      prisma.linehaulTrip.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { dispatchDate: 'desc' },
        include: {
          linehaulProfile: {
            select: {
              id: true,
              profileCode: true,
              name: true,
              transitTimeMinutes: true,
              standardArrivalTime: true,
              headhaul: true,
              originTerminal: {
                select: { code: true, name: true }
              },
              destinationTerminal: {
                select: { code: true, name: true }
              }
            }
          },
          driver: {
            select: { id: true, name: true, phoneNumber: true }
          },
          teamDriver: {
            select: { id: true, name: true }
          },
          truck: {
            select: { id: true, unitNumber: true, truckType: true, externalFleetId: true }
          },
          trailer: {
            select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true }
          },
          trailer2: {
            select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true }
          },
          trailer3: {
            select: { id: true, unitNumber: true, trailerType: true, lengthFeet: true }
          },
          dolly: {
            select: { id: true, unitNumber: true, dollyType: true }
          },
          dolly2: {
            select: { id: true, unitNumber: true, dollyType: true }
          },
          loadsheets: {
            select: {
              id: true,
              manifestNumber: true,
              linehaulName: true,
              originTerminalCode: true,
              destinationTerminalCode: true,
              weight: true,
              pieces: true,
              trailerNumber: true,
              suggestedTrailerLength: true,
              targetDispatchTime: true
            }
          },
          shipments: {
            select: { id: true, pieces: true, weight: true }
          },
          _count: {
            select: { shipments: true, delays: true }
          }
        }
      }),
      prisma.linehaulTrip.count({ where })
    ]);

    // Transform trips to include linehaulName at top level (from first loadsheet)
    const transformedTrips = trips.map(trip => {
      const firstLoadsheet = trip.loadsheets?.[0];
      return {
        ...trip,
        linehaulName: firstLoadsheet?.linehaulName || null
      };
    });

    res.json({
      trips: transformedTrips,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Failed to fetch trips' });
  }
};

// Get trip by ID
export const getTripById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true
          }
        },
        driver: true,
        teamDriver: true,
        truck: true,
        trailer: true,
        trailer2: true,
        trailer3: true,
        dolly: true,
        dolly2: true,
        shipments: {
          orderBy: { proNumber: 'asc' }
        },
        delays: {
          orderBy: { reportedAt: 'desc' }
        },
        tripPay: true
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    res.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ message: 'Failed to fetch trip' });
  }
};

// Get trip by trip number
export const getTripByNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripNumber } = req.params;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { tripNumber: tripNumber.toUpperCase() },
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
          select: { id: true, unitNumber: true }
        },
        trailer: {
          select: { id: true, unitNumber: true }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    res.json(trip);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ message: 'Failed to fetch trip' });
  }
};

// Generate unique trip number (numeric only)
const generateTripNumber = async (): Promise<string> => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  const lastTrip = await prisma.linehaulTrip.findFirst({
    where: { tripNumber: { startsWith: dateStr } },
    orderBy: { tripNumber: 'desc' }
  });

  let sequence = 1;
  if (lastTrip) {
    const lastSeq = parseInt(lastTrip.tripNumber.slice(-3), 10);
    sequence = lastSeq + 1;
  }

  return `${dateStr}${sequence.toString().padStart(3, '0')}`;
};

// Create new trip
export const createTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      linehaulProfileId,
      dispatchDate,
      plannedDeparture,
      plannedArrival,
      driverId,
      teamDriverId,
      truckId,
      trailerId,
      trailer2Id,
      dollyId,
      notes,
      status
    } = req.body;

    console.log('CreateTrip request body:', {
      linehaulProfileId,
      dispatchDate,
      driverId,
      truckId,
      dollyId,
      notes: notes?.substring(0, 50)
    });

    // Verify profile exists
    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: parseInt(linehaulProfileId, 10) }
    });

    if (!profile) {
      res.status(400).json({ message: 'Linehaul profile not found' });
      return;
    }

    // Generate trip number
    const tripNumber = await generateTripNumber();

    // Create trip and update equipment status in a transaction
    const trip = await prisma.$transaction(async (tx) => {
      // Create the trip
      // Use provided status if valid, otherwise default to PLANNED
      const validStatuses: TripStatus[] = ['PLANNED', 'ASSIGNED', 'DISPATCHED'];
      const tripStatus: TripStatus = status && validStatuses.includes(status) ? status : 'PLANNED';

      const newTrip = await tx.linehaulTrip.create({
        data: {
          tripNumber,
          linehaulProfileId: parseInt(linehaulProfileId, 10),
          dispatchDate: new Date(dispatchDate),
          plannedDeparture: plannedDeparture ? new Date(plannedDeparture) : null,
          plannedArrival: plannedArrival ? new Date(plannedArrival) : null,
          driverId: driverId ? parseInt(driverId, 10) : null,
          teamDriverId: teamDriverId ? parseInt(teamDriverId, 10) : null,
          truckId: truckId ? parseInt(truckId, 10) : null,
          trailerId: trailerId ? parseInt(trailerId, 10) : null,
          trailer2Id: trailer2Id ? parseInt(trailer2Id, 10) : null,
          dollyId: dollyId ? parseInt(dollyId, 10) : null,
          notes,
          status: tripStatus,
          ...(tripStatus === 'DISPATCHED' && { actualDeparture: new Date() })
        },
        include: {
          linehaulProfile: {
            select: { id: true, profileCode: true, name: true }
          },
          driver: {
            select: { id: true, name: true }
          },
          truck: {
            select: { id: true, unitNumber: true }
          },
          trailer: {
            select: { id: true, unitNumber: true }
          }
        }
      });

      return newTrip;
    });

    res.status(201).json(trip);
  } catch (error: any) {
    console.error('Error creating trip:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    res.status(500).json({
      message: 'Failed to create trip',
      error: error.message,
      code: error.code
    });
  }
};

// Update trip
export const updateTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    const existingTrip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId }
    });

    if (!existingTrip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const {
      dispatchDate,
      plannedDeparture,
      plannedArrival,
      actualDeparture,
      actualArrival,
      driverId,
      teamDriverId,
      truckId,
      trailerId,
      trailer2Id,
      trailer3Id,
      dollyId,
      dolly2Id,
      actualMileage,
      notes,
      status
    } = req.body;

    // Check if status is changing to ARRIVED or COMPLETED
    const isArrivingOrCompleting = status &&
      (status === 'ARRIVED' || status === 'COMPLETED') &&
      existingTrip.status !== 'ARRIVED' &&
      existingTrip.status !== 'COMPLETED';

    // Use transaction if we need to update loadsheets
    const trip = await prisma.$transaction(async (tx) => {
      // If arriving/completing, release loadsheets for next leg
      if (isArrivingOrCompleting) {
        // Get the trip's destination terminal code
        const tripWithProfile = await tx.linehaulTrip.findUnique({
          where: { id: tripId },
          include: {
            linehaulProfile: {
              include: {
                destinationTerminal: { select: { code: true } }
              }
            }
          }
        });

        const destinationCode = tripWithProfile?.linehaulProfile?.destinationTerminal?.code;

        // Update loadsheets: clear trip assignment, update origin to current location, reset status
        await tx.loadsheet.updateMany({
          where: { linehaulTripId: tripId },
          data: {
            linehaulTripId: null,
            // Update origin to where the freight now is (the arrival terminal)
            ...(destinationCode && { originTerminalCode: destinationCode }),
            // Clear destination since it's no longer assigned to a specific leg
            destinationTerminalCode: null,
            // Reset status to OPEN so loadsheet is available for next leg pickup
            status: 'OPEN'
          }
        });
      }

      return tx.linehaulTrip.update({
        where: { id: tripId },
        data: {
          ...(dispatchDate && { dispatchDate: new Date(dispatchDate) }),
          ...(plannedDeparture !== undefined && { plannedDeparture: plannedDeparture ? new Date(plannedDeparture) : null }),
          ...(plannedArrival !== undefined && { plannedArrival: plannedArrival ? new Date(plannedArrival) : null }),
          ...(actualDeparture !== undefined && { actualDeparture: actualDeparture ? new Date(actualDeparture) : null }),
          ...(actualArrival !== undefined && { actualArrival: actualArrival ? new Date(actualArrival) : null }),
          ...(driverId !== undefined && { driverId: driverId ? parseInt(driverId, 10) : null }),
          ...(teamDriverId !== undefined && { teamDriverId: teamDriverId ? parseInt(teamDriverId, 10) : null }),
          ...(truckId !== undefined && { truckId: truckId ? parseInt(truckId, 10) : null }),
          ...(trailerId !== undefined && { trailerId: trailerId ? parseInt(trailerId, 10) : null }),
          ...(trailer2Id !== undefined && { trailer2Id: trailer2Id ? parseInt(trailer2Id, 10) : null }),
          ...(trailer3Id !== undefined && { trailer3Id: trailer3Id ? parseInt(trailer3Id, 10) : null }),
          ...(dollyId !== undefined && { dollyId: dollyId ? parseInt(dollyId, 10) : null }),
          ...(dolly2Id !== undefined && { dolly2Id: dolly2Id ? parseInt(dolly2Id, 10) : null }),
          ...(actualMileage !== undefined && { actualMileage: actualMileage ? parseInt(actualMileage, 10) : null }),
          ...(notes !== undefined && { notes }),
          ...(status !== undefined && { status })
        },
        include: {
          linehaulProfile: {
            select: { id: true, profileCode: true, name: true }
          },
          driver: {
            select: { id: true, name: true }
          },
          truck: {
            select: { id: true, unitNumber: true }
          },
          trailer: {
            select: { id: true, unitNumber: true }
          }
        }
      });
    });

    res.json(trip);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ message: 'Failed to update trip' });
  }
};

// Update trip status
export const updateTripStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, actualDeparture, actualArrival, actualMiles, notes } = req.body;
    const tripId = parseInt(id, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        truck: true,
        trailer: true,
        trailer2: true,
        trailer3: true,
        dolly: true,
        dolly2: true,
        driver: true
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Update trip and equipment status in a transaction
    const updatedTrip = await prisma.$transaction(async (tx) => {
      // Determine equipment status based on trip status
      let equipmentStatus: EquipmentStatus | null = null;
      let driverStatus: string | null = null;

      switch (status as TripStatus) {
        case 'DISPATCHED':
          equipmentStatus = 'DISPATCHED';
          driverStatus = 'ON_DUTY';
          break;
        case 'IN_TRANSIT':
          equipmentStatus = 'IN_TRANSIT';
          driverStatus = 'DRIVING';
          break;
        case 'ARRIVED':
        case 'COMPLETED':
          equipmentStatus = 'AVAILABLE';
          driverStatus = 'AVAILABLE';
          break;
        case 'CANCELLED':
          equipmentStatus = 'AVAILABLE';
          driverStatus = 'AVAILABLE';
          break;
      }

      // Update equipment status if applicable
      if (equipmentStatus && trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: equipmentStatus }
        });
      }

      if (equipmentStatus && trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: equipmentStatus }
        });
      }

      if (equipmentStatus && trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: equipmentStatus }
        });
      }

      if (equipmentStatus && trip.trailer3Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer3Id },
          data: { status: equipmentStatus }
        });
      }

      if (equipmentStatus && trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: equipmentStatus }
        });
      }

      if (equipmentStatus && trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: equipmentStatus }
        });
      }

      // Update driver status if applicable
      if (driverStatus && trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: driverStatus as any }
        });
      }

      // When trip arrives or completes, release loadsheets for next leg
      // Update their origin to the arrival terminal so they're available for pickup there
      if (status === 'ARRIVED' || status === 'COMPLETED') {
        // Get the trip's destination terminal code
        const tripWithProfile = await tx.linehaulTrip.findUnique({
          where: { id: tripId },
          include: {
            linehaulProfile: {
              include: {
                destinationTerminal: { select: { code: true } }
              }
            }
          }
        });

        const destinationCode = tripWithProfile?.linehaulProfile?.destinationTerminal?.code;

        // Update loadsheets: clear trip assignment, update origin to current location, reset status
        await tx.loadsheet.updateMany({
          where: { linehaulTripId: tripId },
          data: {
            linehaulTripId: null,
            // Update origin to where the freight now is (the arrival terminal)
            ...(destinationCode && { originTerminalCode: destinationCode }),
            // Clear destination since it's no longer assigned to a specific leg
            destinationTerminalCode: null,
            // Reset status to OPEN so loadsheet is available for next leg pickup
            status: 'OPEN'
          }
        });
      }

      // Update the trip
      return tx.linehaulTrip.update({
        where: { id: tripId },
        data: {
          status: status as TripStatus,
          ...(actualDeparture && { actualDeparture: new Date(actualDeparture) }),
          ...(actualArrival && { actualArrival: new Date(actualArrival) }),
          ...(actualMiles !== undefined && { actualMiles: actualMiles ? new Prisma.Decimal(actualMiles) : null }),
          ...(notes !== undefined && { notes })
        },
        include: {
          linehaulProfile: {
            select: { id: true, profileCode: true, name: true }
          },
          driver: {
            select: { id: true, name: true }
          },
          truck: {
            select: { id: true, unitNumber: true, status: true }
          }
        }
      });
    });

    // Generate trip documents when dispatched (async, non-blocking)
    if (status === 'DISPATCHED') {
      tripDocumentService.generateAllDocuments(tripId)
        .then(() => {
          console.log(`Trip documents generated for trip ${tripId}`);
        })
        .catch((error) => {
          console.error(`Failed to generate trip documents for trip ${tripId}:`, error);
        });
    }

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error updating trip status:', error);
    res.status(500).json({ message: 'Failed to update trip status' });
  }
};

// Delete trip
export const deleteTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        _count: {
          select: { shipments: true, delays: true }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Only allow deletion of planned or cancelled trips
    if (!['PLANNED', 'CANCELLED'].includes(trip.status)) {
      res.status(400).json({
        message: 'Can only delete planned or cancelled trips'
      });
      return;
    }

    await prisma.linehaulTrip.delete({
      where: { id: tripId }
    });

    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ message: 'Failed to delete trip' });
  }
};

// Assign driver to trip
export const assignDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { driverId, teamDriverId } = req.body;
    const tripId = parseInt(id, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Verify drivers exist
    if (driverId) {
      const driver = await prisma.carrierDriver.findUnique({
        where: { id: parseInt(driverId, 10) }
      });
      if (!driver) {
        res.status(400).json({ message: 'Driver not found' });
        return;
      }
    }

    if (teamDriverId) {
      const teamDriver = await prisma.carrierDriver.findUnique({
        where: { id: parseInt(teamDriverId, 10) }
      });
      if (!teamDriver) {
        res.status(400).json({ message: 'Team driver not found' });
        return;
      }
    }

    const updatedTrip = await prisma.linehaulTrip.update({
      where: { id: tripId },
      data: {
        driverId: driverId ? parseInt(driverId, 10) : trip.driverId,
        teamDriverId: teamDriverId !== undefined ? (teamDriverId ? parseInt(teamDriverId, 10) : null) : trip.teamDriverId,
        status: trip.status === 'PLANNED' ? 'ASSIGNED' : trip.status
      },
      include: {
        driver: {
          select: { id: true, name: true, phoneNumber: true }
        },
        teamDriver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({ message: 'Failed to assign driver' });
  }
};

// Assign equipment to trip
export const assignEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { truckId, trailerId, trailer2Id, dollyId } = req.body;
    const tripId = parseInt(id, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    const updatedTrip = await prisma.linehaulTrip.update({
      where: { id: tripId },
      data: {
        truckId: truckId !== undefined ? (truckId ? parseInt(truckId, 10) : null) : trip.truckId,
        trailerId: trailerId !== undefined ? (trailerId ? parseInt(trailerId, 10) : null) : trip.trailerId,
        trailer2Id: trailer2Id !== undefined ? (trailer2Id ? parseInt(trailer2Id, 10) : null) : trip.trailer2Id,
        dollyId: dollyId !== undefined ? (dollyId ? parseInt(dollyId, 10) : null) : trip.dollyId
      },
      include: {
        truck: {
          select: { id: true, unitNumber: true, truckType: true }
        },
        trailer: {
          select: { id: true, unitNumber: true, trailerType: true }
        },
        trailer2: {
          select: { id: true, unitNumber: true, trailerType: true }
        },
        dolly: {
          select: { id: true, unitNumber: true, dollyType: true }
        }
      }
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error assigning equipment:', error);
    res.status(500).json({ message: 'Failed to assign equipment' });
  }
};

// Get trips for dispatch board (today's and upcoming trips)
export const getDispatchBoard = async (req: Request, res: Response) => {
  try {
    const { date, days = '1' } = req.query;

    const startDate = date ? new Date(date as string) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + parseInt(days as string, 10));

    const trips = await prisma.linehaulTrip.findMany({
      where: {
        dispatchDate: {
          gte: startDate,
          lt: endDate
        },
        status: {
          not: 'CANCELLED'
        }
      },
      orderBy: { dispatchDate: 'asc' },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: {
              select: { code: true, name: true, city: true, state: true }
            },
            destinationTerminal: {
              select: { code: true, name: true, city: true, state: true }
            }
          }
        },
        driver: {
          select: { id: true, name: true, phoneNumber: true, driverStatus: true }
        },
        teamDriver: {
          select: { id: true, name: true }
        },
        truck: {
          select: { id: true, unitNumber: true, status: true }
        },
        trailer: {
          select: { id: true, unitNumber: true, status: true }
        },
        _count: {
          select: { shipments: true, delays: true }
        }
      }
    });

    // Group trips by status
    const groupedTrips = {
      planned: trips.filter(t => t.status === 'PLANNED'),
      assigned: trips.filter(t => t.status === 'ASSIGNED'),
      dispatched: trips.filter(t => t.status === 'DISPATCHED'),
      inTransit: trips.filter(t => t.status === 'IN_TRANSIT'),
      arrived: trips.filter(t => t.status === 'ARRIVED'),
      completed: trips.filter(t => t.status === 'COMPLETED')
    };

    res.json({
      date: startDate.toISOString().split('T')[0],
      totalTrips: trips.length,
      trips: groupedTrips
    });
  } catch (error) {
    console.error('Error fetching dispatch board:', error);
    res.status(500).json({ message: 'Failed to fetch dispatch board' });
  }
};

// Dispatch trip (quick action to set status to DISPATCHED)
export const dispatchTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const tripId = parseInt(id, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        truck: true,
        trailer: true,
        trailer2: true,
        trailer3: true,
        dolly: true,
        dolly2: true,
        driver: true
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Validate trip can be dispatched
    if (!['PLANNED', 'ASSIGNED'].includes(trip.status)) {
      res.status(400).json({
        message: `Cannot dispatch trip with status '${trip.status}'. Trip must be in PLANNED or ASSIGNED status.`
      });
      return;
    }

    // Require driver and truck for dispatch
    if (!trip.driverId) {
      res.status(400).json({ message: 'Cannot dispatch trip without a driver assigned' });
      return;
    }

    if (!trip.truckId) {
      res.status(400).json({ message: 'Cannot dispatch trip without a truck assigned' });
      return;
    }

    // Update trip and equipment status in a transaction
    const updatedTrip = await prisma.$transaction(async (tx) => {
      // Update truck status to DISPATCHED
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update trailer(s) status to DISPATCHED
      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.trailer3Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer3Id },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update dolly(ies) status to DISPATCHED
      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update driver status to ON_DUTY
      if (trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: 'ON_DUTY' }
        });
      }

      // Update loadsheets associated with this trip: set status to DISPATCHED and reset door numbers
      await tx.loadsheet.updateMany({
        where: { linehaulTripId: tripId },
        data: {
          status: 'DISPATCHED',
          doorNumber: null
        }
      });

      // Update the trip
      return tx.linehaulTrip.update({
        where: { id: tripId },
        data: {
          status: 'DISPATCHED',
          actualDeparture: new Date(),
          ...(notes !== undefined && { notes: trip.notes ? `${trip.notes}\n${notes}` : notes })
        },
        include: {
          linehaulProfile: {
            select: { id: true, profileCode: true, name: true }
          },
          driver: {
            select: { id: true, name: true, phoneNumber: true }
          },
          truck: {
            select: { id: true, unitNumber: true, status: true }
          },
          trailer: {
            select: { id: true, unitNumber: true }
          }
        }
      });
    });

    // Generate trip documents asynchronously
    tripDocumentService.generateAllDocuments(tripId)
      .then(() => {
        console.log(`Trip documents generated for trip ${tripId}`);
      })
      .catch((error) => {
        console.error(`Failed to generate trip documents for trip ${tripId}:`, error);
      });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error dispatching trip:', error);
    res.status(500).json({ message: 'Failed to dispatch trip' });
  }
};

// Get driver's trips
export const getDriverTrips = async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const driverIdNum = parseInt(driverId, 10);

    const where: Prisma.LinehaulTripWhereInput = {
      OR: [
        { driverId: driverIdNum },
        { teamDriverId: driverIdNum }
      ]
    };

    if (status) {
      where.status = status as TripStatus;
    }

    if (startDate) {
      where.dispatchDate = {
        ...where.dispatchDate as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      // Set endDate to end of day to include all trips on that date
      const endOfDay = new Date(endDate as string);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.dispatchDate = {
        ...where.dispatchDate as object,
        lte: endOfDay
      };
    }

    const [trips, total] = await Promise.all([
      prisma.linehaulTrip.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { dispatchDate: 'desc' },
        include: {
          linehaulProfile: {
            include: {
              originTerminal: {
                select: { code: true, city: true, state: true }
              },
              destinationTerminal: {
                select: { code: true, city: true, state: true }
              }
            }
          },
          truck: {
            select: { id: true, unitNumber: true }
          },
          trailer: {
            select: { id: true, unitNumber: true }
          }
        }
      }),
      prisma.linehaulTrip.count({ where })
    ]);

    res.json({
      trips,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching driver trips:', error);
    res.status(500).json({ message: 'Failed to fetch driver trips' });
  }
};

// Get ETA for a trip
export const getTripEta = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    const result = await etaService.calculateEta(tripId);

    res.json(result);
  } catch (error) {
    console.error('Error calculating trip ETA:', error);
    res.status(500).json({ message: 'Failed to calculate trip ETA' });
  }
};

// Get ETA for multiple trips (batch)
export const getTripEtaBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripIds } = req.body;

    if (!Array.isArray(tripIds) || tripIds.length === 0) {
      res.status(400).json({ message: 'tripIds must be a non-empty array' });
      return;
    }

    const results = await etaService.calculateEtaBatch(tripIds);

    // Convert Map to object for JSON response
    const etaMap: Record<number, any> = {};
    results.forEach((value, key) => {
      etaMap[key] = value;
    });

    res.json({ etas: etaMap });
  } catch (error) {
    console.error('Error calculating batch ETAs:', error);
    res.status(500).json({ message: 'Failed to calculate batch ETAs' });
  }
};

// Get vehicle location from GoMotive API
export const getVehicleLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vehicleId } = req.params;

    // Look up the truck - try by database ID first, then by external fleet ID
    let truck = await prisma.equipmentTruck.findFirst({
      where: { id: parseInt(vehicleId, 10) || 0 },
      select: { id: true, unitNumber: true, externalFleetId: true }
    });

    // If not found by ID, try by externalFleetId
    if (!truck) {
      truck = await prisma.equipmentTruck.findFirst({
        where: { externalFleetId: vehicleId },
        select: { id: true, unitNumber: true, externalFleetId: true }
      });
    }

    if (!truck) {
      res.status(404).json({
        vehicleId,
        unitNumber: 'Unknown',
        error: 'Vehicle not found in system'
      });
      return;
    }

    // GoMotive API configuration
    const goMotiveApiKey = process.env.GOMOTIVE_API_KEY;
    const goMotiveApiUrl = process.env.GOMOTIVE_API_URL || 'https://api.gomotive.com/v3';

    if (!goMotiveApiKey || !truck.externalFleetId) {
      console.warn('GOMOTIVE_API_KEY not configured or no externalFleetId, returning mock data');
      // Return mock data for development
      res.json({
        vehicleId: truck.externalFleetId || String(truck.id),
        unitNumber: truck.unitNumber,
        location: {
          latitude: 33.7490 + (Math.random() - 0.5) * 2,
          longitude: -84.3880 + (Math.random() - 0.5) * 2,
          address: '123 Interstate Highway',
          city: 'Atlanta',
          state: 'GA',
          speed: Math.floor(Math.random() * 70),
          heading: Math.floor(Math.random() * 360),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Calculate date range for API (last 24 hours)
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const apiUrl = `${goMotiveApiUrl}/vehicle_locations/${vehicleId}?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${goMotiveApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GoMotive API error:', response.status, errorText);
      res.status(response.status).json({
        vehicleId,
        unitNumber: truck.unitNumber,
        error: `GoMotive API error: ${response.status}`
      });
      return;
    }

    const data = await response.json() as {
      vehicle_locations?: Array<{
        latitude?: number;
        lat?: number;
        longitude?: number;
        lng?: number;
        lon?: number;
        address?: string;
        located_at?: string;
        city?: string;
        state?: string;
        speed?: number;
        heading?: number;
        bearing?: number;
        timestamp?: string;
        created_at?: string;
      }>;
      locations?: Array<{
        latitude?: number;
        lat?: number;
        longitude?: number;
        lng?: number;
        lon?: number;
        address?: string;
        located_at?: string;
        city?: string;
        state?: string;
        speed?: number;
        heading?: number;
        bearing?: number;
        timestamp?: string;
        created_at?: string;
      }>;
    };

    // Parse GoMotive response and extract latest location
    // GoMotive API typically returns an array of location records
    const locations = data.vehicle_locations || data.locations || [];
    const latestLocation = locations.length > 0 ? locations[locations.length - 1] : null;

    if (!latestLocation) {
      res.json({
        vehicleId,
        unitNumber: truck.unitNumber,
        error: 'No location data available'
      });
      return;
    }

    res.json({
      vehicleId,
      unitNumber: truck.unitNumber,
      location: {
        latitude: latestLocation.latitude || latestLocation.lat,
        longitude: latestLocation.longitude || latestLocation.lng || latestLocation.lon,
        address: latestLocation.address || latestLocation.located_at,
        city: latestLocation.city,
        state: latestLocation.state,
        speed: latestLocation.speed,
        heading: latestLocation.heading || latestLocation.bearing,
        timestamp: latestLocation.located_at || latestLocation.timestamp || latestLocation.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching vehicle location:', error);
    res.status(500).json({
      vehicleId: req.params.vehicleId,
      unitNumber: 'Unknown',
      error: 'Failed to fetch vehicle location'
    });
  }
};

// Submit arrival details and create driver trip report
export const arriveTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);
    const {
      actualArrival,
      dropAndHook,
      chainUpCycles,
      waitTimeStart,
      waitTimeEnd,
      waitTimeReason,
      notes,
      equipmentIssue
    } = req.body;

    // Use provided arrival time or default to now
    const arrivalTime = actualArrival ? new Date(actualArrival) : new Date();

    // Get the trip with driver info
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        driver: true,
        truck: true,
        trailer: true,
        trailer2: true,
        dolly: true,
        dolly2: true,
        linehaulProfile: {
          include: {
            destinationTerminal: { select: { code: true } }
          }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Calculate wait time in minutes if both start and end are provided
    let waitTimeMinutes: number | null = null;
    if (waitTimeStart && waitTimeEnd) {
      const start = new Date(waitTimeStart);
      const end = new Date(waitTimeEnd);
      waitTimeMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    // Create the driver trip report and update trip status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update trip status to ARRIVED
      const updatedTrip = await tx.linehaulTrip.update({
        where: { id: tripId },
        data: {
          status: 'ARRIVED',
          actualArrival: arrivalTime
        }
      });

      // Update equipment status to AVAILABLE
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'AVAILABLE' }
        });
      }

      // Update driver status to AVAILABLE
      if (trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: 'AVAILABLE' }
        });
      }

      // Release loadsheets for next leg
      const destinationCode = trip.linehaulProfile?.destinationTerminal?.code;
      await tx.loadsheet.updateMany({
        where: { linehaulTripId: tripId },
        data: {
          linehaulTripId: null,
          ...(destinationCode && { originTerminalCode: destinationCode }),
          destinationTerminalCode: null,
          status: 'OPEN'
        }
      });

      // Create driver trip report
      const driverReport = await tx.driverTripReport.create({
        data: {
          tripId,
          driverId: trip.driverId,
          dropAndHook: dropAndHook !== undefined ? parseInt(dropAndHook, 10) : null,
          chainUpCycles: chainUpCycles !== undefined ? parseInt(chainUpCycles, 10) : null,
          waitTimeStart: waitTimeStart ? new Date(waitTimeStart) : null,
          waitTimeEnd: waitTimeEnd ? new Date(waitTimeEnd) : null,
          waitTimeMinutes,
          waitTimeReason: waitTimeReason || null,
          notes: notes || null,
          arrivedAt: arrivalTime
        }
      });

      // Create equipment issue if provided (for OWNOP trips)
      let createdIssue = null;
      if (equipmentIssue && equipmentIssue.equipmentType && equipmentIssue.equipmentNumber && equipmentIssue.description) {
        createdIssue = await tx.equipmentIssue.create({
          data: {
            tripId,
            driverId: trip.driverId,
            equipmentType: equipmentIssue.equipmentType,
            equipmentNumber: equipmentIssue.equipmentNumber,
            description: equipmentIssue.description,
            reportedAt: arrivalTime
          }
        });
      }

      return { trip: updatedTrip, driverReport, equipmentIssue: createdIssue };
    });

    res.json({
      message: 'Trip arrived successfully',
      trip: result.trip,
      driverReport: result.driverReport,
      equipmentIssue: result.equipmentIssue
    });
  } catch (error) {
    console.error('Error arriving trip:', error);
    res.status(500).json({ message: 'Failed to arrive trip' });
  }
};

// Get driver trip report for a trip
export const getDriverTripReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    const report = await prisma.driverTripReport.findUnique({
      where: { tripId },
      include: {
        trip: {
          select: {
            tripNumber: true,
            status: true,
            actualArrival: true
          }
        },
        driver: {
          select: { id: true, name: true }
        }
      }
    });

    if (!report) {
      res.status(404).json({ message: 'Driver trip report not found' });
      return;
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching driver trip report:', error);
    res.status(500).json({ message: 'Failed to fetch driver trip report' });
  }
};

// Get equipment issues for a trip
export const getTripEquipmentIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const tripId = parseInt(id, 10);

    const issues = await prisma.equipmentIssue.findMany({
      where: { tripId },
      include: {
        driver: {
          select: { id: true, name: true }
        },
        resolver: {
          select: { id: true, name: true }
        }
      },
      orderBy: { reportedAt: 'desc' }
    });

    res.json(issues);
  } catch (error) {
    console.error('Error fetching equipment issues:', error);
    res.status(500).json({ message: 'Failed to fetch equipment issues' });
  }
};

// Check if this is the driver's second arrival in 24 hours
export const checkDriverArrivalCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const driverIdNum = parseInt(driverId, 10);

    // Get arrivals in the last 24 hours for this driver
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const arrivalCount = await prisma.linehaulTrip.count({
      where: {
        driverId: driverIdNum,
        status: { in: ['ARRIVED', 'UNLOADING', 'COMPLETED'] },
        actualArrival: {
          gte: twentyFourHoursAgo
        }
      }
    });

    res.json({
      driverId: driverIdNum,
      arrivalCount,
      isSecondArrival: arrivalCount >= 1 // >= 1 because we check BEFORE recording the current arrival
    });
  } catch (error) {
    console.error('Error checking driver arrival count:', error);
    res.status(500).json({ message: 'Failed to check driver arrival count' });
  }
};

// Save driver morale rating
export const saveMoraleRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, driverId, rating } = req.body;

    if (!tripId || !driverId || !rating) {
      res.status(400).json({ message: 'tripId, driverId, and rating are required' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ message: 'Rating must be between 1 and 5' });
      return;
    }

    // Check if rating already exists for this trip
    const existingRating = await prisma.driverMoraleRating.findUnique({
      where: { tripId: parseInt(tripId, 10) }
    });

    if (existingRating) {
      res.status(400).json({ message: 'Morale rating already exists for this trip' });
      return;
    }

    const moraleRating = await prisma.driverMoraleRating.create({
      data: {
        tripId: parseInt(tripId, 10),
        driverId: parseInt(driverId, 10),
        rating: parseInt(rating, 10),
        arrivedAt: new Date()
      },
      include: {
        driver: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json(moraleRating);
  } catch (error) {
    console.error('Error saving morale rating:', error);
    res.status(500).json({ message: 'Failed to save morale rating' });
  }
};

// Get morale report data
export const getMoraleReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, driverId, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.DriverMoraleRatingWhereInput = {};

    if (driverId) {
      where.driverId = parseInt(driverId as string, 10);
    }

    if (startDate) {
      where.arrivedAt = {
        ...where.arrivedAt as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      const endOfDay = new Date(endDate as string);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.arrivedAt = {
        ...where.arrivedAt as object,
        lte: endOfDay
      };
    }

    const [ratings, total, aggregations] = await Promise.all([
      prisma.driverMoraleRating.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { arrivedAt: 'desc' },
        include: {
          driver: {
            select: { id: true, name: true }
          },
          trip: {
            select: {
              tripNumber: true,
              linehaulProfile: {
                select: {
                  originTerminal: { select: { code: true } },
                  destinationTerminal: { select: { code: true } }
                }
              }
            }
          }
        }
      }),
      prisma.driverMoraleRating.count({ where }),
      prisma.driverMoraleRating.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true }
      })
    ]);

    // Get rating distribution
    const ratingDistribution = await prisma.driverMoraleRating.groupBy({
      by: ['rating'],
      where,
      _count: { rating: true }
    });

    // Get average rating by driver
    const driverAverages = await prisma.driverMoraleRating.groupBy({
      by: ['driverId'],
      where,
      _avg: { rating: true },
      _count: { rating: true }
    });

    // Get driver names for the averages
    const driverIds = driverAverages.map(d => d.driverId);
    const drivers = await prisma.carrierDriver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, name: true }
    });

    const driverAveragesWithNames = driverAverages.map(avg => {
      const driver = drivers.find(d => d.id === avg.driverId);
      return {
        driverId: avg.driverId,
        driverName: driver?.name || 'Unknown',
        averageRating: avg._avg.rating,
        ratingCount: avg._count.rating
      };
    }).sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));

    res.json({
      ratings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      summary: {
        averageRating: aggregations._avg.rating,
        totalRatings: aggregations._count.rating,
        ratingDistribution: ratingDistribution.reduce((acc, curr) => {
          acc[curr.rating] = curr._count.rating;
          return acc;
        }, {} as Record<number, number>),
        driverAverages: driverAveragesWithNames
      }
    });
  } catch (error) {
    console.error('Error fetching morale report:', error);
    res.status(500).json({ message: 'Failed to fetch morale report' });
  }
};
