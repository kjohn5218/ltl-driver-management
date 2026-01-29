import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import { fleetMockService } from '../services/fleet.mock.service';

// Get all terminals with filtering and pagination
export const getTerminals = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      active,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.TerminalWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } },
        { state: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [terminals, total] = await Promise.all([
      prisma.terminal.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { code: 'asc' },
        include: {
          _count: {
            select: {
              trucks: true,
              trailers: true,
              dollies: true,
              originLinehaulProfiles: true,
              destLinehaulProfiles: true
            }
          }
        }
      }),
      prisma.terminal.count({ where })
    ]);

    // If no terminals in database, fallback to mock fleet data
    if (total === 0 && !search) {
      console.log('No terminals in database, using mock fleet data');
      const mockData = await fleetMockService.getTerminals({
        search: search as string,
        active: active === 'true',
        limit: limitNum,
        page: pageNum
      });

      res.json({
        terminals: mockData.terminals.map(t => ({
          id: t.id,
          code: t.code,
          name: t.name,
          address: t.address,
          city: t.city,
          state: t.state,
          zipCode: t.zipCode,
          phone: t.phone,
          contact: t.contact,
          timezone: t.timezone,
          latitude: t.latitude,
          longitude: t.longitude,
          active: t.active,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: {
            trucks: 0,
            trailers: 0,
            dollies: 0,
            originLinehaulProfiles: 0,
            destLinehaulProfiles: 0
          }
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
      terminals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching terminals:', error);
    res.status(500).json({ message: 'Failed to fetch terminals' });
  }
};

// Get terminal by ID
export const getTerminalById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const terminal = await prisma.terminal.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        trucks: {
          where: { status: { not: 'OUT_OF_SERVICE' } },
          take: 10,
          orderBy: { unitNumber: 'asc' }
        },
        trailers: {
          where: { status: { not: 'OUT_OF_SERVICE' } },
          take: 10,
          orderBy: { unitNumber: 'asc' }
        },
        dollies: {
          where: { status: { not: 'OUT_OF_SERVICE' } },
          take: 10,
          orderBy: { unitNumber: 'asc' }
        },
        equipmentRequirements: true,
        _count: {
          select: {
            trucks: true,
            trailers: true,
            dollies: true,
            originLinehaulProfiles: true,
            destLinehaulProfiles: true
          }
        }
      }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    res.json(terminal);
  } catch (error) {
    console.error('Error fetching terminal:', error);
    res.status(500).json({ message: 'Failed to fetch terminal' });
  }
};

// Get terminal by code
export const getTerminalByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const terminal = await prisma.terminal.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        _count: {
          select: {
            trucks: true,
            trailers: true,
            dollies: true
          }
        }
      }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    res.json(terminal);
  } catch (error) {
    console.error('Error fetching terminal:', error);
    res.status(500).json({ message: 'Failed to fetch terminal' });
  }
};

// Create new terminal
export const createTerminal = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      timezone,
      contactName,
      contactPhone,
      active
    } = req.body;

    // Check if code already exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existingTerminal) {
      res.status(400).json({ message: 'Terminal code already exists' });
      return;
    }

    const terminal = await prisma.terminal.create({
      data: {
        code: code.toUpperCase(),
        name,
        address,
        city,
        state,
        zipCode,
        latitude: latitude ? new Prisma.Decimal(latitude) : null,
        longitude: longitude ? new Prisma.Decimal(longitude) : null,
        timezone: timezone || 'America/New_York',
        contact: contactName,
        phone: contactPhone,
        active: active !== undefined ? active : true
      }
    });

    res.status(201).json(terminal);
  } catch (error) {
    console.error('Error creating terminal:', error);
    res.status(500).json({ message: 'Failed to create terminal' });
  }
};

// Update terminal
export const updateTerminal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      address,
      city,
      state,
      zipCode,
      latitude,
      longitude,
      timezone,
      contactName,
      contactPhone,
      active
    } = req.body;

    const terminalId = parseInt(id, 10);

    // Check if terminal exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { id: terminalId }
    });

    if (!existingTerminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    // Check if new code conflicts with another terminal
    if (code && code.toUpperCase() !== existingTerminal.code) {
      const codeConflict = await prisma.terminal.findUnique({
        where: { code: code.toUpperCase() }
      });
      if (codeConflict) {
        res.status(400).json({ message: 'Terminal code already exists' });
        return;
      }
    }

    const terminal = await prisma.terminal.update({
      where: { id: terminalId },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(latitude !== undefined && { latitude: latitude ? new Prisma.Decimal(latitude) : null }),
        ...(longitude !== undefined && { longitude: longitude ? new Prisma.Decimal(longitude) : null }),
        ...(timezone && { timezone }),
        ...(contactName !== undefined && { contact: contactName }),
        ...(contactPhone !== undefined && { phone: contactPhone }),
        ...(active !== undefined && { active })
      }
    });

    res.json(terminal);
  } catch (error) {
    console.error('Error updating terminal:', error);
    res.status(500).json({ message: 'Failed to update terminal' });
  }
};

