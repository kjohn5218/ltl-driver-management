import { Request, Response } from 'express';
import { prisma } from '../index';
import { LoadsheetStatus, TripStatus } from '@prisma/client';

// Helper to get week boundaries
const getWeekBoundaries = (date: Date) => {
  const dayOfWeek = date.getDay();
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
};

// Helper to calculate load factor from loadsheets
const calculateLoadFactor = async (
  startDate: Date,
  endDate: Date,
  isHeadhaul?: boolean
) => {
  const loadsheets = await prisma.loadsheet.findMany({
    where: {
      loadDate: { gte: startDate, lte: endDate },
      status: { in: [LoadsheetStatus.CLOSED, LoadsheetStatus.DISPATCHED, LoadsheetStatus.UNLOADED] },
      weight: { not: null },
    },
    include: {
      linehaulTrip: {
        include: {
          linehaulProfile: true,
        },
      },
    },
  });

  let totalWeight = 0;
  let totalCapacity = 0;

  for (const loadsheet of loadsheets) {
    // Filter by headhaul if specified
    if (isHeadhaul !== undefined) {
      const isHeadhaulProfile = loadsheet.linehaulTrip?.linehaulProfile?.headhaul ?? false;
      if (isHeadhaul !== isHeadhaulProfile) continue;
    }

    const weight = loadsheet.weight || 0;
    const trailerLength = loadsheet.suggestedTrailerLength || 53;
    // Standard benchmark: 590 lbs per foot of trailer
    const capacity = trailerLength * 590;

    totalWeight += weight;
    totalCapacity += capacity;
  }

  return totalCapacity > 0 ? (totalWeight / totalCapacity) * 100 : 0;
};

// Helper to get payroll metrics for a date range
const getPayrollMetrics = async (startDate: Date, endDate: Date) => {
  const result = await prisma.payrollLineItem.aggregate({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    _sum: {
      totalMiles: true,
      totalGrossPay: true,
      totalCost: true,
    },
    _count: {
      id: true,
    },
  });

  const totalMiles = Number(result._sum.totalMiles) || 0;
  const totalCost = Number(result._sum.totalCost || result._sum.totalGrossPay) || 0;
  const costPerMile = totalMiles > 0 ? totalCost / totalMiles : 0;

  return { totalMiles, totalCost, costPerMile, tripCount: result._count.id };
};

// Helper to get on-time metrics
const getOnTimeMetrics = async (startDate: Date, endDate: Date) => {
  // Count total completed trips
  const totalTrips = await prisma.linehaulTrip.count({
    where: {
      dispatchDate: { gte: startDate, lte: endDate },
      status: { in: [TripStatus.COMPLETED, TripStatus.ARRIVED] },
    },
  });

  // Count late trips (trips with late departure reasons)
  const lateTrips = await prisma.lateDepartureReason.count({
    where: {
      trip: {
        dispatchDate: { gte: startDate, lte: endDate },
      },
    },
  });

  // Get average delay from late departure reasons
  const avgDelayResult = await prisma.lateDepartureReason.aggregate({
    where: {
      trip: {
        dispatchDate: { gte: startDate, lte: endDate },
      },
    },
    _avg: {
      minutesLate: true,
    },
  });

  const onTimePercent = totalTrips > 0 ? ((totalTrips - lateTrips) / totalTrips) * 100 : 100;
  const avgOutboundDelay = Number(avgDelayResult._avg.minutesLate) || 0;

  return { onTimePercent, avgOutboundDelay, totalTrips, lateTrips };
};

