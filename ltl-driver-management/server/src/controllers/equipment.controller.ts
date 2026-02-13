import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, EquipmentStatus, TruckType, TrailerType, DollyType } from '@prisma/client';
import { fleetMockService } from '../services/fleet.mock.service';

// ==================== TRUCKS ====================

// Get all trucks with filtering
export const getTrucks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      truckType,
      terminalId,
      available,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.EquipmentTruckWhereInput = {};

    if (search) {
      where.OR = [
        { unitNumber: { contains: search as string, mode: 'insensitive' } },
        { vin: { contains: search as string, mode: 'insensitive' } },
        { licensePlate: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status as EquipmentStatus;
    }

    if (truckType) {
      where.truckType = truckType as TruckType;
    }

    if (terminalId) {
      where.currentTerminalId = parseInt(terminalId as string, 10);
    }

    if (available === 'true') {
      where.status = 'AVAILABLE';
    }

    const [trucks, total] = await Promise.all([
      prisma.equipmentTruck.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { unitNumber: 'asc' },
        include: {
          currentTerminal: {
            select: { id: true, code: true, name: true }
          },
          assignedDriver: {
            select: { id: true, name: true }
          },
          linehaulTrips: {
            where: {
              status: { in: ['ARRIVED', 'COMPLETED', 'UNLOADING'] },
              actualArrival: { not: null }
            },
            orderBy: { actualArrival: 'desc' },
            take: 1,
            include: {
              linehaulProfile: {
                include: {
                  destinationTerminal: {
                    select: { id: true, code: true, name: true }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.equipmentTruck.count({ where })
    ]);

    // Transform trucks to include lastArrivalTerminal, locationSource, and GPS data
    const transformedTrucks = trucks.map(truck => {
      const lastTrip = truck.linehaulTrips?.[0];
      const lastArrivalTerminal = lastTrip?.linehaulProfile?.destinationTerminal || null;
      const lastTripArrivalTime = lastTrip?.actualArrival ? new Date(lastTrip.actualArrival) : null;
      const lastSyncTime = truck.lastLocationUpdate ? new Date(truck.lastLocationUpdate) : null;

      // Determine location source and effective terminal
      let locationSource: 'yard_sync' | 'trip_arrival' | 'manual' | null = null;
      let effectiveTerminal = null;

      if (lastTripArrivalTime && lastSyncTime) {
        // Both sources available - use the more recent one
        if (lastSyncTime > lastTripArrivalTime) {
          locationSource = 'yard_sync';
          effectiveTerminal = truck.currentTerminal;
        } else {
          locationSource = 'trip_arrival';
          effectiveTerminal = lastArrivalTerminal;
        }
      } else if (lastTripArrivalTime) {
        locationSource = 'trip_arrival';
        effectiveTerminal = lastArrivalTerminal;
      } else if (truck.currentTerminal) {
        locationSource = truck.lastLocationUpdate ? 'yard_sync' : 'manual';
        effectiveTerminal = truck.currentTerminal;
      }

      const { linehaulTrips, ...truckData } = truck;
      return {
        ...truckData,
        lastArrivalTerminal,
        locationSource,
        effectiveTerminal,
        // Include GPS data (convert Decimal to number)
        currentLatitude: truck.currentLatitude ? Number(truck.currentLatitude) : null,
        currentLongitude: truck.currentLongitude ? Number(truck.currentLongitude) : null,
        lastLocationUpdate: truck.lastLocationUpdate
      };
    });

    // If no trucks in database, fallback to mock fleet data
    if (total === 0 && !search && !status && !truckType && !terminalId) {
      console.log('No trucks in database, using mock fleet data');
      const mockData = await fleetMockService.getTrucks({
        search: search as string,
        status: status as EquipmentStatus,
        type: truckType as TruckType,
        limit: limitNum,
        page: pageNum
      });

      res.json({
        trucks: mockData.trucks.map(t => ({
          id: t.id,
          unitNumber: t.unitNumber,
          truckType: t.truckType,
          make: t.make,
          model: t.model,
          year: t.year,
          vin: t.vin,
          status: t.status,
          licensePlate: t.licensePlate,
          licensePlateState: t.licensePlateState,
          fuelType: t.fuelType,
          maintenanceStatus: t.maintenanceStatus,
          maintenanceNotes: t.maintenanceNotes,
          owned: t.owned,
          externalFleetId: t.externalFleetId,
          currentTerminal: null,
          assignedDriver: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: mockData.total,
          totalPages: Math.ceil(mockData.total / limitNum)
        },
        source: 'fleet_mock'
      });
      return;
    }

    res.json({
      trucks: transformedTrucks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching trucks:', error);
    res.status(500).json({ message: 'Failed to fetch trucks' });
  }
};

// Get truck by ID
export const getTruckById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const truck = await prisma.equipmentTruck.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        currentTerminal: true,
        assignedDriver: {
          select: { id: true, name: true, phoneNumber: true, email: true }
        },
        linehaulTrips: {
          take: 10,
          orderBy: { dispatchDate: 'desc' },
          include: {
            linehaulProfile: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!truck) {
      res.status(404).json({ message: 'Truck not found' });
      return;
    }

    res.json(truck);
  } catch (error) {
    console.error('Error fetching truck:', error);
    res.status(500).json({ message: 'Failed to fetch truck' });
  }
};

// Create new truck
export const createTruck = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      unitNumber,
      vin,
      truckType,
      make,
      model,
      year,
      licensePlate,
      licensePlateState,
      currentTerminalId,
      assignedDriverId,
      fuelType,
      nextMaintenanceDate,
      status
    } = req.body;

    // Check for duplicate unit number
    const existingTruck = await prisma.equipmentTruck.findFirst({
      where: { unitNumber: unitNumber.toUpperCase() }
    });

    if (existingTruck) {
      res.status(400).json({ message: 'Unit number already exists' });
      return;
    }

    const truck = await prisma.equipmentTruck.create({
      data: {
        unitNumber: unitNumber.toUpperCase(),
        vin: vin?.toUpperCase(),
        truckType: truckType || 'DAY_CAB',
        make,
        model,
        year: year ? parseInt(year, 10) : null,
        licensePlate: licensePlate?.toUpperCase(),
        licensePlateState: licensePlateState?.toUpperCase(),
        currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null,
        assignedDriverId: assignedDriverId ? parseInt(assignedDriverId, 10) : null,
        fuelType,
        nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
        status: status || 'AVAILABLE'
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(truck);
  } catch (error) {
    console.error('Error creating truck:', error);
    res.status(500).json({ message: 'Failed to create truck' });
  }
};

// Update truck
export const updateTruck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const truckId = parseInt(id, 10);

    const existingTruck = await prisma.equipmentTruck.findUnique({
      where: { id: truckId }
    });

    if (!existingTruck) {
      res.status(404).json({ message: 'Truck not found' });
      return;
    }

    const {
      unitNumber,
      vin,
      truckType,
      make,
      model,
      year,
      licensePlate,
      licensePlateState,
      currentTerminalId,
      assignedDriverId,
      fuelType,
      nextMaintenanceDate,
      status,
      maintenanceStatus,
      maintenanceNotes
    } = req.body;

    // Check for unit number conflict
    if (unitNumber && unitNumber.toUpperCase() !== existingTruck.unitNumber) {
      const conflict = await prisma.equipmentTruck.findFirst({
        where: { unitNumber: unitNumber.toUpperCase() }
      });
      if (conflict) {
        res.status(400).json({ message: 'Unit number already exists' });
        return;
      }
    }

    const truck = await prisma.equipmentTruck.update({
      where: { id: truckId },
      data: {
        ...(unitNumber && { unitNumber: unitNumber.toUpperCase() }),
        ...(vin !== undefined && { vin: vin?.toUpperCase() }),
        ...(truckType && { truckType }),
        ...(make !== undefined && { make }),
        ...(model !== undefined && { model }),
        ...(year !== undefined && { year: year ? parseInt(year, 10) : null }),
        ...(licensePlate !== undefined && { licensePlate: licensePlate?.toUpperCase() }),
        ...(licensePlateState !== undefined && { licensePlateState: licensePlateState?.toUpperCase() }),
        ...(currentTerminalId !== undefined && { currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null }),
        ...(assignedDriverId !== undefined && { assignedDriverId: assignedDriverId ? parseInt(assignedDriverId, 10) : null }),
        ...(fuelType !== undefined && { fuelType }),
        ...(nextMaintenanceDate !== undefined && { nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null }),
        ...(status && { status }),
        ...(maintenanceStatus !== undefined && { maintenanceStatus }),
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.json(truck);
  } catch (error) {
    console.error('Error updating truck:', error);
    res.status(500).json({ message: 'Failed to update truck' });
  }
};

// Delete truck
export const deleteTruck = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const truckId = parseInt(id, 10);

    const truck = await prisma.equipmentTruck.findUnique({
      where: { id: truckId },
      include: {
        _count: {
          select: { linehaulTrips: true }
        }
      }
    });

    if (!truck) {
      res.status(404).json({ message: 'Truck not found' });
      return;
    }

    if (truck._count.linehaulTrips > 0) {
      res.status(400).json({
        message: 'Cannot delete truck with associated trips. Please reassign trips first.',
        tripCount: truck._count.linehaulTrips
      });
      return;
    }

    await prisma.equipmentTruck.delete({
      where: { id: truckId }
    });

    res.json({ message: 'Truck deleted successfully' });
  } catch (error) {
    console.error('Error deleting truck:', error);
    res.status(500).json({ message: 'Failed to delete truck' });
  }
};

// Update truck status
export const updateTruckStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, maintenanceNotes } = req.body;
    const truckId = parseInt(id, 10);

    const truck = await prisma.equipmentTruck.update({
      where: { id: truckId },
      data: {
        status,
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      }
    });

    res.json(truck);
  } catch (error) {
    console.error('Error updating truck status:', error);
    res.status(500).json({ message: 'Failed to update truck status' });
  }
};

// Update truck location
export const updateTruckLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const truckId = parseInt(id, 10);

    const truck = await prisma.equipmentTruck.update({
      where: { id: truckId },
      data: {
        lastLocationUpdate: new Date()
      }
    });

    res.json(truck);
  } catch (error) {
    console.error('Error updating truck location:', error);
    res.status(500).json({ message: 'Failed to update truck location' });
  }
};

// ==================== TRAILERS ====================

// Get all trailers with filtering
export const getTrailers = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      trailerType,
      terminalId,
      available,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.EquipmentTrailerWhereInput = {};

    if (search) {
      where.OR = [
        { unitNumber: { contains: search as string, mode: 'insensitive' } },
        { licensePlate: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status as EquipmentStatus;
    }

    if (trailerType) {
      where.trailerType = trailerType as TrailerType;
    }

    if (terminalId) {
      where.currentTerminalId = parseInt(terminalId as string, 10);
    }

    if (available === 'true') {
      where.status = 'AVAILABLE';
    }

    const tripInclude = {
      where: {
        status: { in: ['ARRIVED', 'COMPLETED', 'UNLOADING'] as ('ARRIVED' | 'COMPLETED' | 'UNLOADING')[] },
        actualArrival: { not: null }
      },
      orderBy: { actualArrival: 'desc' as const },
      take: 1,
      include: {
        linehaulProfile: {
          include: {
            destinationTerminal: {
              select: { id: true, code: true, name: true }
            }
          }
        }
      }
    };

    const [trailers, total] = await Promise.all([
      prisma.equipmentTrailer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { unitNumber: 'asc' },
        include: {
          currentTerminal: {
            select: { id: true, code: true, name: true }
          },
          primaryTrips: tripInclude,
          secondaryTrips: tripInclude,
          tertiaryTrips: tripInclude
        }
      }),
      prisma.equipmentTrailer.count({ where })
    ]);

    // Transform trailers to include lastArrivalTerminal, locationSource, and effectiveTerminal
    const transformedTrailers = trailers.map((trailer: any) => {
      // Get all trips and find the most recent arrival
      const allTrips = [
        ...(trailer.primaryTrips || []),
        ...(trailer.secondaryTrips || []),
        ...(trailer.tertiaryTrips || [])
      ].filter((t: any) => t.actualArrival);

      // Sort by actualArrival descending and get the most recent
      allTrips.sort((a: any, b: any) => {
        const dateA = a.actualArrival ? new Date(a.actualArrival).getTime() : 0;
        const dateB = b.actualArrival ? new Date(b.actualArrival).getTime() : 0;
        return dateB - dateA;
      });

      const lastTrip = allTrips[0];
      const lastArrivalTerminal = lastTrip?.linehaulProfile?.destinationTerminal || null;
      const lastTripArrivalTime = lastTrip?.actualArrival ? new Date(lastTrip.actualArrival) : null;
      const lastSyncTime = trailer.lastLocationUpdate ? new Date(trailer.lastLocationUpdate) : null;

      // Determine location source and effective terminal
      let locationSource: 'yard_sync' | 'trip_arrival' | 'manual' | null = null;
      let effectiveTerminal = null;

      if (lastTripArrivalTime && lastSyncTime) {
        // Both sources available - use the more recent one
        if (lastSyncTime > lastTripArrivalTime) {
          locationSource = 'yard_sync';
          effectiveTerminal = trailer.currentTerminal;
        } else {
          locationSource = 'trip_arrival';
          effectiveTerminal = lastArrivalTerminal;
        }
      } else if (lastTripArrivalTime) {
        locationSource = 'trip_arrival';
        effectiveTerminal = lastArrivalTerminal;
      } else if (trailer.currentTerminal) {
        locationSource = trailer.lastLocationUpdate ? 'yard_sync' : 'manual';
        effectiveTerminal = trailer.currentTerminal;
      }

      const { primaryTrips, secondaryTrips, tertiaryTrips, ...trailerData } = trailer;
      return {
        ...trailerData,
        lastArrivalTerminal,
        locationSource,
        effectiveTerminal,
        lastLocationUpdate: trailer.lastLocationUpdate
      };
    });

    // If no trailers in database, fallback to mock fleet data
    if (total === 0 && !search && !status && !trailerType && !terminalId) {
      console.log('No trailers in database, using mock fleet data');
      const mockData = await fleetMockService.getTrailers({
        search: search as string,
        status: status as EquipmentStatus,
        type: trailerType as TrailerType,
        limit: limitNum,
        page: pageNum
      });

      res.json({
        trailers: mockData.trailers.map(t => ({
          id: t.id,
          unitNumber: t.unitNumber,
          trailerType: t.trailerType,
          lengthFeet: t.lengthFeet,
          capacityWeight: t.capacityWeight,
          capacityCube: t.capacityCube,
          status: t.status,
          currentLocation: t.currentLocation,
          licensePlate: t.licensePlate,
          licensePlateState: t.licensePlateState,
          maintenanceStatus: t.maintenanceStatus,
          maintenanceNotes: t.maintenanceNotes,
          owned: t.owned,
          externalFleetId: t.externalFleetId,
          currentTerminal: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: mockData.total,
          totalPages: Math.ceil(mockData.total / limitNum)
        },
        source: 'fleet_mock' // Indicates data comes from mock fleet service
      });
      return;
    }

    res.json({
      trailers: transformedTrailers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching trailers:', error);
    res.status(500).json({ message: 'Failed to fetch trailers' });
  }
};

// Get trailer by ID
export const getTrailerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const trailer = await prisma.equipmentTrailer.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        currentTerminal: true,
        primaryTrips: {
          take: 10,
          orderBy: { dispatchDate: 'desc' },
          include: {
            linehaulProfile: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!trailer) {
      res.status(404).json({ message: 'Trailer not found' });
      return;
    }

    res.json(trailer);
  } catch (error) {
    console.error('Error fetching trailer:', error);
    res.status(500).json({ message: 'Failed to fetch trailer' });
  }
};

// Create new trailer
export const createTrailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      unitNumber,
      trailerType,
      lengthFeet,
      capacityWeight,
      capacityCube,
      currentTerminalId,
      licensePlate,
      licensePlateState,
      lastInspectionDate,
      nextInspectionDate,
      status
    } = req.body;

    const existingTrailer = await prisma.equipmentTrailer.findFirst({
      where: { unitNumber: unitNumber.toUpperCase() }
    });

    if (existingTrailer) {
      res.status(400).json({ message: 'Unit number already exists' });
      return;
    }

    const trailer = await prisma.equipmentTrailer.create({
      data: {
        unitNumber: unitNumber.toUpperCase(),
        trailerType: trailerType || 'DRY_VAN_53',
        lengthFeet: lengthFeet ? parseInt(lengthFeet, 10) : null,
        capacityWeight: capacityWeight ? parseInt(capacityWeight, 10) : null,
        capacityCube: capacityCube ? parseInt(capacityCube, 10) : null,
        currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null,
        licensePlate: licensePlate?.toUpperCase(),
        licensePlateState: licensePlateState?.toUpperCase(),
        lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null,
        nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : null,
        status: status || 'AVAILABLE'
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(trailer);
  } catch (error) {
    console.error('Error creating trailer:', error);
    res.status(500).json({ message: 'Failed to create trailer' });
  }
};

// Update trailer
export const updateTrailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const trailerId = parseInt(id, 10);

    const existingTrailer = await prisma.equipmentTrailer.findUnique({
      where: { id: trailerId }
    });

    if (!existingTrailer) {
      res.status(404).json({ message: 'Trailer not found' });
      return;
    }

    const {
      unitNumber,
      trailerType,
      lengthFeet,
      capacityWeight,
      capacityCube,
      currentTerminalId,
      licensePlate,
      licensePlateState,
      lastInspectionDate,
      nextInspectionDate,
      status,
      maintenanceStatus,
      maintenanceNotes
    } = req.body;

    if (unitNumber && unitNumber.toUpperCase() !== existingTrailer.unitNumber) {
      const conflict = await prisma.equipmentTrailer.findFirst({
        where: { unitNumber: unitNumber.toUpperCase() }
      });
      if (conflict) {
        res.status(400).json({ message: 'Unit number already exists' });
        return;
      }
    }

    const trailer = await prisma.equipmentTrailer.update({
      where: { id: trailerId },
      data: {
        ...(unitNumber && { unitNumber: unitNumber.toUpperCase() }),
        ...(trailerType && { trailerType }),
        ...(lengthFeet !== undefined && { lengthFeet: lengthFeet ? parseInt(lengthFeet, 10) : null }),
        ...(capacityWeight !== undefined && { capacityWeight: capacityWeight ? parseInt(capacityWeight, 10) : null }),
        ...(capacityCube !== undefined && { capacityCube: capacityCube ? parseInt(capacityCube, 10) : null }),
        ...(currentTerminalId !== undefined && { currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null }),
        ...(licensePlate !== undefined && { licensePlate: licensePlate?.toUpperCase() }),
        ...(licensePlateState !== undefined && { licensePlateState: licensePlateState?.toUpperCase() }),
        ...(lastInspectionDate !== undefined && { lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null }),
        ...(nextInspectionDate !== undefined && { nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : null }),
        ...(status && { status }),
        ...(maintenanceStatus !== undefined && { maintenanceStatus }),
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.json(trailer);
  } catch (error) {
    console.error('Error updating trailer:', error);
    res.status(500).json({ message: 'Failed to update trailer' });
  }
};

// Delete trailer
export const deleteTrailer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const trailerId = parseInt(id, 10);

    const trailer = await prisma.equipmentTrailer.findUnique({
      where: { id: trailerId },
      include: {
        _count: {
          select: { primaryTrips: true, secondaryTrips: true }
        }
      }
    });

    if (!trailer) {
      res.status(404).json({ message: 'Trailer not found' });
      return;
    }

    const totalTrips = trailer._count.primaryTrips + trailer._count.secondaryTrips;
    if (totalTrips > 0) {
      res.status(400).json({
        message: 'Cannot delete trailer with associated trips.',
        tripCount: totalTrips
      });
      return;
    }

    await prisma.equipmentTrailer.delete({
      where: { id: trailerId }
    });

    res.json({ message: 'Trailer deleted successfully' });
  } catch (error) {
    console.error('Error deleting trailer:', error);
    res.status(500).json({ message: 'Failed to delete trailer' });
  }
};

// Update trailer status
export const updateTrailerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, maintenanceNotes } = req.body;
    const trailerId = parseInt(id, 10);

    const trailer = await prisma.equipmentTrailer.update({
      where: { id: trailerId },
      data: {
        status,
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      }
    });

    res.json(trailer);
  } catch (error) {
    console.error('Error updating trailer status:', error);
    res.status(500).json({ message: 'Failed to update trailer status' });
  }
};