// Delete terminal
export const deleteTerminal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);

    // Check if terminal has associated equipment or trips
    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId },
      include: {
        _count: {
          select: {
            trucks: true,
            trailers: true,
            dollies: true,
            originLinehaulProfiles: true,
            destLinehaulProfiles: true
          }
        }
      }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    const hasAssociations =
      terminal._count.trucks > 0 ||
      terminal._count.trailers > 0 ||
      terminal._count.dollies > 0 ||
      terminal._count.originLinehaulProfiles > 0 ||
      terminal._count.destLinehaulProfiles > 0;

    if (hasAssociations) {
      res.status(400).json({
        message: 'Cannot delete terminal with associated equipment or linehaul profiles. Please reassign or remove them first.',
        associations: terminal._count
      });
      return;
    }

    await prisma.terminal.delete({
      where: { id: terminalId }
    });

    res.json({ message: 'Terminal deleted successfully' });
  } catch (error) {
    console.error('Error deleting terminal:', error);
    res.status(500).json({ message: 'Failed to delete terminal' });
  }
};

// Get terminal equipment summary
export const getTerminalEquipmentSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);

    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    const [trucks, trailers, dollies] = await Promise.all([
      prisma.equipmentTruck.groupBy({
        by: ['status'],
        where: { currentTerminalId: terminalId },
        _count: { id: true }
      }),
      prisma.equipmentTrailer.groupBy({
        by: ['status'],
        where: { currentTerminalId: terminalId },
        _count: { id: true }
      }),
      prisma.equipmentDolly.groupBy({
        by: ['status'],
        where: { currentTerminalId: terminalId },
        _count: { id: true }
      })
    ]);

    res.json({
      terminalCode: terminal.code,
      terminalName: terminal.name,
      trucks: trucks.map(t => ({ status: t.status, count: t._count.id })),
      trailers: trailers.map(t => ({ status: t.status, count: t._count.id })),
      dollies: dollies.map(d => ({ status: d.status, count: d._count.id }))
    });
  } catch (error) {
    console.error('Error fetching terminal equipment summary:', error);
    res.status(500).json({ message: 'Failed to fetch terminal equipment summary' });
  }
};

// Get all terminals as a simple list (for dropdowns)
export const getTerminalsList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const terminals = await prisma.terminal.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true
      },
      orderBy: { code: 'asc' }
    });

    res.json(terminals);
  } catch (error) {
    console.error('Error fetching terminals list:', error);
    res.status(500).json({ message: 'Failed to fetch terminals list' });
  }
};

// ==================== EQUIPMENT REQUIREMENTS ====================

// Get terminal equipment requirements
export const getTerminalEquipmentRequirements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);

    const requirements = await prisma.terminalEquipmentRequirement.findMany({
      where: { terminalId },
      orderBy: { dayOfWeek: 'asc' }
    });

    res.json(requirements);
  } catch (error) {
    console.error('Error fetching terminal equipment requirements:', error);
    res.status(500).json({ message: 'Failed to fetch terminal equipment requirements' });
  }
};

// Create or update terminal equipment requirement
export const upsertTerminalEquipmentRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);
    const {
      dayOfWeek,
      equipmentType,
      minCount,
      maxCount,
      effectiveDate,
      expirationDate,
      seasonalNote
    } = req.body;

    // Verify terminal exists
    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    // Check if requirement for this day and equipment type already exists
    const existingRequirement = await prisma.terminalEquipmentRequirement.findFirst({
      where: {
        terminalId,
        dayOfWeek,
        equipmentType
      }
    });

    let requirement;
    if (existingRequirement) {
      requirement = await prisma.terminalEquipmentRequirement.update({
        where: { id: existingRequirement.id },
        data: {
          minCount: minCount !== undefined ? minCount : existingRequirement.minCount,
          maxCount: maxCount !== undefined ? maxCount : existingRequirement.maxCount,
          effectiveDate: effectiveDate !== undefined ? (effectiveDate ? new Date(effectiveDate) : null) : existingRequirement.effectiveDate,
          expirationDate: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : existingRequirement.expirationDate,
          seasonalNote: seasonalNote !== undefined ? seasonalNote : existingRequirement.seasonalNote
        }
      });
    } else {
      requirement = await prisma.terminalEquipmentRequirement.create({
        data: {
          terminalId,
          dayOfWeek,
          equipmentType,
          minCount: minCount || 0,
          maxCount: maxCount || null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          seasonalNote
        }
      });
    }

    res.status(existingRequirement ? 200 : 201).json(requirement);
  } catch (error) {
    console.error('Error upserting terminal equipment requirement:', error);
    res.status(500).json({ message: 'Failed to save terminal equipment requirement' });
  }
};

