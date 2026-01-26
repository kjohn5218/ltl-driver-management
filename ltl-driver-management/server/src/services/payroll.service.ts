import { prisma } from '../index';
import { Prisma, PayrollSourceType, PayrollLineItemStatus } from '@prisma/client';

/**
 * Create a PayrollLineItem from a TripPay record
 * Called when a trip is arrived and TripPay is created/calculated
 */
export const createPayrollLineItemFromTripPay = async (tripPayId: number): Promise<void> => {
  const tripPay = await prisma.tripPay.findUnique({
    where: { id: tripPayId },
    include: {
      trip: {
        include: {
          linehaulProfile: {
            include: {
              originTerminal: { select: { code: true } },
              destinationTerminal: { select: { code: true } }
            }
          },
          driverTripReport: {
            select: { dropAndHook: true, chainUpCycles: true, waitTimeMinutes: true }
          }
        }
      },
      driver: {
        select: { id: true, name: true, number: true, workdayEmployeeId: true }
      }
    }
  });

  if (!tripPay) {
    throw new Error(`TripPay with id ${tripPayId} not found`);
  }

  // Check if PayrollLineItem already exists for this TripPay
  const existing = await prisma.payrollLineItem.findUnique({
    where: { tripPayId }
  });

  if (existing) {
    // Update existing record
    await updatePayrollLineItemFromTripPay(tripPayId);
    return;
  }

  // Calculate accessorial breakdown from driver trip report
  const report = tripPay.trip?.driverTripReport;
  const dropAndHook = report?.dropAndHook || 0;
  const chainUp = report?.chainUpCycles || 0;
  const waitTimeMinutes = report?.waitTimeMinutes || 0;

  // Estimate individual accessorial pay
  const totalAccessorial = Number(tripPay.accessorialPay || 0);
  const dropHookPay = dropAndHook > 0 ? dropAndHook * 25 : 0;
  const chainUpPay = chainUp > 0 ? chainUp * 15 : 0;
  const waitTimePay = waitTimeMinutes > 0 ? (waitTimeMinutes / 60) * 18 : 0;
  const otherPay = Math.max(0, totalAccessorial - dropHookPay - chainUpPay - waitTimePay);

  // Map TripPayStatus to PayrollLineItemStatus
  const statusMap: Record<string, PayrollLineItemStatus> = {
    PENDING: 'PENDING',
    CALCULATED: 'CALCULATED',
    REVIEWED: 'REVIEWED',
    APPROVED: 'APPROVED',
    PAID: 'PAID',
    DISPUTED: 'DISPUTED'
  };

  await prisma.payrollLineItem.create({
    data: {
      sourceType: PayrollSourceType.TRIP_PAY,
      tripPayId: tripPay.id,
      driverId: tripPay.driverId!,
      tripId: tripPay.tripId,
      payPeriodId: tripPay.payPeriodId,
      date: tripPay.trip?.dispatchDate || new Date(),
      driverName: tripPay.driver?.name,
      driverNumber: tripPay.driver?.number,
      workdayEmployeeId: tripPay.driver?.workdayEmployeeId,
      tripNumber: tripPay.trip?.tripNumber,
      origin: tripPay.trip?.linehaulProfile?.originTerminal?.code,
      destination: tripPay.trip?.linehaulProfile?.destinationTerminal?.code,
      totalMiles: tripPay.trip?.actualMileage ? new Prisma.Decimal(tripPay.trip.actualMileage) : null,
      basePay: tripPay.basePay || new Prisma.Decimal(0),
      mileagePay: tripPay.mileagePay || new Prisma.Decimal(0),
      dropAndHookPay: new Prisma.Decimal(dropHookPay),
      chainUpPay: new Prisma.Decimal(chainUpPay),
      waitTimePay: new Prisma.Decimal(waitTimePay),
      otherAccessorialPay: new Prisma.Decimal(otherPay),
      bonusPay: tripPay.bonusPay || new Prisma.Decimal(0),
      deductions: tripPay.deductions || new Prisma.Decimal(0),
      totalGrossPay: tripPay.totalGrossPay || new Prisma.Decimal(0),
      status: statusMap[tripPay.status] || 'PENDING',
      calculatedAt: tripPay.calculatedAt,
      reviewedBy: tripPay.reviewedBy,
      reviewedAt: tripPay.reviewedAt,
      approvedBy: tripPay.approvedBy,
      approvedAt: tripPay.approvedAt,
      paidAt: tripPay.paidAt,
      externalPayrollId: tripPay.externalPayrollId,
      exportedAt: tripPay.exportedAt,
      notes: tripPay.notes
    }
  });
};