// ==================== DOLLIES ====================

// Get all dollies with filtering
export const getDollies = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      dollyType,
      terminalId,
      available,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.EquipmentDollyWhereInput = {};

    if (search) {
      where.unitNumber = { contains: search as string, mode: 'insensitive' };
    }

    if (status) {
      where.status = status as EquipmentStatus;
    }

    if (dollyType) {
      where.dollyType = dollyType as DollyType;
    }

    if (terminalId) {
      where.currentTerminalId = parseInt(terminalId as string, 10);
    }

    if (available === 'true') {
      where.status = 'AVAILABLE';
    }

    const dollyTripInclude = {
      where: {
        status: { in: ['ARRIVED', 'COMPLETED', 'UNLOADING'] as ('ARRIVED' | 'COMPLETED' | 'UNLOADING')[] },
        actualArrival: { not: null }
      },
      orderBy: { actualArrival: 'desc' as const },
      take: 1,
      include: {
        linehaulProfile: {
          include: {
            destinationTerminal: {
              select: { id: true, code: true, name: true }
            }
          }
        }
      }
    };

    const [dollies, total] = await Promise.all([
      prisma.equipmentDolly.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { unitNumber: 'asc' },
        include: {
          currentTerminal: {
            select: { id: true, code: true, name: true }
          },
          linehaulTrips: dollyTripInclude,
          linehaulTrips2: dollyTripInclude
        }
      }),
      prisma.equipmentDolly.count({ where })
    ]);

    // Transform dollies to include lastArrivalTerminal, locationSource, and effectiveTerminal
    const transformedDollies = dollies.map((dolly: any) => {
      // Get all trips and find the most recent arrival
      const allTrips = [
        ...(dolly.linehaulTrips || []),
        ...(dolly.linehaulTrips2 || [])
      ].filter((t: any) => t.actualArrival);

      // Sort by actualArrival descending and get the most recent
      allTrips.sort((a: any, b: any) => {
        const dateA = a.actualArrival ? new Date(a.actualArrival).getTime() : 0;
        const dateB = b.actualArrival ? new Date(b.actualArrival).getTime() : 0;
        return dateB - dateA;
      });

      const lastTrip = allTrips[0];
      const lastArrivalTerminal = lastTrip?.linehaulProfile?.destinationTerminal || null;
      const lastTripArrivalTime = lastTrip?.actualArrival ? new Date(lastTrip.actualArrival) : null;
      const lastSyncTime = dolly.lastLocationUpdate ? new Date(dolly.lastLocationUpdate) : null;

      // Determine location source and effective terminal
      let locationSource: 'yard_sync' | 'trip_arrival' | 'manual' | null = null;
      let effectiveTerminal = null;

      if (lastTripArrivalTime && lastSyncTime) {
        // Both sources available - use the more recent one
        if (lastSyncTime > lastTripArrivalTime) {
          locationSource = 'yard_sync';
          effectiveTerminal = dolly.currentTerminal;
        } else {
          locationSource = 'trip_arrival';
          effectiveTerminal = lastArrivalTerminal;
        }
      } else if (lastTripArrivalTime) {
        locationSource = 'trip_arrival';
        effectiveTerminal = lastArrivalTerminal;
      } else if (dolly.currentTerminal) {
        locationSource = dolly.lastLocationUpdate ? 'yard_sync' : 'manual';
        effectiveTerminal = dolly.currentTerminal;
      }

      const { linehaulTrips, linehaulTrips2, ...dollyData } = dolly;
      return {
        ...dollyData,
        lastArrivalTerminal,
        locationSource,
        effectiveTerminal,
        lastLocationUpdate: dolly.lastLocationUpdate
      };
    });

    // If no dollies in database, fallback to mock fleet data
    if (total === 0 && !search && !status && !dollyType && !terminalId) {
      console.log('No dollies in database, using mock fleet data');
      const mockData = await fleetMockService.getDollies({
        search: search as string,
        status: status as EquipmentStatus,
        type: dollyType as DollyType,
        limit: limitNum,
        page: pageNum
      });

      res.json({
        dollies: mockData.dollies.map(d => ({
          id: d.id,
          unitNumber: d.unitNumber,
          dollyType: d.dollyType,
          status: d.status,
          maintenanceStatus: d.maintenanceStatus,
          maintenanceNotes: d.maintenanceNotes,
          externalFleetId: d.externalFleetId,
          currentTerminal: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: mockData.total,
          totalPages: Math.ceil(mockData.total / limitNum)
        },
        source: 'fleet_mock'
      });
      return;
    }

    res.json({
      dollies: transformedDollies,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching dollies:', error);
    res.status(500).json({ message: 'Failed to fetch dollies' });
  }
};

// Get dolly by ID
export const getDollyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const dolly = await prisma.equipmentDolly.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        currentTerminal: true,
        linehaulTrips: {
          take: 10,
          orderBy: { dispatchDate: 'desc' },
          include: {
            linehaulProfile: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!dolly) {
      res.status(404).json({ message: 'Dolly not found' });
      return;
    }

    res.json(dolly);
  } catch (error) {
    console.error('Error fetching dolly:', error);
    res.status(500).json({ message: 'Failed to fetch dolly' });
  }
};

// Create new dolly
export const createDolly = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      unitNumber,
      dollyType,
      currentTerminalId,
      lastInspectionDate,
      nextInspectionDate,
      status
    } = req.body;

    const existingDolly = await prisma.equipmentDolly.findFirst({
      where: { unitNumber: unitNumber.toUpperCase() }
    });

    if (existingDolly) {
      res.status(400).json({ message: 'Unit number already exists' });
      return;
    }

    const dolly = await prisma.equipmentDolly.create({
      data: {
        unitNumber: unitNumber.toUpperCase(),
        dollyType: dollyType || 'A_DOLLY',
        currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null,
        lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null,
        nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : null,
        status: status || 'AVAILABLE'
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(dolly);
  } catch (error) {
    console.error('Error creating dolly:', error);
    res.status(500).json({ message: 'Failed to create dolly' });
  }
};

// Update dolly
export const updateDolly = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const dollyId = parseInt(id, 10);

    const existingDolly = await prisma.equipmentDolly.findUnique({
      where: { id: dollyId }
    });

    if (!existingDolly) {
      res.status(404).json({ message: 'Dolly not found' });
      return;
    }

    const {
      unitNumber,
      dollyType,
      currentTerminalId,
      lastInspectionDate,
      nextInspectionDate,
      status,
      maintenanceStatus,
      maintenanceNotes
    } = req.body;

    if (unitNumber && unitNumber.toUpperCase() !== existingDolly.unitNumber) {
      const conflict = await prisma.equipmentDolly.findFirst({
        where: { unitNumber: unitNumber.toUpperCase() }
      });
      if (conflict) {
        res.status(400).json({ message: 'Unit number already exists' });
        return;
      }
    }

    const dolly = await prisma.equipmentDolly.update({
      where: { id: dollyId },
      data: {
        ...(unitNumber && { unitNumber: unitNumber.toUpperCase() }),
        ...(dollyType && { dollyType }),
        ...(currentTerminalId !== undefined && { currentTerminalId: currentTerminalId ? parseInt(currentTerminalId, 10) : null }),
        ...(lastInspectionDate !== undefined && { lastInspectionDate: lastInspectionDate ? new Date(lastInspectionDate) : null }),
        ...(nextInspectionDate !== undefined && { nextInspectionDate: nextInspectionDate ? new Date(nextInspectionDate) : null }),
        ...(status && { status }),
        ...(maintenanceStatus !== undefined && { maintenanceStatus }),
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      },
      include: {
        currentTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.json(dolly);
  } catch (error) {
    console.error('Error updating dolly:', error);
    res.status(500).json({ message: 'Failed to update dolly' });
  }
};

// Delete dolly
export const deleteDolly = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const dollyId = parseInt(id, 10);

    const dolly = await prisma.equipmentDolly.findUnique({
      where: { id: dollyId },
      include: {
        _count: {
          select: { linehaulTrips: true }
        }
      }
    });

    if (!dolly) {
      res.status(404).json({ message: 'Dolly not found' });
      return;
    }

    if (dolly._count.linehaulTrips > 0) {
      res.status(400).json({
        message: 'Cannot delete dolly with associated trips.',
        tripCount: dolly._count.linehaulTrips
      });
      return;
    }

    await prisma.equipmentDolly.delete({
      where: { id: dollyId }
    });

    res.json({ message: 'Dolly deleted successfully' });
  } catch (error) {
    console.error('Error deleting dolly:', error);
    res.status(500).json({ message: 'Failed to delete dolly' });
  }
};

