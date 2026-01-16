import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, EquipmentStatus, TruckType, TrailerType, DollyType } from '@prisma/client';

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
          }
        }
      }),
      prisma.equipmentTruck.count({ where })
    ]);

    res.json({
      trucks,
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

    const [trailers, total] = await Promise.all([
      prisma.equipmentTrailer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { unitNumber: 'asc' },
        include: {
          currentTerminal: {
            select: { id: true, code: true, name: true }
          }
        }
      }),
      prisma.equipmentTrailer.count({ where })
    ]);

    res.json({
      trailers,
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

    const [dollies, total] = await Promise.all([
      prisma.equipmentDolly.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { unitNumber: 'asc' },
        include: {
          currentTerminal: {
            select: { id: true, code: true, name: true }
          }
        }
      }),
      prisma.equipmentDolly.count({ where })
    ]);

    res.json({
      dollies,
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
