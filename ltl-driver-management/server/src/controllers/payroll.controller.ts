import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, PayPeriodStatus, TripPayStatus } from '@prisma/client';

// ==================== PAY PERIODS ====================

// Get all pay periods with filtering
export const getPayPeriods = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      status,
      year,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PayPeriodWhereInput = {};

    if (status) {
      where.status = status as PayPeriodStatus;
    }

    if (year) {
      const yearNum = parseInt(year as string, 10);
      where.periodStart = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1)
      };
    }

    const [payPeriods, total] = await Promise.all([
      prisma.payPeriod.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { periodStart: 'desc' },
        include: {
          _count: {
            select: { tripPays: true }
          }
        }
      }),
      prisma.payPeriod.count({ where })
    ]);

    res.json({
      payPeriods,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching pay periods:', error);
    res.status(500).json({ message: 'Failed to fetch pay periods' });
  }
};

// Get pay period by ID
export const getPayPeriodById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        tripPays: {
          include: {
            trip: {
              include: {
                linehaulProfile: {
                  select: { profileCode: true, name: true }
                }
              }
            },
            driver: {
              select: { id: true, name: true }
            }
          },
          orderBy: { trip: { dispatchDate: 'asc' } }
        },
        _count: {
          select: { tripPays: true }
        }
      }
    });

    if (!payPeriod) {
      res.status(404).json({ message: 'Pay period not found' });
      return;
    }

    // Calculate summary
    const summary = {
      totalTrips: payPeriod.tripPays.length,
      totalBasePay: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.basePay || 0), 0),
      totalMileagePay: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.mileagePay || 0), 0),
      totalAccessorials: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.accessorialPay || 0), 0),
      totalBonusPay: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.bonusPay || 0), 0),
      totalDeductions: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.deductions || 0), 0),
      totalGrossPay: payPeriod.tripPays.reduce((sum: number, tp) => sum + Number(tp.totalGrossPay || 0), 0),
      byStatus: {
        pending: payPeriod.tripPays.filter(tp => tp.status === 'PENDING').length,
        calculated: payPeriod.tripPays.filter(tp => tp.status === 'CALCULATED').length,
        reviewed: payPeriod.tripPays.filter(tp => tp.status === 'REVIEWED').length,
        approved: payPeriod.tripPays.filter(tp => tp.status === 'APPROVED').length,
        paid: payPeriod.tripPays.filter(tp => tp.status === 'PAID').length,
        disputed: payPeriod.tripPays.filter(tp => tp.status === 'DISPUTED').length
      }
    };

    res.json({
      ...payPeriod,
      summary
    });
  } catch (error) {
    console.error('Error fetching pay period:', error);
    res.status(500).json({ message: 'Failed to fetch pay period' });
  }
};

// Create pay period
export const createPayPeriod = async (req: Request, res: Response): Promise<void> => {
  try {
    const { periodStart, periodEnd, notes } = req.body;

    // Check for overlapping pay periods
    const overlap = await prisma.payPeriod.findFirst({
      where: {
        OR: [
          {
            periodStart: { lte: new Date(periodStart) },
            periodEnd: { gte: new Date(periodStart) }
          },
          {
            periodStart: { lte: new Date(periodEnd) },
            periodEnd: { gte: new Date(periodEnd) }
          },
          {
            periodStart: { gte: new Date(periodStart) },
            periodEnd: { lte: new Date(periodEnd) }
          }
        ]
      }
    });

    if (overlap) {
      res.status(400).json({ message: 'Pay period overlaps with an existing period' });
      return;
    }

    const payPeriod = await prisma.payPeriod.create({
      data: {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        status: 'OPEN',
        notes
      }
    });

    res.status(201).json(payPeriod);
  } catch (error) {
    console.error('Error creating pay period:', error);
    res.status(500).json({ message: 'Failed to create pay period' });
  }
};