// Update dolly status
export const updateDollyStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, maintenanceNotes } = req.body;
    const dollyId = parseInt(id, 10);

    const dolly = await prisma.equipmentDolly.update({
      where: { id: dollyId },
      data: {
        status,
        ...(maintenanceNotes !== undefined && { maintenanceNotes })
      }
    });

    res.json(dolly);
  } catch (error) {
    console.error('Error updating dolly status:', error);
    res.status(500).json({ message: 'Failed to update dolly status' });
  }
};

// ==================== EQUIPMENT LISTS ====================

// Get available equipment at a terminal (for dropdowns)
export const getAvailableEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { terminalId } = req.params;
    const termId = parseInt(terminalId, 10);

    const [trucks, trailers, dollies] = await Promise.all([
      prisma.equipmentTruck.findMany({
        where: {
          currentTerminalId: termId,
          status: 'AVAILABLE'
        },
        select: {
          id: true,
          unitNumber: true,
          truckType: true,
          make: true,
          model: true
        },
        orderBy: { unitNumber: 'asc' }
      }),
      prisma.equipmentTrailer.findMany({
        where: {
          currentTerminalId: termId,
          status: 'AVAILABLE'
        },
        select: {
          id: true,
          unitNumber: true,
          trailerType: true,
          lengthFeet: true
        },
        orderBy: { unitNumber: 'asc' }
      }),
      prisma.equipmentDolly.findMany({
        where: {
          currentTerminalId: termId,
          status: 'AVAILABLE'
        },
        select: {
          id: true,
          unitNumber: true,
          dollyType: true
        },
        orderBy: { unitNumber: 'asc' }
      })
    ]);

    res.json({
      trucks,
      trailers,
      dollies
    });
  } catch (error) {
    console.error('Error fetching available equipment:', error);
    res.status(500).json({ message: 'Failed to fetch available equipment' });
  }
};

