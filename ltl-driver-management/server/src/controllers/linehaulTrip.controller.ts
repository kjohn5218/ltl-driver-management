import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, TripStatus, EquipmentStatus } from '@prisma/client';

// Get all trips with filtering
export const getTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      profileId,
      driverId,
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
        { linehaulProfile: { name: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    if (status) {
      where.status = status as TripStatus;
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

    if (startDate) {
      where.dispatchDate = {
        ...where.dispatchDate as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      where.dispatchDate = {
        ...where.dispatchDate as object,
        lte: new Date(endDate as string)
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
            select: { id: true, profileCode: true, name: true }
          },
          driver: {
            select: { id: true, name: true, phoneNumber: true }
          },
          teamDriver: {
            select: { id: true, name: true }
          },
          truck: {
            select: { id: true, unitNumber: true, truckType: true }
          },
          trailer: {
            select: { id: true, unitNumber: true, trailerType: true }
          },
          _count: {
            select: { shipments: true, delays: true }
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
        dolly: true,
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

// Generate unique trip number
const generateTripNumber = async (profileCode: string): Promise<string> => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `${profileCode}-${dateStr}`;

  const lastTrip = await prisma.linehaulTrip.findFirst({
    where: { tripNumber: { startsWith: prefix } },
    orderBy: { tripNumber: 'desc' }
  });

  let sequence = 1;
  if (lastTrip) {
    const lastSeq = parseInt(lastTrip.tripNumber.split('-').pop() || '0', 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}-${sequence.toString().padStart(3, '0')}`;
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
      notes
    } = req.body;

    // Verify profile exists
    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: parseInt(linehaulProfileId, 10) }
    });

    if (!profile) {
      res.status(400).json({ message: 'Linehaul profile not found' });
      return;
    }

    // Generate trip number
    const tripNumber = await generateTripNumber(profile.profileCode);

    // Create trip and update equipment status in a transaction
    const trip = await prisma.$transaction(async (tx) => {
      // Create the trip
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
          status: 'PLANNED'
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
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Failed to create trip' });
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
      driverId,
      teamDriverId,
      truckId,
      trailerId,
      trailer2Id,
      dollyId,
      notes
    } = req.body;

    const trip = await prisma.linehaulTrip.update({
      where: { id: tripId },
      data: {
        ...(dispatchDate && { dispatchDate: new Date(dispatchDate) }),
        ...(plannedDeparture !== undefined && { plannedDeparture: plannedDeparture ? new Date(plannedDeparture) : null }),
        ...(plannedArrival !== undefined && { plannedArrival: plannedArrival ? new Date(plannedArrival) : null }),
        ...(driverId !== undefined && { driverId: driverId ? parseInt(driverId, 10) : null }),
        ...(teamDriverId !== undefined && { teamDriverId: teamDriverId ? parseInt(teamDriverId, 10) : null }),
        ...(truckId !== undefined && { truckId: truckId ? parseInt(truckId, 10) : null }),
        ...(trailerId !== undefined && { trailerId: trailerId ? parseInt(trailerId, 10) : null }),
        ...(trailer2Id !== undefined && { trailer2Id: trailer2Id ? parseInt(trailer2Id, 10) : null }),
        ...(dollyId !== undefined && { dollyId: dollyId ? parseInt(dollyId, 10) : null }),
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
          select: { id: true, unitNumber: true }
        },
        trailer: {
          select: { id: true, unitNumber: true }
        }
      }
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
        dolly: true,
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

      if (equipmentStatus && trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
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
      where.dispatchDate = {
        ...where.dispatchDate as object,
        lte: new Date(endDate as string)
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
