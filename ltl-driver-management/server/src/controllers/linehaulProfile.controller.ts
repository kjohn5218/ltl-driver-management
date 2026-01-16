import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

// Get all linehaul profiles with filtering
export const getLinehaulProfiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      active,
      originTerminalId,
      destinationTerminalId,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LinehaulProfileWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { profileCode: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    if (originTerminalId) {
      where.originTerminalId = parseInt(originTerminalId as string, 10);
    }

    if (destinationTerminalId) {
      where.destinationTerminalId = parseInt(destinationTerminalId as string, 10);
    }

    const [profiles, total] = await Promise.all([
      prisma.linehaulProfile.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: {
          originTerminal: {
            select: { id: true, code: true, name: true, city: true, state: true }
          },
          destinationTerminal: {
            select: { id: true, code: true, name: true, city: true, state: true }
          },
          _count: {
            select: { trips: true }
          }
        }
      }),
      prisma.linehaulProfile.count({ where })
    ]);

    res.json({
      profiles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching linehaul profiles:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul profiles' });
  }
};

// Get linehaul profile by ID
export const getLinehaulProfileById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        originTerminal: true,
        destinationTerminal: true,
        trips: {
          take: 10,
          orderBy: { dispatchDate: 'desc' },
          include: {
            driver: {
              select: { id: true, name: true }
            },
            truck: {
              select: { id: true, unitNumber: true }
            }
          }
        },
        _count: {
          select: { trips: true }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching linehaul profile:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul profile' });
  }
};

// Get linehaul profile by code
export const getLinehaulProfileByCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    const profile = await prisma.linehaulProfile.findUnique({
      where: { profileCode: code.toUpperCase() },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching linehaul profile:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul profile' });
  }
};

// Create new linehaul profile
export const createLinehaulProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      profileCode,
      name,
      originTerminalId,
      destinationTerminalId,
      standardDepartureTime,
      standardArrivalTime,
      distanceMiles,
      transitTimeMinutes,
      equipmentConfig,
      requiresTeamDriver,
      hazmatRequired,
      frequency,
      notes,
      active
    } = req.body;

    // Check for duplicate code
    const existingProfile = await prisma.linehaulProfile.findUnique({
      where: { profileCode: profileCode.toUpperCase() }
    });

    if (existingProfile) {
      res.status(400).json({ message: 'Profile code already exists' });
      return;
    }

    // Verify terminals exist
    const [originTerminal, destTerminal] = await Promise.all([
      prisma.terminal.findUnique({ where: { id: parseInt(originTerminalId, 10) } }),
      prisma.terminal.findUnique({ where: { id: parseInt(destinationTerminalId, 10) } })
    ]);

    if (!originTerminal) {
      res.status(400).json({ message: 'Origin terminal not found' });
      return;
    }

    if (!destTerminal) {
      res.status(400).json({ message: 'Destination terminal not found' });
      return;
    }

    const profile = await prisma.linehaulProfile.create({
      data: {
        profileCode: profileCode.toUpperCase(),
        name,
        originTerminalId: parseInt(originTerminalId, 10),
        destinationTerminalId: parseInt(destinationTerminalId, 10),
        standardDepartureTime,
        standardArrivalTime,
        distanceMiles: distanceMiles ? parseInt(distanceMiles, 10) : null,
        transitTimeMinutes: transitTimeMinutes ? parseInt(transitTimeMinutes, 10) : null,
        equipmentConfig,
        requiresTeamDriver: requiresTeamDriver || false,
        hazmatRequired: hazmatRequired || false,
        frequency,
        notes,
        active: active !== undefined ? active : true
      },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating linehaul profile:', error);
    res.status(500).json({ message: 'Failed to create linehaul profile' });
  }
};

// Update linehaul profile
export const updateLinehaulProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id, 10);

    const existingProfile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId }
    });

    if (!existingProfile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    const {
      profileCode,
      name,
      originTerminalId,
      destinationTerminalId,
      standardDepartureTime,
      standardArrivalTime,
      distanceMiles,
      transitTimeMinutes,
      equipmentConfig,
      requiresTeamDriver,
      hazmatRequired,
      frequency,
      notes,
      active
    } = req.body;

    // Check for code conflict
    if (profileCode && profileCode.toUpperCase() !== existingProfile.profileCode) {
      const codeConflict = await prisma.linehaulProfile.findUnique({
        where: { profileCode: profileCode.toUpperCase() }
      });
      if (codeConflict) {
        res.status(400).json({ message: 'Profile code already exists' });
        return;
      }
    }

    // Verify terminals if being updated
    if (originTerminalId) {
      const originTerminal = await prisma.terminal.findUnique({
        where: { id: parseInt(originTerminalId, 10) }
      });
      if (!originTerminal) {
        res.status(400).json({ message: 'Origin terminal not found' });
        return;
      }
    }

    if (destinationTerminalId) {
      const destTerminal = await prisma.terminal.findUnique({
        where: { id: parseInt(destinationTerminalId, 10) }
      });
      if (!destTerminal) {
        res.status(400).json({ message: 'Destination terminal not found' });
        return;
      }
    }

    const profile = await prisma.linehaulProfile.update({
      where: { id: profileId },
      data: {
        ...(profileCode && { profileCode: profileCode.toUpperCase() }),
        ...(name && { name }),
        ...(originTerminalId && { originTerminalId: parseInt(originTerminalId, 10) }),
        ...(destinationTerminalId && { destinationTerminalId: parseInt(destinationTerminalId, 10) }),
        ...(standardDepartureTime !== undefined && { standardDepartureTime }),
        ...(standardArrivalTime !== undefined && { standardArrivalTime }),
        ...(distanceMiles !== undefined && { distanceMiles: distanceMiles ? parseInt(distanceMiles, 10) : null }),
        ...(transitTimeMinutes !== undefined && { transitTimeMinutes: transitTimeMinutes ? parseInt(transitTimeMinutes, 10) : null }),
        ...(equipmentConfig !== undefined && { equipmentConfig }),
        ...(requiresTeamDriver !== undefined && { requiresTeamDriver }),
        ...(hazmatRequired !== undefined && { hazmatRequired }),
        ...(frequency !== undefined && { frequency }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active })
      },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.json(profile);
  } catch (error) {
    console.error('Error updating linehaul profile:', error);
    res.status(500).json({ message: 'Failed to update linehaul profile' });
  }
};