// Update pay period status
export const updatePayPeriodStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const payPeriodId = parseInt(id, 10);

    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId }
    });

    if (!payPeriod) {
      res.status(404).json({ message: 'Pay period not found' });
      return;
    }

    // Validate status transitions
    const validTransitions: Record<PayPeriodStatus, PayPeriodStatus[]> = {
      'OPEN': ['CLOSED'],
      'CLOSED': ['LOCKED', 'OPEN'],
      'LOCKED': ['EXPORTED', 'CLOSED'],
      'EXPORTED': []
    };

    if (!validTransitions[payPeriod.status].includes(status as PayPeriodStatus)) {
      res.status(400).json({
        message: `Cannot transition from ${payPeriod.status} to ${status}`
      });
      return;
    }

    const updatedPayPeriod = await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: {
        status: status as PayPeriodStatus,
        ...(notes !== undefined && { notes })
      }
    });

    res.json(updatedPayPeriod);
  } catch (error) {
    console.error('Error updating pay period status:', error);
    res.status(500).json({ message: 'Failed to update pay period status' });
  }
};

// Get current/open pay period
export const getCurrentPayPeriod = async (_req: Request, res: Response): Promise<void> => {
  try {
    const payPeriod = await prisma.payPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { periodStart: 'desc' },
      include: {
        _count: {
          select: { tripPays: true }
        }
      }
    });

    if (!payPeriod) {
      res.status(404).json({ message: 'No open pay period found' });
      return;
    }

    res.json(payPeriod);
  } catch (error) {
    console.error('Error fetching current pay period:', error);
    res.status(500).json({ message: 'Failed to fetch current pay period' });
  }
};

// ==================== TRIP PAY ====================

// Get trip pays for a pay period
export const getTripPays = async (req: Request, res: Response): Promise<void> => {
  try {
    const { payPeriodId } = req.params;
    const { driverId, status, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.TripPayWhereInput = {
      payPeriodId: parseInt(payPeriodId, 10)
    };

    if (driverId) {
      where.driverId = parseInt(driverId as string, 10);
    }

    if (status) {
      where.status = status as TripPayStatus;
    }

    const [tripPays, total] = await Promise.all([
      prisma.tripPay.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { trip: { dispatchDate: 'asc' } },
        include: {
          trip: {
            include: {
              linehaulProfile: {
                select: { profileCode: true, name: true }
              }
            }
          },
          driver: {
            select: { id: true, name: true }
          },
          rateCard: {
            select: { id: true, rateType: true, rateAmount: true }
          }
        }
      }),
      prisma.tripPay.count({ where })
    ]);

    res.json({
      tripPays,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching trip pays:', error);
    res.status(500).json({ message: 'Failed to fetch trip pays' });
  }
};

// Get trip pay by ID
export const getTripPayById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tripPay = await prisma.tripPay.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        trip: {
          include: {
            linehaulProfile: {
              include: {
                originTerminal: true,
                destinationTerminal: true
              }
            },
            driver: true,
            truck: true,
            trailer: true,
            delays: true
          }
        },
        driver: true,
        rateCard: {
          include: {
            accessorialRates: true
          }
        },
        payPeriod: true
      }
    });

    if (!tripPay) {
      res.status(404).json({ message: 'Trip pay not found' });
      return;
    }

    res.json(tripPay);
  } catch (error) {
    console.error('Error fetching trip pay:', error);
    res.status(500).json({ message: 'Failed to fetch trip pay' });
  }
};