// ==================== FORMSAPP SYNC ====================

import { getFormsAppService } from '../services/formsapp.service';
import { isFormsAppConfigured } from '../config/formsapp.config';

// Sync all equipment from FormsApp
export const syncEquipment = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isFormsAppConfigured()) {
      res.status(503).json({
        message: 'FormsApp integration is not configured. Please set FORMSAPP_API_KEY and FORMSAPP_API_URL environment variables.'
      });
      return;
    }

    const service = getFormsAppService();
    const result = await service.syncAllEquipment();

    res.json({
      success: true,
      message: result.summary,
      trucks: result.trucks,
      trailers: result.trailers,
      dollies: result.dollies
    });
  } catch (error) {
    console.error('Error syncing equipment from FormsApp:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to sync equipment: ${message}`
    });
  }
};

// Sync trucks only from FormsApp
export const syncTrucks = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isFormsAppConfigured()) {
      res.status(503).json({
        message: 'FormsApp integration is not configured.'
      });
      return;
    }

    const service = getFormsAppService();
    const result = await service.syncTrucks();

    res.json({
      success: true,
      message: `Synced ${result.created} created, ${result.updated} updated trucks`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing trucks from FormsApp:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to sync trucks: ${message}`
    });
  }
};

// Sync trailers only from FormsApp
export const syncTrailers = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isFormsAppConfigured()) {
      res.status(503).json({
        message: 'FormsApp integration is not configured.'
      });
      return;
    }

    const service = getFormsAppService();
    const result = await service.syncTrailers();

    res.json({
      success: true,
      message: `Synced ${result.created} created, ${result.updated} updated trailers`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing trailers from FormsApp:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to sync trailers: ${message}`
    });
  }
};