/**
 * Update a PayrollLineItem from its linked TripPay record
 */
export const updatePayrollLineItemFromTripPay = async (tripPayId: number): Promise<void> => {
  const tripPay = await prisma.tripPay.findUnique({
    where: { id: tripPayId },
    include: {
      trip: {
        include: {
          linehaulProfile: {
            include: {
              originTerminal: { select: { code: true } },
              destinationTerminal: { select: { code: true } }
            }
          },
          driverTripReport: {
            select: { dropAndHook: true, chainUpCycles: true, waitTimeMinutes: true }
          }
        }
      },
      driver: {
        select: { id: true, name: true, number: true, workdayEmployeeId: true }
      }
    }
  });

  if (!tripPay) return;

  const report = tripPay.trip?.driverTripReport;
  const dropAndHook = report?.dropAndHook || 0;
  const chainUp = report?.chainUpCycles || 0;
  const waitTimeMinutes = report?.waitTimeMinutes || 0;

  const totalAccessorial = Number(tripPay.accessorialPay || 0);
  const dropHookPay = dropAndHook > 0 ? dropAndHook * 25 : 0;
  const chainUpPay = chainUp > 0 ? chainUp * 15 : 0;
  const waitTimePay = waitTimeMinutes > 0 ? (waitTimeMinutes / 60) * 18 : 0;
  const otherPay = Math.max(0, totalAccessorial - dropHookPay - chainUpPay - waitTimePay);

  const statusMap: Record<string, PayrollLineItemStatus> = {
    PENDING: 'PENDING',
    CALCULATED: 'CALCULATED',
    REVIEWED: 'REVIEWED',
    APPROVED: 'APPROVED',
    PAID: 'PAID',
    DISPUTED: 'DISPUTED'
  };

  await prisma.payrollLineItem.update({
    where: { tripPayId },
    data: {
      driverName: tripPay.driver?.name,
      driverNumber: tripPay.driver?.number,
      workdayEmployeeId: tripPay.driver?.workdayEmployeeId,
      tripNumber: tripPay.trip?.tripNumber,
      origin: tripPay.trip?.linehaulProfile?.originTerminal?.code,
      destination: tripPay.trip?.linehaulProfile?.destinationTerminal?.code,
      totalMiles: tripPay.trip?.actualMileage ? new Prisma.Decimal(tripPay.trip.actualMileage) : null,
      basePay: tripPay.basePay || new Prisma.Decimal(0),
      mileagePay: tripPay.mileagePay || new Prisma.Decimal(0),
      dropAndHookPay: new Prisma.Decimal(dropHookPay),
      chainUpPay: new Prisma.Decimal(chainUpPay),
      waitTimePay: new Prisma.Decimal(waitTimePay),
      otherAccessorialPay: new Prisma.Decimal(otherPay),
      bonusPay: tripPay.bonusPay || new Prisma.Decimal(0),
      deductions: tripPay.deductions || new Prisma.Decimal(0),
      totalGrossPay: tripPay.totalGrossPay || new Prisma.Decimal(0),
      status: statusMap[tripPay.status] || 'PENDING',
      calculatedAt: tripPay.calculatedAt,
      reviewedBy: tripPay.reviewedBy,
      reviewedAt: tripPay.reviewedAt,
      approvedBy: tripPay.approvedBy,
      approvedAt: tripPay.approvedAt,
      paidAt: tripPay.paidAt,
      externalPayrollId: tripPay.externalPayrollId,
      exportedAt: tripPay.exportedAt,
      notes: tripPay.notes
    }
  });
};

/**
 * Create a PayrollLineItem from a CutPayRequest record
 * Called when cut pay is entered
 */