// Calculate pay for a trip
export const calculateTripPay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const tripIdNum = parseInt(tripId, 10);

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true
          }
        },
        driver: true,
        delays: true
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    if (!trip.driverId) {
      res.status(400).json({ message: 'Trip has no assigned driver' });
      return;
    }

    if (!trip.linehaulProfile) {
      res.status(400).json({ message: 'Trip has no linehaul profile' });
      return;
    }

    // Get applicable rate card
    const today = new Date();
    let rateCard = null;

    // Rate hierarchy: Driver > Linehaul > O/D Pair > Default
    rateCard = await prisma.rateCard.findFirst({
      where: {
        rateType: 'DRIVER',
        entityId: trip.driverId,
        active: true,
        effectiveDate: { lte: today },
        OR: [{ expirationDate: null }, { expirationDate: { gte: today } }]
      },
      include: { accessorialRates: true }
    });

    if (!rateCard && trip.linehaulProfileId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'LINEHAUL',
          linehaulProfileId: trip.linehaulProfileId,
          active: true,
          effectiveDate: { lte: today },
          OR: [{ expirationDate: null }, { expirationDate: { gte: today } }]
        },
        include: { accessorialRates: true }
      });
    }

    if (!rateCard && trip.linehaulProfile.originTerminalId && trip.linehaulProfile.destinationTerminalId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'OD_PAIR',
          originTerminalId: trip.linehaulProfile.originTerminalId,
          destinationTerminalId: trip.linehaulProfile.destinationTerminalId,
          active: true,
          effectiveDate: { lte: today },
          OR: [{ expirationDate: null }, { expirationDate: { gte: today } }]
        },
        include: { accessorialRates: true }
      });
    }

    if (!rateCard) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'DEFAULT',
          active: true,
          effectiveDate: { lte: today },
          OR: [{ expirationDate: null }, { expirationDate: { gte: today } }]
        },
        include: { accessorialRates: true }
      });
    }

    if (!rateCard) {
      res.status(400).json({ message: 'No applicable rate card found' });
      return;
    }

    // Calculate base pay
    const miles = Number(trip.actualMileage || trip.linehaulProfile.distanceMiles || 0);
    let basePay = 0;
    let mileagePay = 0;

    switch (rateCard.rateMethod) {
      case 'PER_MILE':
        mileagePay = miles * Number(rateCard.rateAmount);
        break;
      case 'FLAT_RATE':
        basePay = Number(rateCard.rateAmount);
        break;
      case 'HOURLY':
        const hours = Number(trip.linehaulProfile.transitTimeMinutes || 0) / 60;
        basePay = hours * Number(rateCard.rateAmount);
        break;
    }

    // Apply minimum amount
    if (rateCard.minimumAmount) {
      const totalBase = basePay + mileagePay;
      if (totalBase < Number(rateCard.minimumAmount)) {
        basePay = Number(rateCard.minimumAmount) - mileagePay;
      }
    }

    // Calculate accessorial pay based on delays
    let accessorialPay = 0;
    const accessorialDetails: { type: string; reason: string | null; minutes: number; amount: number }[] = [];

    for (const delay of trip.delays) {
      const accessorialRate = rateCard.accessorialRates.find(
        ar => ar.accessorialType === 'DETENTION' && delay.delayCode === 'DETENTION' ||
              ar.accessorialType === 'BREAKDOWN' && delay.delayCode === 'EQUIPMENT_BREAKDOWN' ||
              ar.accessorialType === 'LAYOVER' && delay.delayCode === 'DRIVER_UNAVAILABILITY'
      );

      if (accessorialRate) {
        const delayMins = delay.delayMinutes || 0;
        let charge = Number(accessorialRate.rateAmount);

        if (accessorialRate.rateMethod === 'HOURLY') {
          charge = (delayMins / 60) * Number(accessorialRate.rateAmount);
        }

        if (accessorialRate.minimumCharge && charge < Number(accessorialRate.minimumCharge)) {
          charge = Number(accessorialRate.minimumCharge);
        }
        if (accessorialRate.maximumCharge && charge > Number(accessorialRate.maximumCharge)) {
          charge = Number(accessorialRate.maximumCharge);
        }

        accessorialPay += charge;
        accessorialDetails.push({
          type: accessorialRate.accessorialType,
          reason: delay.delayReason,
          minutes: delayMins,
          amount: charge
        });
      }
    }

    const totalGrossPay = basePay + mileagePay + accessorialPay;

    // Get current open pay period
    const payPeriod = await prisma.payPeriod.findFirst({
      where: {
        status: 'OPEN',
        periodStart: { lte: trip.dispatchDate },
        periodEnd: { gte: trip.dispatchDate }
      }
    });

    if (!payPeriod) {
      res.status(400).json({ message: 'No open pay period found for this trip date' });
      return;
    }

    // Check if trip pay already exists
    const existingTripPay = await prisma.tripPay.findFirst({
      where: { tripId: tripIdNum }
    });

    let tripPay;
    if (existingTripPay) {
      tripPay = await prisma.tripPay.update({
        where: { id: existingTripPay.id },
        data: {
          rateCardId: rateCard.id,
          basePay: new Prisma.Decimal(basePay),
          mileagePay: new Prisma.Decimal(mileagePay),
          accessorialPay: new Prisma.Decimal(accessorialPay),
          totalGrossPay: new Prisma.Decimal(totalGrossPay),
          status: 'CALCULATED',
          calculatedAt: new Date()
        }
      });
    } else {
      tripPay = await prisma.tripPay.create({
        data: {
          tripId: tripIdNum,
          payPeriodId: payPeriod.id,
          driverId: trip.driverId,
          rateCardId: rateCard.id,
          basePay: new Prisma.Decimal(basePay),
          mileagePay: new Prisma.Decimal(mileagePay),
          accessorialPay: new Prisma.Decimal(accessorialPay),
          deductions: new Prisma.Decimal(0),
          totalGrossPay: new Prisma.Decimal(totalGrossPay),
          status: 'CALCULATED',
          calculatedAt: new Date()
        }
      });
    }

    res.json({
      tripPay,
      breakdown: {
        miles,
        rateCard: {
          id: rateCard.id,
          rateType: rateCard.rateType,
          method: rateCard.rateMethod,
          rate: Number(rateCard.rateAmount)
        },
        basePay,
        mileagePay,
        accessorialPay,
        accessorialDetails,
        totalGrossPay
      }
    });
  } catch (error) {
    console.error('Error calculating trip pay:', error);
    res.status(500).json({ message: 'Failed to calculate trip pay' });
  }
};