// Sync dollies only from FormsApp
export const syncDollies = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isFormsAppConfigured()) {
      res.status(503).json({
        message: 'FormsApp integration is not configured.'
      });
      return;
    }

    const service = getFormsAppService();
    const result = await service.syncDollies();

    res.json({
      success: true,
      message: `Synced ${result.created} created, ${result.updated} updated dollies`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing dollies from FormsApp:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to sync dollies: ${message}`
    });
  }
};

// Get sync status
export const getSyncStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isFormsAppConfigured()) {
      res.json({
        configured: false,
        message: 'FormsApp integration is not configured.'
      });
      return;
    }

    const service = getFormsAppService();
    const status = service.getSyncStatus();

    res.json({
      configured: true,
      lastSyncAt: status.lastSyncAt,
      lastResult: status.lastResult
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ message: 'Failed to get sync status' });
  }
};

// ==================== MOTIVE GPS TRACKING ====================

import { getMotiveService } from '../services/motive.service';
import { isMotiveConfigured } from '../config/motive.config';

// Sync vehicle locations from Motive
export const syncVehicleLocations = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isMotiveConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Motive integration is not configured. Please set MOTIVE_API_KEY environment variable.'
      });
      return;
    }

    const service = getMotiveService();
    const result = await service.syncVehicleLocations();

    res.json({
      success: true,
      message: `Updated ${result.trucksUpdated} truck locations, ${result.trucksNotFound} not found in database`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing vehicle locations from Motive:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to sync locations: ${message}`
    });
  }
};