// KPI Dashboard endpoint
export const getKPIDashboard = async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    // Calculate week boundaries
    const { startOfWeek: currentWeekStart, endOfWeek: currentWeekEnd } = getWeekBoundaries(now);

    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);
    const { startOfWeek: lastWeekStart } = getWeekBoundaries(lastWeekEnd);

    // YTD boundaries
    const ytdStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    const ytdEnd = now;

    // Prior year same period for YTD variance
    const priorYtdStart = new Date(now.getFullYear() - 1, 0, 1);
    const priorYtdEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // Fetch all metrics in parallel
    const [
      currentWeekPayroll,
      lastWeekPayroll,
      ytdPayroll,
      priorYtdPayroll,
      currentWeekOnTime,
      lastWeekOnTime,
      ytdOnTime,
      priorYtdOnTime,
      currentWeekOverallLF,
      lastWeekOverallLF,
      ytdOverallLF,
      priorYtdOverallLF,
      currentWeekHeadhaulLF,
      lastWeekHeadhaulLF,
      ytdHeadhaulLF,
      currentWeekBackhaulLF,
      lastWeekBackhaulLF,
      ytdBackhaulLF,
    ] = await Promise.all([
      // Payroll metrics
      getPayrollMetrics(currentWeekStart, currentWeekEnd),
      getPayrollMetrics(lastWeekStart, lastWeekEnd),
      getPayrollMetrics(ytdStart, ytdEnd),
      getPayrollMetrics(priorYtdStart, priorYtdEnd),
      // On-time metrics
      getOnTimeMetrics(currentWeekStart, currentWeekEnd),
      getOnTimeMetrics(lastWeekStart, lastWeekEnd),
      getOnTimeMetrics(ytdStart, ytdEnd),
      getOnTimeMetrics(priorYtdStart, priorYtdEnd),
      // Overall Load Factor
      calculateLoadFactor(currentWeekStart, currentWeekEnd),
      calculateLoadFactor(lastWeekStart, lastWeekEnd),
      calculateLoadFactor(ytdStart, ytdEnd),
      calculateLoadFactor(priorYtdStart, priorYtdEnd),
      // Headhaul Load Factor
      calculateLoadFactor(currentWeekStart, currentWeekEnd, true),
      calculateLoadFactor(lastWeekStart, lastWeekEnd, true),
      calculateLoadFactor(ytdStart, ytdEnd, true),
      // Backhaul Load Factor
      calculateLoadFactor(currentWeekStart, currentWeekEnd, false),
      calculateLoadFactor(lastWeekStart, lastWeekEnd, false),
      calculateLoadFactor(ytdStart, ytdEnd, false),
    ]);

    const response = {
      dateRange: {
        currentWeekStart: currentWeekStart.toISOString(),
        currentWeekEnd: currentWeekEnd.toISOString(),
        lastWeekStart: lastWeekStart.toISOString(),
        lastWeekEnd: lastWeekEnd.toISOString(),
        ytdStart: ytdStart.toISOString(),
        ytdEnd: ytdEnd.toISOString(),
      },
      metrics: {
        totalMiles: {
          currentWeek: currentWeekPayroll.totalMiles,
          lastWeek: lastWeekPayroll.totalMiles,
          weekVariance: currentWeekPayroll.totalMiles - lastWeekPayroll.totalMiles,
          ytd: ytdPayroll.totalMiles,
          ytdVariance: ytdPayroll.totalMiles - priorYtdPayroll.totalMiles,
        },
        totalCost: {
          currentWeek: currentWeekPayroll.totalCost,
          lastWeek: lastWeekPayroll.totalCost,
          weekVariance: currentWeekPayroll.totalCost - lastWeekPayroll.totalCost,
          ytd: ytdPayroll.totalCost,
          ytdVariance: ytdPayroll.totalCost - priorYtdPayroll.totalCost,
        },
        costPerMile: {
          currentWeek: currentWeekPayroll.costPerMile,
          lastWeek: lastWeekPayroll.costPerMile,
          weekVariance: currentWeekPayroll.costPerMile - lastWeekPayroll.costPerMile,
          ytd: ytdPayroll.costPerMile,
          ytdVariance: ytdPayroll.costPerMile - priorYtdPayroll.costPerMile,
        },
        headhaulLoadFactor: {
          currentWeek: currentWeekHeadhaulLF,
          lastWeek: lastWeekHeadhaulLF,
          weekVariance: currentWeekHeadhaulLF - lastWeekHeadhaulLF,
          ytd: ytdHeadhaulLF,
          ytdVariance: null, // Would need prior YTD headhaul LF
        },
        backhaulLoadFactor: {
          currentWeek: currentWeekBackhaulLF,
          lastWeek: lastWeekBackhaulLF,
          weekVariance: currentWeekBackhaulLF - lastWeekBackhaulLF,
          ytd: ytdBackhaulLF,
          ytdVariance: null, // Would need prior YTD backhaul LF
        },
        overallLoadFactor: {
          currentWeek: currentWeekOverallLF,
          lastWeek: lastWeekOverallLF,
          weekVariance: currentWeekOverallLF - lastWeekOverallLF,
          ytd: ytdOverallLF,
          ytdVariance: ytdOverallLF - priorYtdOverallLF,
        },
        linehaulOnTime: {
          currentWeek: currentWeekOnTime.onTimePercent,
          lastWeek: lastWeekOnTime.onTimePercent,
          weekVariance: currentWeekOnTime.onTimePercent - lastWeekOnTime.onTimePercent,
          ytd: ytdOnTime.onTimePercent,
          ytdVariance: ytdOnTime.onTimePercent - priorYtdOnTime.onTimePercent,
        },
        avgOutboundDelay: {
          currentWeek: currentWeekOnTime.avgOutboundDelay,
          lastWeek: lastWeekOnTime.avgOutboundDelay,
          weekVariance: currentWeekOnTime.avgOutboundDelay - lastWeekOnTime.avgOutboundDelay,
          ytd: ytdOnTime.avgOutboundDelay,
          ytdVariance: ytdOnTime.avgOutboundDelay - priorYtdOnTime.avgOutboundDelay,
        },
      },
    };

    return res.json(response);
  } catch (error) {
    console.error('Get KPI dashboard error:', error);
    return res.status(500).json({ message: 'Failed to fetch KPI dashboard data' });
  }
};