// Delete linehaul profile
export const deleteLinehaulProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId },
      include: {
        _count: {
          select: { trips: true }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    if (profile._count.trips > 0) {
      res.status(400).json({
        message: 'Cannot delete profile with associated trips. Consider deactivating instead.',
        tripCount: profile._count.trips
      });
      return;
    }

    await prisma.linehaulProfile.delete({
      where: { id: profileId }
    });

    res.json({ message: 'Linehaul profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting linehaul profile:', error);
    res.status(500).json({ message: 'Failed to delete linehaul profile' });
  }
};

// Get simple list of profiles for dropdowns
export const getLinehaulProfilesList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const profiles = await prisma.linehaulProfile.findMany({
      where: { active: true },
      select: {
        id: true,
        profileCode: true,
        name: true,
        originTerminal: {
          select: { code: true, city: true, state: true }
        },
        destinationTerminal: {
          select: { code: true, city: true, state: true }
        }
      },
      orderBy: { profileCode: 'asc' }
    });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching linehaul profiles list:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul profiles list' });
  }
};

// Get profiles for a specific terminal (as origin or destination)
export const getProfilesByTerminal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { terminalId } = req.params;
    const { direction } = req.query; // 'origin', 'destination', or 'both'
    const termId = parseInt(terminalId, 10);

    let where: Prisma.LinehaulProfileWhereInput = { active: true };

    if (direction === 'origin') {
      where.originTerminalId = termId;
    } else if (direction === 'destination') {
      where.destinationTerminalId = termId;
    } else {
      where.OR = [
        { originTerminalId: termId },
        { destinationTerminalId: termId }
      ];
    }

    const profiles = await prisma.linehaulProfile.findMany({
      where,
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true }
        }
      },
      orderBy: { profileCode: 'asc' }
    });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles by terminal:', error);
    res.status(500).json({ message: 'Failed to fetch profiles by terminal' });
  }
};

// Toggle profile active status
export const toggleProfileStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    const updatedProfile = await prisma.linehaulProfile.update({
      where: { id: profileId },
      data: { active: !profile.active }
    });

    res.json(updatedProfile);
  } catch (error) {
    console.error('Error toggling profile status:', error);
    res.status(500).json({ message: 'Failed to toggle profile status' });
  }
};

// Duplicate a profile (useful for creating similar routes)
export const duplicateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newCode, newName } = req.body;
    const profileId = parseInt(id, 10);

    const existingProfile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId }
    });

    if (!existingProfile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    // Check new code doesn't exist
    const codeConflict = await prisma.linehaulProfile.findUnique({
      where: { profileCode: newCode.toUpperCase() }
    });

    if (codeConflict) {
      res.status(400).json({ message: 'New profile code already exists' });
      return;
    }

    const newProfile = await prisma.linehaulProfile.create({
      data: {
        profileCode: newCode.toUpperCase(),
        name: newName || `${existingProfile.name} (Copy)`,
        originTerminalId: existingProfile.originTerminalId,
        destinationTerminalId: existingProfile.destinationTerminalId,
        standardDepartureTime: existingProfile.standardDepartureTime,
        standardArrivalTime: existingProfile.standardArrivalTime,
        distanceMiles: existingProfile.distanceMiles,
        transitTimeMinutes: existingProfile.transitTimeMinutes,
        equipmentConfig: existingProfile.equipmentConfig,
        requiresTeamDriver: existingProfile.requiresTeamDriver,
        hazmatRequired: existingProfile.hazmatRequired,
        frequency: existingProfile.frequency,
        notes: existingProfile.notes,
        active: false // Start as inactive
      },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(newProfile);
  } catch (error) {
    console.error('Error duplicating profile:', error);
    res.status(500).json({ message: 'Failed to duplicate profile' });
  }
};