// Get all current vehicle locations (for map display)
export const getVehicleLocations = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isMotiveConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Motive integration is not configured.'
      });
      return;
    }

    const service = getMotiveService();
    const locations = await service.getAllVehicleLocations();

    res.json({
      success: true,
      count: locations.length,
      locations
    });
  } catch (error) {
    console.error('Error fetching vehicle locations:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to fetch locations: ${message}`
    });
  }
};

// Get location for a specific truck
export const getTruckLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isMotiveConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Motive integration is not configured.'
      });
      return;
    }

    const { unitNumber } = req.params;
    const service = getMotiveService();
    const location = await service.getTruckLocation(unitNumber);

    if (!location) {
      res.status(404).json({
        success: false,
        message: `No location found for truck ${unitNumber}`
      });
      return;
    }

    res.json({
      success: true,
      location
    });
  } catch (error) {
    console.error('Error fetching truck location:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      message: `Failed to fetch location: ${message}`
    });
  }
};

// Get Motive sync status
export const getMotiveSyncStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!isMotiveConfigured()) {
      res.json({
        configured: false,
        message: 'Motive integration is not configured.'
      });
      return;
    }

    const service = getMotiveService();
    const status = service.getSyncStatus();

    res.json({
      configured: true,
      lastSyncAt: status.lastSyncAt,
      lastResult: status.lastResult
    });
  } catch (error) {
    console.error('Error getting Motive sync status:', error);
    res.status(500).json({ message: 'Failed to get sync status' });
  }
};