// Cost Per Mile Analysis endpoint
export const getCostPerMile = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate
      ? new Date(endDate as string)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Prior month for variance calculations
    const priorMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const priorMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);

    // Get payroll data for current period
    const currentPayroll = await prisma.payrollLineItem.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    });

    // Get prior month payroll for variance
    const priorPayroll = await prisma.payrollLineItem.findMany({
      where: {
        date: { gte: priorMonthStart, lte: priorMonthEnd },
      },
    });

    // Calculate overall metrics
    let totalCost = 0;
    let totalMiles = 0;
    let ccfsCost = 0;
    let ccfsMiles = 0;
    let contractCost = 0;
    let contractMiles = 0;

    // Group by lane and employer
    const laneData: Record<string, { cost: number; miles: number; trips: number }> = {};
    const employerData: Record<string, { cost: number; miles: number; trips: number }> = {};
    const priorLaneData: Record<string, { cost: number; miles: number }> = {};
    const priorEmployerData: Record<string, { cost: number; miles: number }> = {};

    // Process current period
    for (const item of currentPayroll) {
      const cost = Number(item.totalCost || item.totalGrossPay) || 0;
      const miles = Number(item.totalMiles) || 0;

      totalCost += cost;
      totalMiles += miles;

      // Determine if CCFS or Contract based on employer
      const employer = item.employer || 'Unknown';
      const isContract = employer.toLowerCase().includes('contract') ||
                         employer.toLowerCase().includes('power');

      if (isContract) {
        contractCost += cost;
        contractMiles += miles;
      } else {
        ccfsCost += cost;
        ccfsMiles += miles;
      }

      // Group by employer
      if (!employerData[employer]) {
        employerData[employer] = { cost: 0, miles: 0, trips: 0 };
      }
      employerData[employer].cost += cost;
      employerData[employer].miles += miles;
      employerData[employer].trips += 1;

      // Group by lane (use denormalized origin/destination fields)
      if (item.origin && item.destination) {
        const originCode = item.origin;
        const destCode = item.destination;
        const lane = `${originCode}${destCode}`;

        if (!laneData[lane]) {
          laneData[lane] = { cost: 0, miles: 0, trips: 0 };
        }
        laneData[lane].cost += cost;
        laneData[lane].miles += miles;
        laneData[lane].trips += 1;
      }
    }

    // Process prior period for variance
    for (const item of priorPayroll) {
      const cost = Number(item.totalCost || item.totalGrossPay) || 0;
      const miles = Number(item.totalMiles) || 0;
      const employer = item.employer || 'Unknown';

      if (!priorEmployerData[employer]) {
        priorEmployerData[employer] = { cost: 0, miles: 0 };
      }
      priorEmployerData[employer].cost += cost;
      priorEmployerData[employer].miles += miles;

      if (item.origin && item.destination) {
        const originCode = item.origin;
        const destCode = item.destination;
        const lane = `${originCode}${destCode}`;

        if (!priorLaneData[lane]) {
          priorLaneData[lane] = { cost: 0, miles: 0 };
        }
        priorLaneData[lane].cost += cost;
        priorLaneData[lane].miles += miles;
      }
    }

    // Build lane CPM array
    const byLane = Object.entries(laneData)
      .map(([lane, data]) => {
        const cpm = data.miles > 0 ? data.cost / data.miles : 0;
        const priorData = priorLaneData[lane];
        const priorCPM = priorData && priorData.miles > 0
          ? priorData.cost / priorData.miles
          : null;

        return {
          lane,
          originCode: lane.substring(0, 3),
          destinationCode: lane.substring(3),
          totalCost: data.cost,
          laborCost: data.cost * 0.7, // Approximate breakdown
          equipmentCost: data.cost * 0.2,
          fuelCost: data.cost * 0.1,
          miles: data.miles,
          trips: data.trips,
          cpm,
          priorMonthCPM: priorCPM,
          costVariance: priorCPM !== null ? cpm - priorCPM : null,
          milesVariance: priorData ? data.miles - priorData.miles : null,
        };
      })
      .sort((a, b) => b.miles - a.miles); // Sort by miles descending

    // Build employer CPM array
    const byEmployer = Object.entries(employerData)
      .map(([employer, data]) => {
        const cpm = data.miles > 0 ? data.cost / data.miles : 0;
        const priorData = priorEmployerData[employer];
        const priorCPM = priorData && priorData.miles > 0
          ? priorData.cost / priorData.miles
          : null;

        return {
          employer,
          totalCost: data.cost,
          laborCost: data.cost * 0.7,
          equipmentCost: data.cost * 0.2,
          fuelCost: data.cost * 0.1,
          totalMiles: data.miles,
          trips: data.trips,
          cpm,
          priorMonthCPM: priorCPM,
          costVariance: priorCPM !== null ? cpm - priorCPM : null,
        };
      })
      .sort((a, b) => b.totalMiles - a.totalMiles);

    // Calculate gauge values
    const overallCPM = totalMiles > 0 ? totalCost / totalMiles : 0;
    const ccfsCPM = ccfsMiles > 0 ? ccfsCost / ccfsMiles : 0;
    const contractCPM = contractMiles > 0 ? contractCost / contractMiles : 0;

    const response = {
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      gauges: {
        lhCostPerMile: overallCPM,
        ccfsCostPerMile: ccfsCPM,
        contractedCostPerMile: contractCPM,
      },
      summary: {
        totalMiles,
        totalCost,
        contractPowerCost: contractCost,
        contractPowerMileage: contractMiles,
        contractPowerCostPercent: totalCost > 0 ? (contractCost / totalCost) * 100 : 0,
        contractPowerMileagePercent: totalMiles > 0 ? (contractMiles / totalMiles) * 100 : 0,
      },
      byLane,
      byEmployer,
    };

    return res.json(response);
  } catch (error) {
    console.error('Get cost per mile error:', error);
    return res.status(500).json({ message: 'Failed to fetch cost per mile data' });
  }
};