// Update trip pay status
export const updateTripPayStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes, bonusPay, deductions } = req.body;
    const tripPayId = parseInt(id, 10);

    const tripPay = await prisma.tripPay.findUnique({
      where: { id: tripPayId }
    });

    if (!tripPay) {
      res.status(404).json({ message: 'Trip pay not found' });
      return;
    }

    // Recalculate total if bonus or deductions changed
    let totalGrossPay = Number(tripPay.totalGrossPay);
    if (bonusPay !== undefined || deductions !== undefined) {
      const basePay = Number(tripPay.basePay);
      const mileagePay = Number(tripPay.mileagePay);
      const accessorialPay = Number(tripPay.accessorialPay);
      const newBonusPay = bonusPay !== undefined ? bonusPay : Number(tripPay.bonusPay || 0);
      const newDeductions = deductions !== undefined ? deductions : Number(tripPay.deductions || 0);

      totalGrossPay = basePay + mileagePay + accessorialPay + newBonusPay - newDeductions;
    }

    const updatedTripPay = await prisma.tripPay.update({
      where: { id: tripPayId },
      data: {
        status: status as TripPayStatus,
        ...(notes !== undefined && { notes }),
        ...(bonusPay !== undefined && { bonusPay: new Prisma.Decimal(bonusPay) }),
        ...(deductions !== undefined && { deductions: new Prisma.Decimal(deductions) }),
        totalGrossPay: new Prisma.Decimal(totalGrossPay),
        ...(status === 'APPROVED' && { approvedAt: new Date() }),
        ...(status === 'PAID' && { paidAt: new Date() })
      }
    });

    res.json(updatedTripPay);
  } catch (error) {
    console.error('Error updating trip pay status:', error);
    res.status(500).json({ message: 'Failed to update trip pay status' });
  }
};

