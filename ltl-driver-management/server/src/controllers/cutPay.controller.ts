import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, CutPayStatus, CutPayType } from '@prisma/client';

// Get all cut pay requests with filtering
export const getCutPayRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      driverId,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.CutPayRequestWhereInput = {};

    if (status) {
      where.status = status as CutPayStatus;
    }

    if (driverId) {
      where.driverId = parseInt(driverId as string, 10);
    }

    if (startDate || endDate) {
      where.requestDate = {};
      if (startDate) {
        where.requestDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.requestDate.lte = new Date(endDate as string);
      }
    }

    const [requests, total] = await Promise.all([
      prisma.cutPayRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { requestDate: 'desc' },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              number: true,
              carrier: {
                select: { id: true, name: true }
              }
            }
          },
          approver: {
            select: { id: true, name: true }
          },
          trip: {
            select: { id: true, tripNumber: true }
          }
        }
      }),
      prisma.cutPayRequest.count({ where })
    ]);

    res.json({
      requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching cut pay requests:', error);
    res.status(500).json({ message: 'Failed to fetch cut pay requests' });
  }
};

// Get cut pay request by ID
export const getCutPayRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const request = await prisma.cutPayRequest.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true,
            carrier: {
              select: { id: true, name: true }
            }
          }
        },
        approver: {
          select: { id: true, name: true }
        },
        trip: {
          select: { id: true, tripNumber: true, dispatchDate: true }
        }
      }
    });

    if (!request) {
      res.status(404).json({ message: 'Cut pay request not found' });
      return;
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching cut pay request:', error);
    res.status(500).json({ message: 'Failed to fetch cut pay request' });
  }
};

// Create cut pay request
export const createCutPayRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      driverId,
      tripId,
      trailerConfig,
      cutPayType,
      hoursRequested,
      milesRequested,
      reason,
      notes
    } = req.body;

    // Validate driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    // Validate trip if provided
    if (tripId) {
      const trip = await prisma.linehaulTrip.findUnique({
        where: { id: tripId }
      });

      if (!trip) {
        res.status(404).json({ message: 'Trip not found' });
        return;
      }
    }

    // Determine cut pay type and validate appropriate field
    const payType: CutPayType = cutPayType === 'MILES' ? 'MILES' : 'HOURS';

    if (payType === 'HOURS' && (!hoursRequested || hoursRequested <= 0)) {
      res.status(400).json({ message: 'Hours requested is required for cut pay by hours' });
      return;
    }

    if (payType === 'MILES' && (!milesRequested || milesRequested <= 0)) {
      res.status(400).json({ message: 'Miles requested is required for cut pay by miles' });
      return;
    }

    // Create the cut pay request
    const request = await prisma.cutPayRequest.create({
      data: {
        driverId,
        tripId: tripId || null,
        trailerConfig: trailerConfig || 'SINGLE',
        cutPayType: payType,
        hoursRequested: payType === 'HOURS' ? new Prisma.Decimal(hoursRequested) : null,
        milesRequested: payType === 'MILES' ? new Prisma.Decimal(milesRequested) : null,
        reason,
        notes,
        status: 'PENDING'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true,
            carrier: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating cut pay request:', error);
    res.status(500).json({ message: 'Failed to create cut pay request' });
  }
};

// Approve cut pay request
export const approveCutPayRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { notes, rateOverride } = req.body;

    const request = await prisma.cutPayRequest.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        driver: true
      }
    });

    if (!request) {
      res.status(404).json({ message: 'Cut pay request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ message: 'Cut pay request is not in pending status' });
      return;
    }

    // Get the cut pay rate from default rates or use override
    let cutPayRate = rateOverride;

    if (!cutPayRate) {
      // Determine which accessorial type to look for based on cut pay type and trailer config
      let accessorialType: string;

      if (request.cutPayType === 'MILES') {
        // For miles-based cut pay, use trailer-specific mile rates
        switch (request.trailerConfig) {
          case 'DOUBLE':
            accessorialType = 'CUT_PAY_DOUBLE_MILES';
            break;
          case 'TRIPLE':
            accessorialType = 'CUT_PAY_TRIPLE_MILES';
            break;
          default:
            accessorialType = 'CUT_PAY_SINGLE_MILES';
        }
      } else {
        // For hours-based cut pay
        accessorialType = 'CUT_PAY';
      }

      // Find the default rate card and get the appropriate accessorial rate
      const defaultRateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'DEFAULT',
          active: true
        },
        include: {
          accessorialRates: {
            where: { accessorialType: accessorialType as any }
          }
        }
      });

      if (defaultRateCard?.accessorialRates?.[0]) {
        cutPayRate = parseFloat(defaultRateCard.accessorialRates[0].rateAmount.toString());
      } else {
        // Fallback rates if not configured
        cutPayRate = request.cutPayType === 'MILES' ? 0.50 : 18.00;
      }
    }

    // Calculate total pay based on type (hours or miles)
    let quantity: number;
    if (request.cutPayType === 'MILES') {
      quantity = parseFloat(request.milesRequested?.toString() || '0');
    } else {
      quantity = parseFloat(request.hoursRequested?.toString() || '0');
    }
    const totalPay = quantity * cutPayRate;

    // Update the request
    const updatedRequest = await prisma.cutPayRequest.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        rateApplied: new Prisma.Decimal(cutPayRate),
        totalPay: new Prisma.Decimal(totalPay),
        notes: notes ? (request.notes ? `${request.notes}\n${notes}` : notes) : request.notes
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true,
            carrier: {
              select: { id: true, name: true }
            }
          }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Cut pay request approved',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error approving cut pay request:', error);
    res.status(500).json({ message: 'Failed to approve cut pay request' });
  }
};

