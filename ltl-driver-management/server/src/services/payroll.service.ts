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

/**
 * Calculate and create TripPay for an arrived trip
 * Called automatically when a trip arrives to populate the payroll page
 */
export const calculateAndCreateTripPay = async (tripId: number): Promise<{ success: boolean; message: string; tripPayId?: number }> => {
  try {
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripId },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true
          }
        },
        driver: true,
        delays: true,
        driverTripReport: true
      }
    });

    if (!trip) {
      return { success: false, message: 'Trip not found' };
    }

    if (!trip.driverId) {
      return { success: false, message: 'Trip has no assigned driver' };
    }

    if (!trip.linehaulProfile) {
      return { success: false, message: 'Trip has no linehaul profile' };
    }

    // Check if trip pay already exists
    const existingTripPay = await prisma.tripPay.findFirst({
      where: { tripId }
    });

    if (existingTripPay) {
      // Update existing PayrollLineItem to ensure it's in sync
      await updatePayrollLineItemFromTripPay(existingTripPay.id);
      return { success: true, message: 'Trip pay already exists', tripPayId: existingTripPay.id };
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

    // Calculate base pay
    const miles = Number(trip.actualMileage || trip.linehaulProfile.distanceMiles || 0);
    let basePay = 0;
    let mileagePay = 0;

    if (rateCard) {
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
    }

    // Calculate accessorial pay based on delays
    let accessorialPay = 0;
    if (rateCard) {
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
        }
      }
    }

    const totalGrossPay = basePay + mileagePay + accessorialPay;

    // Get or create an open pay period
    let payPeriod = await prisma.payPeriod.findFirst({
      where: {
        status: 'OPEN',
        periodStart: { lte: trip.dispatchDate || new Date() },
        periodEnd: { gte: trip.dispatchDate || new Date() }
      }
    });

    // If no pay period exists, create one for the current month
    if (!payPeriod) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      payPeriod = await prisma.payPeriod.create({
        data: {
          periodStart,
          periodEnd,
          status: 'OPEN'
        }
      });
    }

    // Create TripPay record
    const tripPay = await prisma.tripPay.create({
      data: {
        tripId,
        payPeriodId: payPeriod.id,
        driverId: trip.driverId,
        rateCardId: rateCard?.id || null,
        basePay: new Prisma.Decimal(basePay),
        mileagePay: new Prisma.Decimal(mileagePay),
        accessorialPay: new Prisma.Decimal(accessorialPay),
        deductions: new Prisma.Decimal(0),
        totalGrossPay: new Prisma.Decimal(totalGrossPay),
        status: rateCard ? 'CALCULATED' : 'PENDING',
        calculatedAt: new Date()
      }
    });

    // Create PayrollLineItem
    await createPayrollLineItemFromTripPay(tripPay.id);

    console.log(`[Payroll] Created TripPay ${tripPay.id} for trip ${tripId} with total pay $${totalGrossPay.toFixed(2)}`);

    return { success: true, message: 'Trip pay created', tripPayId: tripPay.id };
  } catch (error) {
    console.error(`[Payroll] Failed to create trip pay for trip ${tripId}:`, error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Update payroll status to COMPLETE when trip arrives
 * Also updates accessorial information from driver trip report
 */
export const completePayrollOnArrival = async (tripId: number): Promise<{ success: boolean; message: string }> => {
  try {
    // Find the PayrollLineItem for this trip
    const payrollItem = await prisma.payrollLineItem.findFirst({
      where: { tripId }
    });

    if (!payrollItem) {
      return { success: false, message: 'No payroll item found for this trip' };
    }

    // Get the driver trip report to update accessorial pay
    const report = await prisma.driverTripReport.findUnique({
      where: { tripId }
    });

    // Calculate accessorial breakdown from driver trip report
    const dropAndHook = report?.dropAndHook || 0;
    const chainUp = report?.chainUpCycles || 0;
    const waitTimeMinutes = report?.waitTimeMinutes || 0;

    // Estimate individual accessorial pay (using standard rates)
    const dropHookPay = dropAndHook > 0 ? dropAndHook * 25 : 0;
    const chainUpPay = chainUp > 0 ? chainUp * 15 : 0;
    const waitTimePay = waitTimeMinutes > 0 ? (waitTimeMinutes / 60) * 18 : 0;

    // Update PayrollLineItem to COMPLETE and add accessorial details
    await prisma.payrollLineItem.update({
      where: { id: payrollItem.id },
      data: {
        status: 'COMPLETE',
        dropAndHookPay: new Prisma.Decimal(dropHookPay),
        chainUpPay: new Prisma.Decimal(chainUpPay),
        waitTimePay: new Prisma.Decimal(waitTimePay),
        // Recalculate total gross pay with accessorials
        totalGrossPay: new Prisma.Decimal(
          Number(payrollItem.basePay || 0) +
          Number(payrollItem.mileagePay || 0) +
          dropHookPay +
          chainUpPay +
          waitTimePay +
          Number(payrollItem.otherAccessorialPay || 0) +
          Number(payrollItem.bonusPay || 0) -
          Number(payrollItem.deductions || 0)
        )
      }
    });

    // Also update TripPay status if it exists
    const tripPay = await prisma.tripPay.findFirst({
      where: { tripId }
    });

    if (tripPay) {
      await prisma.tripPay.update({
        where: { id: tripPay.id },
        data: {
          status: 'CALCULATED',
          accessorialPay: new Prisma.Decimal(dropHookPay + chainUpPay + waitTimePay),
          totalGrossPay: new Prisma.Decimal(
            Number(tripPay.basePay || 0) +
            Number(tripPay.mileagePay || 0) +
            dropHookPay +
            chainUpPay +
            waitTimePay -
            Number(tripPay.deductions || 0)
          )
        }
      });
    }

    console.log(`[Payroll] Trip ${tripId} payroll marked as COMPLETE`);
    return { success: true, message: 'Payroll status updated to COMPLETE' };
  } catch (error) {
    console.error(`[Payroll] Failed to complete payroll for trip ${tripId}:`, error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
};