// ==================== EQUIPMENT ALLOCATION ====================

// Equipment types for allocation
const EQUIPMENT_TYPES = [
  'tractor',
  'straight_truck',
  'trailer_53',
  'trailer_48',
  'trailer_45',
  'trailer_43',
  'trailer_28',
  'dolly'
] as const;

// Get allocation summary for all terminals
export const getAllocationSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get all terminals with their allocation requirements
    const terminals = await prisma.terminal.findMany({
      where: { active: true },
      include: {
        equipmentRequirements: true
      },
      orderBy: { code: 'asc' }
    });

    // Get current equipment counts by terminal
    const [truckCounts, trailerCounts, dollyCounts] = await Promise.all([
      prisma.equipmentTruck.groupBy({
        by: ['currentTerminalId', 'truckType'],
        where: { status: { not: 'OUT_OF_SERVICE' } },
        _count: true
      }),
      prisma.equipmentTrailer.groupBy({
        by: ['currentTerminalId', 'lengthFeet'],
        where: { status: { not: 'OUT_OF_SERVICE' } },
        _count: true
      }),
      prisma.equipmentDolly.groupBy({
        by: ['currentTerminalId', 'dollyType'],
        where: { status: { not: 'OUT_OF_SERVICE' } },
        _count: true
      })
    ]);

    // Get dispatched equipment (currently on trips FROM each terminal)
    const activeTrips = await prisma.linehaulTrip.findMany({
      where: {
        status: { in: ['DISPATCHED', 'IN_TRANSIT'] }
      },
      include: {
        linehaulProfile: {
          select: {
            originTerminalId: true,
            destinationTerminalId: true
          }
        },
        truck: {
          select: { truckType: true }
        },
        trailer: {
          select: { lengthFeet: true }
        },
        trailer2: {
          select: { lengthFeet: true }
        },
        trailer3: {
          select: { lengthFeet: true }
        },
        dolly: {
          select: { dollyType: true }
        },
        dolly2: {
          select: { dollyType: true }
        }
      }
    });

    // Get inbound equipment (on trips returning TO each terminal)
    const inboundTrips = await prisma.linehaulTrip.findMany({
      where: {
        status: { in: ['DISPATCHED', 'IN_TRANSIT', 'UNLOADING'] }
      },
      include: {
        linehaulProfile: {
          select: {
            destinationTerminalId: true,
            destinationTerminal: {
              select: { id: true, code: true }
            }
          }
        },
        truck: {
          select: { unitNumber: true, truckType: true }
        },
        trailer: {
          select: { unitNumber: true, lengthFeet: true }
        },
        trailer2: {
          select: { unitNumber: true, lengthFeet: true }
        },
        trailer3: {
          select: { unitNumber: true, lengthFeet: true }
        },
        dolly: {
          select: { unitNumber: true, dollyType: true }
        },
        dolly2: {
          select: { unitNumber: true, dollyType: true }
        }
      }
    });

    // Build the response data
    const terminalData = terminals.map(terminal => {
      // Build targets from requirements
      const targets: Record<string, number> = {};
      EQUIPMENT_TYPES.forEach(type => {
        const req = terminal.equipmentRequirements.find((r: any) => r.equipmentType === type);
        targets[type] = req?.minCount || 0;
      });

      // Build current counts
      const current: Record<string, number> = {};
      EQUIPMENT_TYPES.forEach(type => { current[type] = 0; });

      // Count trucks (Day Cab and Sleeper count as Tractors)
      truckCounts
        .filter(c => c.currentTerminalId === terminal.id)
        .forEach(c => {
          let key: string;
          if (c.truckType === 'DAY_CAB' || c.truckType === 'SLEEPER') {
            key = 'tractor';
          } else {
            key = 'straight_truck';
          }
          if (current[key] !== undefined) {
            current[key] += c._count;
          }
        });

      // Count trailers by length
      trailerCounts
        .filter(c => c.currentTerminalId === terminal.id)
        .forEach(c => {
          const key = `trailer_${c.lengthFeet}`;
          if (current[key] !== undefined) {
            current[key] = c._count;
          }
        });

      // Count dollies (all types count as one)
      dollyCounts
        .filter(c => c.currentTerminalId === terminal.id)
        .forEach(c => {
          if (current['dolly'] !== undefined) {
            current['dolly'] += c._count;
          }
        });

      // Build dispatched counts (equipment on trips FROM this terminal)
      const dispatched: Record<string, number> = {};
      EQUIPMENT_TYPES.forEach(type => { dispatched[type] = 0; });

      activeTrips
        .filter(t => t.linehaulProfile?.originTerminalId === terminal.id)
        .forEach(trip => {
          if (trip.truck) {
            const key = (trip.truck.truckType === 'DAY_CAB' || trip.truck.truckType === 'SLEEPER')
              ? 'tractor'
              : 'straight_truck';
            if (dispatched[key] !== undefined) dispatched[key]++;
          }
          if (trip.trailer?.lengthFeet) {
            const key = `trailer_${trip.trailer.lengthFeet}`;
            if (dispatched[key] !== undefined) dispatched[key]++;
          }
          if (trip.trailer2?.lengthFeet) {
            const key = `trailer_${trip.trailer2.lengthFeet}`;
            if (dispatched[key] !== undefined) dispatched[key]++;
          }
          if (trip.trailer3?.lengthFeet) {
            const key = `trailer_${trip.trailer3.lengthFeet}`;
            if (dispatched[key] !== undefined) dispatched[key]++;
          }
          if (trip.dolly) {
            if (dispatched['dolly'] !== undefined) dispatched['dolly']++;
          }
          if (trip.dolly2) {
            if (dispatched['dolly'] !== undefined) dispatched['dolly']++;
          }
        });

      // Build inbound equipment list
      const inbound: any[] = [];
      inboundTrips
        .filter(t => t.linehaulProfile?.destinationTerminalId === terminal.id)
        .forEach(trip => {
          if (trip.truck) {
            const equipmentType = (trip.truck.truckType === 'DAY_CAB' || trip.truck.truckType === 'SLEEPER')
              ? 'tractor'
              : 'straight_truck';
            inbound.push({
              equipmentType,
              unitNumber: trip.truck.unitNumber,
              tripId: trip.id,
              tripNumber: trip.tripNumber
            });
          }
          [trip.trailer, trip.trailer2, trip.trailer3]
            .filter(t => t)
            .forEach(trailerItem => {
              if (trailerItem) {
                inbound.push({
                  equipmentType: `trailer_${trailerItem.lengthFeet}`,
                  unitNumber: trailerItem.unitNumber,
                  tripId: trip.id,
                  tripNumber: trip.tripNumber
                });
              }
            });
          [trip.dolly, trip.dolly2]
            .filter(d => d)
            .forEach(dollyItem => {
              if (dollyItem) {
                inbound.push({
                  equipmentType: 'dolly',
                  unitNumber: dollyItem.unitNumber,
                  tripId: trip.id,
                  tripNumber: trip.tripNumber
                });
              }
            });
        });

      // Calculate inbound counts by type
      const inboundCounts: Record<string, number> = {};
      EQUIPMENT_TYPES.forEach(type => { inboundCounts[type] = 0; });
      inbound.forEach(item => {
        if (inboundCounts[item.equipmentType] !== undefined) {
          inboundCounts[item.equipmentType]++;
        }
      });

      // Calculate variance: (current + inbound) - target
      const variance: Record<string, number> = {};
      EQUIPMENT_TYPES.forEach(type => {
        variance[type] = (current[type] + inboundCounts[type]) - targets[type];
      });

      return {
        id: terminal.id,
        code: terminal.code,
        name: terminal.name,
        targets,
        current,
        dispatched,
        inbound,
        inboundCounts,
        variance
      };
    });

    res.json({
      terminals: terminalData,
      equipmentTypes: EQUIPMENT_TYPES
    });
  } catch (error) {
    console.error('Error fetching allocation summary:', error);
    res.status(500).json({ message: 'Failed to fetch allocation summary' });
  }
};

