import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, LateReasonType } from '@prisma/client';

// Get all late departure reasons with filtering
export const getLateDepartureReasons = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      reason,
      willCauseServiceFailure,
      accountableTerminalId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LateDepartureReasonWhereInput = {};

    if (reason) {
      where.reason = reason as LateReasonType;
    }

    if (willCauseServiceFailure !== undefined) {
      where.willCauseServiceFailure = willCauseServiceFailure === 'true';
    }

    if (accountableTerminalId) {
      where.accountableTerminalId = parseInt(accountableTerminalId as string, 10);
    }

    if (startDate) {
      where.createdAt = {
        ...where.createdAt as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      const endDateTime = new Date(endDate as string);
      endDateTime.setHours(23, 59, 59, 999);
      where.createdAt = {
        ...where.createdAt as object,
        lte: endDateTime
      };
    }

    const [reasons, total] = await Promise.all([
      prisma.lateDepartureReason.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          trip: {
            select: {
              id: true,
              tripNumber: true,
              dispatchDate: true,
              status: true,
              linehaulProfile: {
                select: {
                  profileCode: true,
                  name: true,
                  originTerminal: { select: { code: true } },
                  destinationTerminal: { select: { code: true } }
                }
              },
              driver: { select: { name: true } }
            }
          },
          accountableTerminal: {
            select: { id: true, code: true, name: true }
          },
          creator: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.lateDepartureReason.count({ where })
    ]);

    res.json({
      reasons,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching late departure reasons:', error);
    res.status(500).json({ message: 'Failed to fetch late departure reasons' });
  }
};

// Get late departure reason by trip ID
export const getLateDepartureReasonByTripId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;

    const reason = await prisma.lateDepartureReason.findUnique({
      where: { tripId: parseInt(tripId, 10) },
      include: {
        trip: {
          select: {
            id: true,
            tripNumber: true,
            dispatchDate: true,
            status: true
          }
        },
        accountableTerminal: {
          select: { id: true, code: true, name: true }
        },
        creator: {
          select: { id: true, name: true }
        }
      }
    });

    if (!reason) {
      res.status(404).json({ message: 'Late departure reason not found for this trip' });
      return;
    }

    res.json(reason);
  } catch (error) {
    console.error('Error fetching late departure reason:', error);
    res.status(500).json({ message: 'Failed to fetch late departure reason' });
  }
};

// Create late departure reason
export const createLateDepartureReason = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tripId,
      reason,
      willCauseServiceFailure,
      accountableTerminalId,
      accountableTerminalCode,
      notes,
      scheduledDepartTime,
      actualDepartTime,
      minutesLate
    } = req.body;

    // Check if trip already has a late reason
    const existing = await prisma.lateDepartureReason.findUnique({
      where: { tripId }
    });

    if (existing) {
      res.status(400).json({ message: 'This trip already has a late departure reason recorded' });
      return;
    }

    // Validate accountable terminal is provided when service failure is true
    if (willCauseServiceFailure && !accountableTerminalId) {
      res.status(400).json({ message: 'Accountable terminal is required when this will cause a service failure' });
      return;
    }

    const lateDepartureReason = await prisma.lateDepartureReason.create({
      data: {
        tripId,
        reason,
        willCauseServiceFailure,
        accountableTerminalId: accountableTerminalId || null,
        accountableTerminalCode: accountableTerminalCode || null,
        notes: notes || null,
        scheduledDepartTime: scheduledDepartTime || null,
        actualDepartTime: actualDepartTime || null,
        minutesLate: minutesLate || null,
        createdBy: (req as any).user?.id || null
      },
      include: {
        trip: {
          select: {
            id: true,
            tripNumber: true,
            dispatchDate: true,
            status: true
          }
        },
        accountableTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.status(201).json(lateDepartureReason);
  } catch (error) {
    console.error('Error creating late departure reason:', error);
    res.status(500).json({ message: 'Failed to create late departure reason' });
  }
};

// Update late departure reason
export const updateLateDepartureReason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      reason,
      willCauseServiceFailure,
      accountableTerminalId,
      accountableTerminalCode,
      notes
    } = req.body;

    // Validate accountable terminal is provided when service failure is true
    if (willCauseServiceFailure && !accountableTerminalId) {
      res.status(400).json({ message: 'Accountable terminal is required when this will cause a service failure' });
      return;
    }

    const lateDepartureReason = await prisma.lateDepartureReason.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(reason !== undefined && { reason }),
        ...(willCauseServiceFailure !== undefined && { willCauseServiceFailure }),
        ...(accountableTerminalId !== undefined && { accountableTerminalId }),
        ...(accountableTerminalCode !== undefined && { accountableTerminalCode }),
        ...(notes !== undefined && { notes })
      },
      include: {
        trip: {
          select: {
            id: true,
            tripNumber: true,
            dispatchDate: true,
            status: true
          }
        },
        accountableTerminal: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    res.json(lateDepartureReason);
  } catch (error) {
    console.error('Error updating late departure reason:', error);
    res.status(500).json({ message: 'Failed to update late departure reason' });
  }
};

// Delete late departure reason
export const deleteLateDepartureReason = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.lateDepartureReason.delete({
      where: { id: parseInt(id, 10) }
    });

    res.json({ message: 'Late departure reason deleted successfully' });
  } catch (error) {
    console.error('Error deleting late departure reason:', error);
    res.status(500).json({ message: 'Failed to delete late departure reason' });
  }
};

// Get late departure reasons summary/statistics
export const getLateDepartureReasonStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const where: Prisma.LateDepartureReasonWhereInput = {};

    if (startDate) {
      where.createdAt = {
        ...where.createdAt as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      const endDateTime = new Date(endDate as string);
      endDateTime.setHours(23, 59, 59, 999);
      where.createdAt = {
        ...where.createdAt as object,
        lte: endDateTime
      };
    }

    // Get counts by reason type
    const reasonCounts = await prisma.lateDepartureReason.groupBy({
      by: ['reason'],
      where,
      _count: { _all: true }
    });

    // Get counts by service failure
    const serviceFailureCounts = await prisma.lateDepartureReason.groupBy({
      by: ['willCauseServiceFailure'],
      where,
      _count: { _all: true }
    });

    // Get counts by accountable terminal
    const terminalCounts = await prisma.lateDepartureReason.groupBy({
      by: ['accountableTerminalId', 'accountableTerminalCode'],
      where,
      _count: { _all: true }
    });

    // Get total count
    const total = await prisma.lateDepartureReason.count({ where });

    // Get average minutes late
    const avgMinutesLate = await prisma.lateDepartureReason.aggregate({
      where: { ...where, minutesLate: { not: null } },
      _avg: { minutesLate: true }
    });

    res.json({
      total,
      byReason: reasonCounts.map(r => ({
        reason: r.reason,
        count: r._count._all
      })),
      byServiceFailure: serviceFailureCounts.map(s => ({
        willCauseServiceFailure: s.willCauseServiceFailure,
        count: s._count._all
      })),
      byTerminal: terminalCounts
        .filter(t => t.accountableTerminalId)
        .map(t => ({
          terminalId: t.accountableTerminalId,
          terminalCode: t.accountableTerminalCode,
          count: t._count._all
        })),
      avgMinutesLate: avgMinutesLate._avg.minutesLate
    });
  } catch (error) {
    console.error('Error fetching late departure reason stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};