// CCFS vs Contract Monthly Analysis endpoint
export const getCCFSContractMonthly = async (req: Request, res: Response) => {
  try {
    const { months = '12' } = req.query;
    const numMonths = Math.min(parseInt(months as string) || 12, 24);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - numMonths + 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get all payroll line items for the period
    const payrollItems = await prisma.payrollLineItem.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    });

    // Group by month and employer type
    const monthlyData: Record<string, {
      ccfsCost: number;
      contractPowerCost: number;
      ccfsMiles: number;
      contractPowerMiles: number;
    }> = {};

    // Initialize all months
    for (let i = 0; i < numMonths; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - numMonths + 1 + i, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = {
        ccfsCost: 0,
        contractPowerCost: 0,
        ccfsMiles: 0,
        contractPowerMiles: 0,
      };
    }

    // Process payroll items
    for (const item of payrollItems) {
      const itemDate = new Date(item.date);
      const monthKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          ccfsCost: 0,
          contractPowerCost: 0,
          ccfsMiles: 0,
          contractPowerMiles: 0,
        };
      }

      const cost = Number(item.totalCost || item.totalGrossPay) || 0;
      const miles = Number(item.totalMiles) || 0;

      // Determine if CCFS or Contract based on employer
      const employer = item.employer || '';
      const isContract = employer.toLowerCase().includes('contract') ||
                         employer.toLowerCase().includes('power');

      if (isContract) {
        monthlyData[monthKey].contractPowerCost += cost;
        monthlyData[monthKey].contractPowerMiles += miles;
      } else {
        monthlyData[monthKey].ccfsCost += cost;
        monthlyData[monthKey].ccfsMiles += miles;
      }
    }

    // Convert to array format
    const monthLabels = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const monthly = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [year, monthNum] = month.split('-');
        const monthLabel = `${monthLabels[parseInt(monthNum) - 1]} ${year}`;
        const totalCost = data.ccfsCost + data.contractPowerCost;
        const totalMiles = data.ccfsMiles + data.contractPowerMiles;

        return {
          month,
          monthLabel,
          ccfsCost: data.ccfsCost,
          contractPowerCost: data.contractPowerCost,
          totalCost,
          contractPowerPercent: totalCost > 0 ? (data.contractPowerCost / totalCost) * 100 : 0,
          ccfsMiles: data.ccfsMiles,
          contractPowerMiles: data.contractPowerMiles,
          totalMiles,
          contractPowerMilesPercent: totalMiles > 0 ? (data.contractPowerMiles / totalMiles) * 100 : 0,
        };
      });

    // Calculate summary totals
    const summary = monthly.reduce((acc, month) => {
      acc.totalCost += month.totalCost;
      acc.ccfsCost += month.ccfsCost;
      acc.contractPowerCost += month.contractPowerCost;
      acc.totalMiles += month.totalMiles;
      acc.ccfsMiles += month.ccfsMiles;
      acc.contractPowerMiles += month.contractPowerMiles;
      return acc;
    }, {
      totalCost: 0,
      ccfsCost: 0,
      contractPowerCost: 0,
      totalMiles: 0,
      ccfsMiles: 0,
      contractPowerMiles: 0,
      contractPowerPercent: 0,
      contractPowerMilesPercent: 0,
    });

    summary.contractPowerPercent = summary.totalCost > 0
      ? (summary.contractPowerCost / summary.totalCost) * 100
      : 0;
    summary.contractPowerMilesPercent = summary.totalMiles > 0
      ? (summary.contractPowerMiles / summary.totalMiles) * 100
      : 0;

    const response = {
      summary,
      monthly,
    };

    return res.json(response);
  } catch (error) {
    console.error('Get CCFS vs Contract monthly error:', error);
    return res.status(500).json({ message: 'Failed to fetch CCFS vs Contract data' });
  }
};