// Bulk approve trip pays
export const bulkApproveTripPays = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripPayIds } = req.body;

    const result = await prisma.tripPay.updateMany({
      where: {
        id: { in: tripPayIds.map((id: string | number) => parseInt(id.toString(), 10)) },
        status: { in: ['CALCULATED', 'REVIEWED'] }
      },
      data: {
        status: 'APPROVED',
        approvedAt: new Date()
      }
    });

    res.json({
      approved: result.count,
      message: `${result.count} trip pays approved`
    });
  } catch (error) {
    console.error('Error bulk approving trip pays:', error);
    res.status(500).json({ message: 'Failed to bulk approve trip pays' });
  }
};

// Get driver pay summary
export const getDriverPaySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { payPeriodId, startDate, endDate } = req.query;

    const where: Prisma.TripPayWhereInput = {
      driverId: parseInt(driverId, 10)
    };

    if (payPeriodId) {
      where.payPeriodId = parseInt(payPeriodId as string, 10);
    } else if (startDate || endDate) {
      where.trip = {
        dispatchDate: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      };
    }

    const tripPays = await prisma.tripPay.findMany({
      where,
      include: {
        trip: {
          include: {
            linehaulProfile: {
              select: { profileCode: true, name: true }
            }
          }
        },
        payPeriod: {
          select: { id: true, periodStart: true, periodEnd: true }
        }
      },
      orderBy: { trip: { dispatchDate: 'asc' } }
    });

    const summary = {
      totalTrips: tripPays.length,
      totalBasePay: tripPays.reduce((sum, tp) => sum + Number(tp.basePay || 0), 0),
      totalMileagePay: tripPays.reduce((sum, tp) => sum + Number(tp.mileagePay || 0), 0),
      totalAccessorialPay: tripPays.reduce((sum, tp) => sum + Number(tp.accessorialPay || 0), 0),
      totalBonusPay: tripPays.reduce((sum, tp) => sum + Number(tp.bonusPay || 0), 0),
      totalDeductions: tripPays.reduce((sum, tp) => sum + Number(tp.deductions || 0), 0),
      totalGrossPay: tripPays.reduce((sum, tp) => sum + Number(tp.totalGrossPay || 0), 0),
      byStatus: {
        pending: tripPays.filter(tp => tp.status === 'PENDING').length,
        calculated: tripPays.filter(tp => tp.status === 'CALCULATED').length,
        reviewed: tripPays.filter(tp => tp.status === 'REVIEWED').length,
        approved: tripPays.filter(tp => tp.status === 'APPROVED').length,
        paid: tripPays.filter(tp => tp.status === 'PAID').length,
        disputed: tripPays.filter(tp => tp.status === 'DISPUTED').length
      }
    };

    res.json({
      driverId: parseInt(driverId, 10),
      tripPays,
      summary
    });
  } catch (error) {
    console.error('Error fetching driver pay summary:', error);
    res.status(500).json({ message: 'Failed to fetch driver pay summary' });
  }
};