// Reject cut pay request
export const rejectCutPayRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const { notes } = req.body;

    const request = await prisma.cutPayRequest.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!request) {
      res.status(404).json({ message: 'Cut pay request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ message: 'Cut pay request is not in pending status' });
      return;
    }

    // Update the request
    const updatedRequest = await prisma.cutPayRequest.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
        notes: notes ? (request.notes ? `${request.notes}\nRejection reason: ${notes}` : `Rejection reason: ${notes}`) : request.notes
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true,
            carrier: {
              select: { id: true, name: true }
            }
          }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Cut pay request rejected',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error rejecting cut pay request:', error);
    res.status(500).json({ message: 'Failed to reject cut pay request' });
  }
};

// Mark cut pay as paid
export const markCutPayAsPaid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const request = await prisma.cutPayRequest.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!request) {
      res.status(404).json({ message: 'Cut pay request not found' });
      return;
    }

    if (request.status !== 'APPROVED') {
      res.status(400).json({ message: 'Cut pay request must be approved before marking as paid' });
      return;
    }

    // Update the request
    const updatedRequest = await prisma.cutPayRequest.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: 'PAID',
        notes: notes ? (request.notes ? `${request.notes}\n${notes}` : notes) : request.notes
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true,
            carrier: {
              select: { id: true, name: true }
            }
          }
        },
        approver: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      message: 'Cut pay request marked as paid',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error marking cut pay as paid:', error);
    res.status(500).json({ message: 'Failed to mark cut pay as paid' });
  }
};

// Get cut pay statistics for reporting
export const getCutPayStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const where: Prisma.CutPayRequestWhereInput = {};

    if (startDate || endDate) {
      where.requestDate = {};
      if (startDate) {
        where.requestDate.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.requestDate.lte = new Date(endDate as string);
      }
    }

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      paidRequests,
      totalPaidAmount
    ] = await Promise.all([
      prisma.cutPayRequest.count({ where }),
      prisma.cutPayRequest.count({ where: { ...where, status: 'PENDING' } }),
      prisma.cutPayRequest.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.cutPayRequest.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.cutPayRequest.count({ where: { ...where, status: 'PAID' } }),
      prisma.cutPayRequest.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { totalPay: true }
      })
    ]);

    // Get top drivers by cut pay
    const topDrivers = await prisma.cutPayRequest.groupBy({
      by: ['driverId'],
      where: { ...where, status: 'PAID' },
      _sum: { totalPay: true, hoursRequested: true },
      _count: true,
      orderBy: { _sum: { totalPay: 'desc' } },
      take: 10
    });

    // Get driver details for top drivers
    const driverIds = topDrivers.map(d => d.driverId);
    const drivers = await prisma.carrierDriver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, name: true, number: true }
    });

    const driverMap = new Map(drivers.map(d => [d.id, d]));

    const topDriversWithDetails = topDrivers.map(td => ({
      driver: driverMap.get(td.driverId),
      totalPay: td._sum.totalPay,
      totalHours: td._sum.hoursRequested,
      requestCount: td._count
    }));

    res.json({
      totalRequests,
      byStatus: {
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        paid: paidRequests
      },
      totalPaidAmount: totalPaidAmount._sum.totalPay || 0,
      topDrivers: topDriversWithDetails
    });
  } catch (error) {
    console.error('Error fetching cut pay stats:', error);
    res.status(500).json({ message: 'Failed to fetch cut pay statistics' });
  }
};