// Enhanced Load Factor Analysis endpoint
export const getEnhancedLoadFactor = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to current week if no dates provided
    const now = new Date();
    const start = startDate
      ? new Date(startDate as string)
      : (() => {
          const s = new Date(now);
          s.setDate(s.getDate() - s.getDay()); // Start of week (Sunday)
          s.setHours(0, 0, 0, 0);
          return s;
        })();
    const end = endDate
      ? new Date(endDate as string)
      : (() => {
          const e = new Date(now);
          e.setDate(e.getDate() + (6 - e.getDay())); // End of week (Saturday)
          e.setHours(23, 59, 59, 999);
          return e;
        })();

    // Calculate comparison periods
    const periodLength = end.getTime() - start.getTime();

    // Prior week
    const priorWeekStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
    const priorWeekEnd = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Prior month (same number of days, one month earlier)
    const priorMonthStart = new Date(start);
    priorMonthStart.setMonth(priorMonthStart.getMonth() - 1);
    const priorMonthEnd = new Date(priorMonthStart.getTime() + periodLength);

    // Prior year
    const priorYearStart = new Date(start);
    priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
    const priorYearEnd = new Date(priorYearStart.getTime() + periodLength);

    // Helper function to get loadsheets with terminal/lane grouping
    const getLoadFactorByTerminal = async (
      periodStart: Date,
      periodEnd: Date,
      isHeadhaul?: boolean
    ) => {
      const loadsheets = await prisma.loadsheet.findMany({
        where: {
          loadDate: { gte: periodStart, lte: periodEnd },
          status: { in: [LoadsheetStatus.CLOSED, LoadsheetStatus.DISPATCHED, LoadsheetStatus.UNLOADED] },
          weight: { not: null },
        },
        include: {
          linehaulTrip: {
            include: {
              linehaulProfile: {
                include: {
                  originTerminal: true,
                  destinationTerminal: true,
                },
              },
            },
          },
        },
      });

      // Group by terminal and lane
      const terminalData: Record<string, {
        terminal: string;
        terminalName: string;
        totalWeight: number;
        totalCapacity: number;
        lanes: Record<string, {
          lane: string;
          originCode: string;
          destinationCode: string;
          weight: number;
          capacity: number;
        }>;
      }> = {};

      for (const loadsheet of loadsheets) {
        // Filter by headhaul if specified
        if (isHeadhaul !== undefined) {
          const isHeadhaulProfile = loadsheet.linehaulTrip?.linehaulProfile?.headhaul ?? false;
          if (isHeadhaul !== isHeadhaulProfile) continue;
        }

        const weight = Number(loadsheet.weight) || 0;
        const trailerLength = loadsheet.suggestedTrailerLength || 53;
        const capacity = trailerLength * 590;

        const profile = loadsheet.linehaulTrip?.linehaulProfile;
        if (!profile) continue;

        const originTerminal = profile.originTerminal;
        const destTerminal = profile.destinationTerminal;

        if (!originTerminal || !destTerminal) continue;

        const terminalCode = originTerminal.code;
        const terminalName = originTerminal.name || terminalCode;
        const lane = `${originTerminal.code}${destTerminal.code}`;

        // Initialize terminal if not exists
        if (!terminalData[terminalCode]) {
          terminalData[terminalCode] = {
            terminal: terminalCode,
            terminalName,
            totalWeight: 0,
            totalCapacity: 0,
            lanes: {},
          };
        }

        terminalData[terminalCode].totalWeight += weight;
        terminalData[terminalCode].totalCapacity += capacity;

        // Initialize lane if not exists
        if (!terminalData[terminalCode].lanes[lane]) {
          terminalData[terminalCode].lanes[lane] = {
            lane,
            originCode: originTerminal.code,
            destinationCode: destTerminal.code,
            weight: 0,
            capacity: 0,
          };
        }

        terminalData[terminalCode].lanes[lane].weight += weight;
        terminalData[terminalCode].lanes[lane].capacity += capacity;
      }

      return terminalData;
    };

    // Get data for all periods
    const [
      currentHeadhaul,
      currentBackhaul,
      priorWeekHeadhaul,
      priorWeekBackhaul,
      priorMonthHeadhaul,
      priorMonthBackhaul,
      priorYearHeadhaul,
      priorYearBackhaul,
    ] = await Promise.all([
      getLoadFactorByTerminal(start, end, true),
      getLoadFactorByTerminal(start, end, false),
      getLoadFactorByTerminal(priorWeekStart, priorWeekEnd, true),
      getLoadFactorByTerminal(priorWeekStart, priorWeekEnd, false),
      getLoadFactorByTerminal(priorMonthStart, priorMonthEnd, true),
      getLoadFactorByTerminal(priorMonthStart, priorMonthEnd, false),
      getLoadFactorByTerminal(priorYearStart, priorYearEnd, true),
      getLoadFactorByTerminal(priorYearStart, priorYearEnd, false),
    ]);

    // Calculate overall gauges
    const calcOverallLF = (data: Record<string, { totalWeight: number; totalCapacity: number }>) => {
      let totalWeight = 0;
      let totalCapacity = 0;
      for (const terminal of Object.values(data)) {
        totalWeight += terminal.totalWeight;
        totalCapacity += terminal.totalCapacity;
      }
      return totalCapacity > 0 ? (totalWeight / totalCapacity) * 100 : 0;
    };

    const overallHeadhaulLF = calcOverallLF(currentHeadhaul);
    const overallBackhaulLF = calcOverallLF(currentBackhaul);
    const overallLF = (overallHeadhaulLF + overallBackhaulLF) / 2;

    // Calculate variance for a terminal/lane
    const calcVariance = (
      current: number,
      priorWeek: Record<string, { totalWeight: number; totalCapacity: number }>,
      priorMonth: Record<string, { totalWeight: number; totalCapacity: number }>,
      priorYear: Record<string, { totalWeight: number; totalCapacity: number }>,
      terminalCode: string
    ) => {
      const priorWeekData = priorWeek[terminalCode];
      const priorMonthData = priorMonth[terminalCode];
      const priorYearData = priorYear[terminalCode];

      const priorWeekLF = priorWeekData && priorWeekData.totalCapacity > 0
        ? (priorWeekData.totalWeight / priorWeekData.totalCapacity) * 100
        : null;
      const priorMonthLF = priorMonthData && priorMonthData.totalCapacity > 0
        ? (priorMonthData.totalWeight / priorMonthData.totalCapacity) * 100
        : null;
      const priorYearLF = priorYearData && priorYearData.totalCapacity > 0
        ? (priorYearData.totalWeight / priorYearData.totalCapacity) * 100
        : null;

      return {
        wowVariance: priorWeekLF !== null ? current - priorWeekLF : null,
        momVariance: priorMonthLF !== null ? current - priorMonthLF : null,
        yoyVariance: priorYearLF !== null ? current - priorYearLF : null,
      };
    };

    // Build terminal arrays with variance
    const buildTerminalArray = (
      current: Record<string, {
        terminal: string;
        terminalName: string;
        totalWeight: number;
        totalCapacity: number;
        lanes: Record<string, {
          lane: string;
          originCode: string;
          destinationCode: string;
          weight: number;
          capacity: number;
        }>;
      }>,
      priorWeek: Record<string, { totalWeight: number; totalCapacity: number }>,
      priorMonth: Record<string, { totalWeight: number; totalCapacity: number }>,
      priorYear: Record<string, { totalWeight: number; totalCapacity: number }>
    ) => {
      return Object.values(current)
        .map((terminal) => {
          const loadFactorPercent = terminal.totalCapacity > 0
            ? (terminal.totalWeight / terminal.totalCapacity) * 100
            : 0;

          const variance = calcVariance(
            loadFactorPercent,
            priorWeek,
            priorMonth,
            priorYear,
            terminal.terminal
          );

          const lanes = Object.values(terminal.lanes).map((lane) => {
            const laneLF = lane.capacity > 0 ? (lane.weight / lane.capacity) * 100 : 0;
            return {
              lane: lane.lane,
              originCode: lane.originCode,
              destinationCode: lane.destinationCode,
              weight: lane.weight,
              capacity: lane.capacity,
              loadFactorPercent: laneLF,
              wowVariance: null as number | null, // Lane-level variance not implemented yet
              momVariance: null as number | null,
              yoyVariance: null as number | null,
            };
          }).sort((a, b) => b.loadFactorPercent - a.loadFactorPercent);

          return {
            terminal: terminal.terminal,
            terminalName: terminal.terminalName,
            weight: terminal.totalWeight,
            capacity: terminal.totalCapacity,
            loadFactorPercent,
            ...variance,
            lanes,
          };
        })
        .sort((a, b) => b.loadFactorPercent - a.loadFactorPercent);
    };

    const headhaulByTerminal = buildTerminalArray(
      currentHeadhaul,
      priorWeekHeadhaul,
      priorMonthHeadhaul,
      priorYearHeadhaul
    );

    const backhaulByTerminal = buildTerminalArray(
      currentBackhaul,
      priorWeekBackhaul,
      priorMonthBackhaul,
      priorYearBackhaul
    );

    const response = {
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      gauges: {
        overall: overallLF,
        headhaul: overallHeadhaulLF,
        backhaul: overallBackhaulLF,
      },
      headhaulByTerminal,
      backhaulByTerminal,
    };

    return res.json(response);
  } catch (error) {
    console.error('Get enhanced load factor error:', error);
    return res.status(500).json({ message: 'Failed to fetch enhanced load factor data' });
  }
};

export default {
  getKPIDashboard,
  getCostPerMile,
  getCCFSContractMonthly,
  getEnhancedLoadFactor,
};