export const createPayrollLineItemFromCutPay = async (cutPayRequestId: number): Promise<void> => {
  const cutPay = await prisma.cutPayRequest.findUnique({
    where: { id: cutPayRequestId },
    include: {
      driver: {
        select: { id: true, name: true, number: true, workdayEmployeeId: true }
      }
    }
  });

  if (!cutPay) {
    throw new Error(`CutPayRequest with id ${cutPayRequestId} not found`);
  }

  // Check if PayrollLineItem already exists for this CutPayRequest
  const existing = await prisma.payrollLineItem.findUnique({
    where: { cutPayRequestId }
  });

  if (existing) {
    // Update existing record
    await updatePayrollLineItemFromCutPay(cutPayRequestId);
    return;
  }

  // Map CutPayStatus to PayrollLineItemStatus
  const statusMap: Record<string, PayrollLineItemStatus> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'DISPUTED',
    PAID: 'PAID'
  };

  await prisma.payrollLineItem.create({
    data: {
      sourceType: PayrollSourceType.CUT_PAY,
      cutPayRequestId: cutPay.id,
      driverId: cutPay.driverId,
      tripId: cutPay.tripId,
      date: cutPay.requestDate,
      driverName: cutPay.driver?.name,
      driverNumber: cutPay.driver?.number,
      workdayEmployeeId: cutPay.driver?.workdayEmployeeId,
      tripNumber: cutPay.tripId ? `Trip-${cutPay.tripId}` : null,
      basePay: new Prisma.Decimal(0),
      mileagePay: new Prisma.Decimal(0),
      dropAndHookPay: new Prisma.Decimal(0),
      chainUpPay: new Prisma.Decimal(0),
      waitTimePay: new Prisma.Decimal(0),
      otherAccessorialPay: new Prisma.Decimal(0),
      bonusPay: new Prisma.Decimal(0),
      deductions: new Prisma.Decimal(0),
      totalGrossPay: cutPay.totalPay || new Prisma.Decimal(0),
      cutPayType: cutPay.cutPayType,
      cutPayHours: cutPay.hoursRequested,
      cutPayMiles: cutPay.milesRequested,
      trailerConfig: cutPay.trailerConfig,
      rateApplied: cutPay.rateApplied,
      status: statusMap[cutPay.status] || 'PENDING',
      approvedBy: cutPay.approvedBy,
      approvedAt: cutPay.approvedAt,
      notes: cutPay.notes
    }
  });
};

/**
 * Update a PayrollLineItem from its linked CutPayRequest record
 */
export const updatePayrollLineItemFromCutPay = async (cutPayRequestId: number): Promise<void> => {
  const cutPay = await prisma.cutPayRequest.findUnique({
    where: { id: cutPayRequestId },
    include: {
      driver: {
        select: { id: true, name: true, number: true, workdayEmployeeId: true }
      }
    }
  });

  if (!cutPay) return;

  const statusMap: Record<string, PayrollLineItemStatus> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'DISPUTED',
    PAID: 'PAID'
  };

  await prisma.payrollLineItem.update({
    where: { cutPayRequestId },
    data: {
      driverName: cutPay.driver?.name,
      driverNumber: cutPay.driver?.number,
      workdayEmployeeId: cutPay.driver?.workdayEmployeeId,
      totalGrossPay: cutPay.totalPay || new Prisma.Decimal(0),
      cutPayType: cutPay.cutPayType,
      cutPayHours: cutPay.hoursRequested,
      cutPayMiles: cutPay.milesRequested,
      trailerConfig: cutPay.trailerConfig,
      rateApplied: cutPay.rateApplied,
      status: statusMap[cutPay.status] || 'PENDING',
      approvedBy: cutPay.approvedBy,
      approvedAt: cutPay.approvedAt,
      notes: cutPay.notes
    }
  });
};

/**
 * Sync all existing TripPay and CutPayRequest records to PayrollLineItem table
 * This is a one-time migration helper
 */
export const syncAllPayrollLineItems = async (): Promise<{ tripPay: number; cutPay: number }> => {
  let tripPayCount = 0;
  let cutPayCount = 0;

  // Sync all TripPay records
  const tripPays = await prisma.tripPay.findMany({
    select: { id: true }
  });

  for (const tp of tripPays) {
    try {
      await createPayrollLineItemFromTripPay(tp.id);
      tripPayCount++;
    } catch (error) {
      console.error(`Failed to sync TripPay ${tp.id}:`, error);
    }
  }

  // Sync all CutPayRequest records
  const cutPays = await prisma.cutPayRequest.findMany({
    select: { id: true }
  });

  for (const cp of cutPays) {
    try {
      await createPayrollLineItemFromCutPay(cp.id);
      cutPayCount++;
    } catch (error) {
      console.error(`Failed to sync CutPayRequest ${cp.id}:`, error);
    }
  }

  return { tripPay: tripPayCount, cutPay: cutPayCount };
};
