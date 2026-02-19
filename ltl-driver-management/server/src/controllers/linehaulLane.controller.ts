import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

// Get all linehaul lanes with optional filtering
export const getLinehaulLanes = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      originLocationId,
      active,
      page = '1',
      limit = '100'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LinehaulLaneWhereInput = {};

    if (originLocationId) {
      where.originLocationId = parseInt(originLocationId as string, 10);
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [lanes, total] = await Promise.all([
      prisma.linehaulLane.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { originLocation: { code: 'asc' } },
          { destinationLocation: { code: 'asc' } }
        ],
        include: {
          originLocation: {
            select: { id: true, code: true, name: true, city: true }
          },
          destinationLocation: {
            select: { id: true, code: true, name: true, city: true }
          },
          routingSteps: {
            orderBy: { sequence: 'asc' },
            include: {
              terminalLocation: {
                select: { id: true, code: true, name: true, city: true }
              }
            }
          }
        }
      }),
      prisma.linehaulLane.count({ where })
    ]);

    res.json({
      lanes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching linehaul lanes:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul lanes' });
  }
};

// Get single linehaul lane by ID
export const getLinehaulLaneById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const lane = await prisma.linehaulLane.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        originLocation: {
          select: { id: true, code: true, name: true, city: true }
        },
        destinationLocation: {
          select: { id: true, code: true, name: true, city: true }
        },
        routingSteps: {
          orderBy: { sequence: 'asc' },
          include: {
            terminalLocation: {
              select: { id: true, code: true, name: true, city: true }
            }
          }
        }
      }
    });

    if (!lane) {
      res.status(404).json({ message: 'Linehaul lane not found' });
      return;
    }

    res.json(lane);
  } catch (error) {
    console.error('Error fetching linehaul lane:', error);
    res.status(500).json({ message: 'Failed to fetch linehaul lane' });
  }
};

// Create linehaul lane
export const createLinehaulLane = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      originLocationId,
      destinationLocationId,
      active = true,
      routingSteps = []
    } = req.body;

    // Validate required fields
    if (!originLocationId || !destinationLocationId) {
      res.status(400).json({ message: 'Origin and destination locations are required' });
      return;
    }

    // Check if lane already exists
    const existing = await prisma.linehaulLane.findUnique({
      where: {
        originLocationId_destinationLocationId: {
          originLocationId,
          destinationLocationId
        }
      }
    });

    if (existing) {
      res.status(400).json({ message: 'A lane already exists for this origin-destination pair' });
      return;
    }

    // Create lane with routing steps
    const lane = await prisma.linehaulLane.create({
      data: {
        originLocationId,
        destinationLocationId,
        active,
        routingSteps: {
          create: routingSteps.map((step: any, index: number) => ({
            sequence: step.sequence || index + 1,
            terminalLocationId: step.terminalLocationId,
            transitDays: step.transitDays || 0,
            departDeadline: step.departDeadline || null
          }))
        }
      },
      include: {
        originLocation: {
          select: { id: true, code: true, name: true, city: true }
        },
        destinationLocation: {
          select: { id: true, code: true, name: true, city: true }
        },
        routingSteps: {
          orderBy: { sequence: 'asc' },
          include: {
            terminalLocation: {
              select: { id: true, code: true, name: true, city: true }
            }
          }
        }
      }
    });

    res.status(201).json(lane);
  } catch (error) {
    console.error('Error creating linehaul lane:', error);
    res.status(500).json({ message: 'Failed to create linehaul lane' });
  }
};

// Update linehaul lane
export const updateLinehaulLane = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const laneId = parseInt(id, 10);
    const {
      originLocationId,
      destinationLocationId,
      active,
      routingSteps
    } = req.body;

    // Check if lane exists
    const existing = await prisma.linehaulLane.findUnique({
      where: { id: laneId }
    });

    if (!existing) {
      res.status(404).json({ message: 'Linehaul lane not found' });
      return;
    }

    // If changing origin/destination, check for duplicates
    if (originLocationId && destinationLocationId) {
      const duplicate = await prisma.linehaulLane.findFirst({
        where: {
          originLocationId,
          destinationLocationId,
          NOT: { id: laneId }
        }
      });

      if (duplicate) {
        res.status(400).json({ message: 'A lane already exists for this origin-destination pair' });
        return;
      }
    }

    // Update lane in a transaction
    const lane = await prisma.$transaction(async (tx) => {
      // Delete existing routing steps if new ones provided
      if (routingSteps !== undefined) {
        await tx.linehaulLaneStep.deleteMany({
          where: { laneId }
        });
      }

      // Update lane and create new routing steps
      return tx.linehaulLane.update({
        where: { id: laneId },
        data: {
          ...(originLocationId && { originLocationId }),
          ...(destinationLocationId && { destinationLocationId }),
          ...(active !== undefined && { active }),
          ...(routingSteps && {
            routingSteps: {
              create: routingSteps.map((step: any, index: number) => ({
                sequence: step.sequence || index + 1,
                terminalLocationId: step.terminalLocationId,
                transitDays: step.transitDays || 0,
                departDeadline: step.departDeadline || null
              }))
            }
          })
        },
        include: {
          originLocation: {
            select: { id: true, code: true, name: true, city: true }
          },
          destinationLocation: {
            select: { id: true, code: true, name: true, city: true }
          },
          routingSteps: {
            orderBy: { sequence: 'asc' },
            include: {
              terminalLocation: {
                select: { id: true, code: true, name: true, city: true }
              }
            }
          }
        }
      });
    });

    res.json(lane);
  } catch (error) {
    console.error('Error updating linehaul lane:', error);
    res.status(500).json({ message: 'Failed to update linehaul lane' });
  }
};

// Delete linehaul lane
export const deleteLinehaulLane = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const laneId = parseInt(id, 10);

    // Check if lane exists
    const existing = await prisma.linehaulLane.findUnique({
      where: { id: laneId }
    });

    if (!existing) {
      res.status(404).json({ message: 'Linehaul lane not found' });
      return;
    }

    // Delete lane (routing steps cascade delete)
    await prisma.linehaulLane.delete({
      where: { id: laneId }
    });

    res.json({ message: 'Linehaul lane deleted successfully' });
  } catch (error) {
    console.error('Error deleting linehaul lane:', error);
    res.status(500).json({ message: 'Failed to delete linehaul lane' });
  }
};

// Get unique origin locations that have lanes
export const getOriginLocations = async (_req: Request, res: Response): Promise<void> => {
  try {
    const locations = await prisma.linehaulLane.findMany({
      select: {
        originLocation: {
          select: { id: true, code: true, name: true, city: true }
        }
      },
      distinct: ['originLocationId'],
      orderBy: {
        originLocation: { code: 'asc' }
      }
    });

    const uniqueLocations = locations.map(l => l.originLocation);
    res.json(uniqueLocations);
  } catch (error) {
    console.error('Error fetching origin locations:', error);
    res.status(500).json({ message: 'Failed to fetch origin locations' });
  }
};