// Bulk update terminal equipment requirements
export const bulkUpdateTerminalEquipmentRequirements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);
    const { requirements } = req.body;

    // Verify terminal exists
    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    // Delete existing requirements and create new ones
    await prisma.$transaction(async (tx) => {
      await tx.terminalEquipmentRequirement.deleteMany({
        where: { terminalId }
      });

      if (requirements && requirements.length > 0) {
        await tx.terminalEquipmentRequirement.createMany({
          data: requirements.map((req: any) => ({
            terminalId,
            dayOfWeek: req.dayOfWeek,
            equipmentType: req.equipmentType,
            minCount: req.minCount || 0,
            maxCount: req.maxCount || null,
            effectiveDate: req.effectiveDate ? new Date(req.effectiveDate) : null,
            expirationDate: req.expirationDate ? new Date(req.expirationDate) : null,
            seasonalNote: req.seasonalNote
          }))
        });
      }
    });

    const updatedRequirements = await prisma.terminalEquipmentRequirement.findMany({
      where: { terminalId },
      orderBy: { dayOfWeek: 'asc' }
    });

    res.json(updatedRequirements);
  } catch (error) {
    console.error('Error bulk updating terminal equipment requirements:', error);
    res.status(500).json({ message: 'Failed to update terminal equipment requirements' });
  }
};

// Delete terminal equipment requirement
export const deleteTerminalEquipmentRequirement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, requirementId } = req.params;
    const terminalId = parseInt(id, 10);
    const reqId = parseInt(requirementId, 10);

    const requirement = await prisma.terminalEquipmentRequirement.findFirst({
      where: {
        id: reqId,
        terminalId
      }
    });

    if (!requirement) {
      res.status(404).json({ message: 'Equipment requirement not found' });
      return;
    }

    await prisma.terminalEquipmentRequirement.delete({
      where: { id: reqId }
    });

    res.json({ message: 'Equipment requirement deleted successfully' });
  } catch (error) {
    console.error('Error deleting terminal equipment requirement:', error);
    res.status(500).json({ message: 'Failed to delete terminal equipment requirement' });
  }
};

// Get equipment availability vs requirements for a terminal
export const getTerminalEquipmentAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const terminalId = parseInt(id, 10);
    const { date } = req.query;

    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId }
    });

    if (!terminal) {
      res.status(404).json({ message: 'Terminal not found' });
      return;
    }

    // Get the day of week (0 = Sunday, 6 = Saturday)
    const targetDate = date ? new Date(date as string) : new Date();
    const dayOfWeek = targetDate.getDay();

    // Get requirements for this day
    const requirements = await prisma.terminalEquipmentRequirement.findMany({
      where: {
        terminalId,
        dayOfWeek
      }
    });

    // Get current available counts
    const [availableTrucks, availableTrailers, availableDollies, availableDrivers] = await Promise.all([
      prisma.equipmentTruck.count({
        where: {
          currentTerminalId: terminalId,
          status: 'AVAILABLE'
        }
      }),
      prisma.equipmentTrailer.count({
        where: {
          currentTerminalId: terminalId,
          status: 'AVAILABLE'
        }
      }),
      prisma.equipmentDolly.count({
        where: {
          currentTerminalId: terminalId,
          status: 'AVAILABLE'
        }
      }),
      prisma.carrierDriver.count({
        where: {
          currentTerminalCode: terminal.code,
          driverStatus: 'AVAILABLE',
          active: true
        }
      })
    ]);

    // Group requirements by equipment type
    const requirementsByType: Record<string, { minCount: number; maxCount: number | null }> = {};
    for (const req of requirements) {
      requirementsByType[req.equipmentType] = {
        minCount: req.minCount,
        maxCount: req.maxCount
      };
    }

    res.json({
      terminal: {
        id: terminal.id,
        code: terminal.code,
        name: terminal.name
      },
      date: targetDate.toISOString().split('T')[0],
      dayOfWeek,
      requirements: requirementsByType,
      available: {
        trucks: availableTrucks,
        trailers: availableTrailers,
        dollies: availableDollies,
        drivers: availableDrivers
      },
      variance: {
        trucks: availableTrucks - (requirementsByType['truck']?.minCount || 0),
        trailers: availableTrailers - (requirementsByType['trailer_53']?.minCount || 0) - (requirementsByType['trailer_28']?.minCount || 0),
        dollies: availableDollies - (requirementsByType['dolly_a']?.minCount || 0) - (requirementsByType['dolly_b']?.minCount || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching terminal equipment availability:', error);
    res.status(500).json({ message: 'Failed to fetch terminal equipment availability' });
  }
};