// Get allocation targets for a specific terminal
export const getTerminalAllocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { terminalId } = req.params;
    const termId = parseInt(terminalId, 10);

    const requirements = await prisma.terminalEquipmentRequirement.findMany({
      where: { terminalId: termId }
    });

    // Build a map of equipment type to target count
    const allocations: Record<string, number> = {};
    EQUIPMENT_TYPES.forEach(type => {
      const req = requirements.find(r => r.equipmentType === type);
      allocations[type] = req?.minCount || 0;
    });

    res.json({
      terminalId: termId,
      allocations,
      equipmentTypes: EQUIPMENT_TYPES
    });
  } catch (error) {
    console.error('Error fetching terminal allocations:', error);
    res.status(500).json({ message: 'Failed to fetch terminal allocations' });
  }
};

// Update allocation targets for a terminal
export const updateTerminalAllocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { terminalId } = req.params;
    const { allocations } = req.body;
    const termId = parseInt(terminalId, 10);

    // Verify terminal exists
    const terminal = await prisma.terminal.findUnique({
      where: { id: termId }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    // Update or create requirements for each equipment type
    const updates = await Promise.all(
      Object.entries(allocations).map(async ([equipmentType, minCount]) => {
        const existing = await prisma.terminalEquipmentRequirement.findFirst({
          where: { terminalId: termId, equipmentType }
        });

        if (existing) {
          return prisma.terminalEquipmentRequirement.update({
            where: { id: existing.id },
            data: { minCount: minCount as number }
          });
        } else {
          return prisma.terminalEquipmentRequirement.create({
            data: {
              terminalId: termId,
              equipmentType,
              minCount: minCount as number
            }
          });
        }
      })
    );

    res.json({
      message: 'Allocations updated successfully',
      updated: updates.length
    });
  } catch (error) {
    console.error('Error updating terminal allocations:', error);
    res.status(500).json({ message: 'Failed to update terminal allocations' });
  }
};