// Export pay period for payroll
export const exportPayPeriod = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    const payPeriodId = parseInt(id, 10);

    const payPeriod = await prisma.payPeriod.findUnique({
      where: { id: payPeriodId },
      include: {
        tripPays: {
          where: { status: 'APPROVED' },
          include: {
            driver: {
              select: { id: true, name: true, externalDriverId: true }
            },
            trip: {
              include: {
                linehaulProfile: {
                  select: { profileCode: true, name: true }
                }
              }
            }
          }
        }
      }
    });

    if (!payPeriod) {
      res.status(404).json({ message: 'Pay period not found' });
      return;
    }

    if (payPeriod.status !== 'LOCKED') {
      res.status(400).json({ message: 'Pay period must be locked before export' });
      return;
    }

    // Group by driver
    const driverPayments: Record<number, {
      driverId: number;
      driverName: string;
      externalDriverId: string | null | undefined;
      trips: { tripNumber: string; profileCode: string | undefined; date: Date; basePay: number; mileagePay: number; accessorialPay: number; bonusPay: number; deductions: number; totalGrossPay: number }[];
      totalBasePay: number;
      totalMileagePay: number;
      totalAccessorialPay: number;
      totalBonusPay: number;
      totalDeductions: number;
      totalGrossPay: number;
    }> = {};

    for (const tripPay of payPeriod.tripPays) {
      if (!tripPay.driverId) continue;
      if (!driverPayments[tripPay.driverId]) {
        driverPayments[tripPay.driverId] = {
          driverId: tripPay.driverId,
          driverName: tripPay.driver?.name || 'Unknown',
          externalDriverId: tripPay.driver?.externalDriverId,
          trips: [],
          totalBasePay: 0,
          totalMileagePay: 0,
          totalAccessorialPay: 0,
          totalBonusPay: 0,
          totalDeductions: 0,
          totalGrossPay: 0
        };
      }

      const dp = driverPayments[tripPay.driverId];
      dp.trips.push({
        tripNumber: tripPay.trip.tripNumber,
        profileCode: tripPay.trip.linehaulProfile?.profileCode,
        date: tripPay.trip.dispatchDate,
        basePay: Number(tripPay.basePay),
        mileagePay: Number(tripPay.mileagePay),
        accessorialPay: Number(tripPay.accessorialPay),
        bonusPay: Number(tripPay.bonusPay || 0),
        deductions: Number(tripPay.deductions || 0),
        totalGrossPay: Number(tripPay.totalGrossPay)
      });

      dp.totalBasePay += Number(tripPay.basePay);
      dp.totalMileagePay += Number(tripPay.mileagePay);
      dp.totalAccessorialPay += Number(tripPay.accessorialPay);
      dp.totalBonusPay += Number(tripPay.bonusPay || 0);
      dp.totalDeductions += Number(tripPay.deductions || 0);
      dp.totalGrossPay += Number(tripPay.totalGrossPay);
    }

    const exportData = {
      payPeriod: {
        id: payPeriod.id,
        periodStart: payPeriod.periodStart,
        periodEnd: payPeriod.periodEnd,
        exportedAt: new Date()
      },
      driverPayments: Object.values(driverPayments),
      totals: {
        drivers: Object.keys(driverPayments).length,
        trips: payPeriod.tripPays.length,
        totalGrossPay: Object.values(driverPayments).reduce((sum, dp) => sum + dp.totalGrossPay, 0)
      }
    };

    // Mark as exported
    await prisma.payPeriod.update({
      where: { id: payPeriodId },
      data: { status: 'EXPORTED' }
    });

    if (format === 'csv') {
      // Generate CSV
      const csvLines = ['Driver ID,Driver Name,External ID,Trip Number,Date,Base Pay,Mileage Pay,Accessorial,Bonus,Deductions,Total Gross Pay'];

      for (const dp of Object.values(driverPayments)) {
        for (const trip of dp.trips) {
          csvLines.push(
            `${dp.driverId},"${dp.driverName}",${dp.externalDriverId || ''},${trip.tripNumber},${trip.date.toISOString().split('T')[0]},${trip.basePay.toFixed(2)},${trip.mileagePay.toFixed(2)},${trip.accessorialPay.toFixed(2)},${trip.bonusPay.toFixed(2)},${trip.deductions.toFixed(2)},${trip.totalGrossPay.toFixed(2)}`
          );
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=pay-period-${payPeriodId}-export.csv`);
      res.send(csvLines.join('\n'));
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting pay period:', error);
    res.status(500).json({ message: 'Failed to export pay period' });
  }
};
