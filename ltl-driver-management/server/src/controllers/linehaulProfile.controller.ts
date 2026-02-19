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
          interlineCarrier: {
            select: { id: true, code: true, name: true }
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
        interlineCarrier: true,
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
        },
        interlineCarrier: {
          select: { id: true, code: true, name: true }
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
      headhaul,
      trailerLoad,
      interlineTrailer,
      interlineCarrierId,
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
        headhaul: headhaul || false,
        trailerLoad: trailerLoad || false,
        interlineTrailer: interlineTrailer || false,
        interlineCarrierId: interlineCarrierId ? parseInt(interlineCarrierId, 10) : null,
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
        },
        interlineCarrier: {
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
      headhaul,
      trailerLoad,
      interlineTrailer,
      interlineCarrierId,
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
        ...(headhaul !== undefined && { headhaul }),
        ...(trailerLoad !== undefined && { trailerLoad }),
        ...(interlineTrailer !== undefined && { interlineTrailer }),
        ...(interlineCarrierId !== undefined && { interlineCarrierId: interlineCarrierId ? parseInt(interlineCarrierId, 10) : null }),
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
        },
        interlineCarrier: {
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
        standardDepartureTime: true,
        standardArrivalTime: true,
        distanceMiles: true,
        transitTimeMinutes: true,
        headhaul: true,
        interlineTrailer: true,
        interlineCarrierId: true,
        originTerminalId: true,
        destinationTerminalId: true,
        originTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true, latitude: true, longitude: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true, latitude: true, longitude: true }
        },
        interlineCarrier: {
          select: { id: true, code: true, name: true }
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
        },
        interlineCarrier: {
          select: { id: true, code: true, name: true }
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
        headhaul: existingProfile.headhaul,
        trailerLoad: existingProfile.trailerLoad,
        interlineTrailer: existingProfile.interlineTrailer,
        interlineCarrierId: existingProfile.interlineCarrierId,
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
        },
        interlineCarrier: {
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

// Get okay-to-load terminals for a profile
export const getOkayToLoadTerminals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        profileCode: true,
        name: true,
        originTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true }
        },
        okayToLoadTerminals: {
          include: {
            terminal: {
              select: { id: true, code: true, name: true, city: true, state: true, active: true }
            }
          }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    res.json({
      profileId: profile.id,
      profileCode: profile.profileCode,
      profileName: profile.name,
      originTerminal: profile.originTerminal,
      okayToLoadTerminals: profile.okayToLoadTerminals.map(otl => otl.terminal)
    });
  } catch (error) {
    console.error('Error fetching okay-to-load terminals:', error);
    res.status(500).json({ message: 'Failed to fetch okay-to-load terminals' });
  }
};

// Update okay-to-load terminals for a profile
export const updateOkayToLoadTerminals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { terminalIds } = req.body;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    if (!Array.isArray(terminalIds)) {
      res.status(400).json({ message: 'terminalIds must be an array' });
      return;
    }

    // Delete existing relationships and create new ones in a transaction
    await prisma.$transaction([
      prisma.profileOkayToLoad.deleteMany({
        where: { linehaulProfileId: profileId }
      }),
      prisma.profileOkayToLoad.createMany({
        data: terminalIds.map((terminalId: number) => ({
          linehaulProfileId: profileId,
          terminalId
        }))
      })
    ]);

    // Fetch and return updated data
    const updatedProfile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        profileCode: true,
        okayToLoadTerminals: {
          include: {
            terminal: {
              select: { id: true, code: true, name: true, city: true, state: true }
            }
          }
        }
      }
    });

    res.json({
      profileId: updatedProfile!.id,
      profileCode: updatedProfile!.profileCode,
      okayToLoadTerminals: updatedProfile!.okayToLoadTerminals.map(otl => otl.terminal)
    });
  } catch (error) {
    console.error('Error updating okay-to-load terminals:', error);
    res.status(500).json({ message: 'Failed to update okay-to-load terminals' });
  }
};

// Get okay-to-dispatch terminals for a profile
export const getOkayToDispatchTerminals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        profileCode: true,
        name: true,
        originTerminal: {
          select: { id: true, code: true, name: true, city: true, state: true, latitude: true, longitude: true }
        },
        okayToDispatchTerminals: {
          include: {
            terminal: {
              select: { id: true, code: true, name: true, city: true, state: true, active: true, latitude: true, longitude: true }
            }
          }
        }
      }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    res.json({
      profileId: profile.id,
      profileCode: profile.profileCode,
      profileName: profile.name,
      originTerminal: profile.originTerminal,
      okayToDispatchTerminals: profile.okayToDispatchTerminals
        .map(otd => otd.terminal)
        .filter(terminal => terminal !== null && terminal !== undefined)
    });
  } catch (error) {
    console.error('Error fetching okay-to-dispatch terminals:', error);
    res.status(500).json({ message: 'Failed to fetch okay-to-dispatch terminals' });
  }
};

// Update okay-to-dispatch terminals for a profile
export const updateOkayToDispatchTerminals = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { terminalIds } = req.body;
    const profileId = parseInt(id, 10);

    const profile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId }
    });

    if (!profile) {
      res.status(404).json({ message: 'Linehaul profile not found' });
      return;
    }

    if (!Array.isArray(terminalIds)) {
      res.status(400).json({ message: 'terminalIds must be an array' });
      return;
    }

    // Delete existing relationships and create new ones in a transaction
    await prisma.$transaction([
      prisma.profileOkayToDispatch.deleteMany({
        where: { linehaulProfileId: profileId }
      }),
      prisma.profileOkayToDispatch.createMany({
        data: terminalIds.map((terminalId: number) => ({
          linehaulProfileId: profileId,
          terminalId
        }))
      })
    ]);

    // Fetch and return updated data
    const updatedProfile = await prisma.linehaulProfile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        profileCode: true,
        okayToDispatchTerminals: {
          include: {
            terminal: {
              select: { id: true, code: true, name: true, city: true, state: true }
            }
          }
        }
      }
    });

    res.json({
      profileId: updatedProfile!.id,
      profileCode: updatedProfile!.profileCode,
      okayToDispatchTerminals: updatedProfile!.okayToDispatchTerminals.map(otd => otd.terminal)
    });
  } catch (error) {
    console.error('Error updating okay-to-dispatch terminals:', error);
    res.status(500).json({ message: 'Failed to update okay-to-dispatch terminals' });
  }
};
