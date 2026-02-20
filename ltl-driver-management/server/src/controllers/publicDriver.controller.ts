import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, CutPayType } from '@prisma/client';
import { createPayrollLineItemFromCutPay, calculateAndCreateTripPay, completePayrollOnArrival } from '../services/payroll.service';
import { tripDocumentService } from '../services/tripDocument.service';

// Helper to extract final destination from profile/linehaul name
// Names like "DENWAMSLC1" encode the route: DEN -> WAM -> SLC
// The final destination is the last 3-letter code before any trailing digits
const extractFinalDestination = (linehaulName: string | undefined | null): string | null => {
  if (!linehaulName) return null;
  // Remove trailing digits (e.g., "DENWAMSLC1" -> "DENWAMSLC")
  const nameWithoutDigits = linehaulName.replace(/\d+$/, '').toUpperCase();
  // Terminal codes are typically 3 characters
  // Take the last 3 characters as the final destination
  if (nameWithoutDigits.length >= 3) {
    return nameWithoutDigits.slice(-3);
  }
  return null;
};

/**
 * Public Driver Controller
 * Provides API endpoints for drivers to dispatch and arrive trips
 * without requiring SSO/user authentication.
 *
 * Authentication is done via driver verification (driver number + phone last 4)
 */

// Verify driver identity
export const verifyDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverNumber, phoneLast4 } = req.body;

    if (!driverNumber || !phoneLast4) {
      res.status(400).json({ message: 'Driver number and last 4 digits of phone are required' });
      return;
    }

    // Find driver by number - must have a phone number to authenticate
    const driver = await prisma.carrierDriver.findFirst({
      where: {
        number: { equals: driverNumber.toString().trim(), mode: 'insensitive' },
        active: true,
        phoneNumber: { not: null }
      },
      select: {
        id: true,
        name: true,
        number: true,
        phoneNumber: true,
        driverStatus: true
      },
      orderBy: { id: 'asc' } // Prefer older (original) records
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    // Verify last 4 digits of phone number
    const phoneDigitsOnly = driver.phoneNumber?.replace(/\D/g, '') || '';
    const last4 = phoneDigitsOnly.slice(-4);

    if (last4 !== phoneLast4.toString().trim()) {
      res.status(401).json({ message: 'Phone verification failed' });
      return;
    }

    // Return driver info (without full phone number for security)
    res.json({
      id: driver.id,
      name: driver.name,
      number: driver.number,
      status: driver.driverStatus,
      verified: true
    });
  } catch (error) {
    console.error('Error verifying driver:', error);
    res.status(500).json({ message: 'Failed to verify driver' });
  }
};

// Get driver's trips from past 7 days
export const getDriverTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const driverIdNum = parseInt(driverId, 10);

    // Verify driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: driverIdNum },
      select: { id: true, name: true, number: true }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    // Get trips from past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trips = await prisma.linehaulTrip.findMany({
      where: {
        OR: [
          { driverId: driverIdNum },
          { teamDriverId: driverIdNum }
        ],
        dispatchDate: {
          gte: sevenDaysAgo
        }
      },
      orderBy: { dispatchDate: 'desc' },
      include: {
        linehaulProfile: {
          select: {
            id: true,
            profileCode: true,
            name: true,
            transitTimeMinutes: true,
            distanceMiles: true,
            originTerminal: {
              select: { code: true, name: true, city: true, state: true }
            },
            destinationTerminal: {
              select: { code: true, name: true, city: true, state: true }
            }
          }
        },
        truck: {
          select: { id: true, unitNumber: true }
        },
        trailer: {
          select: { id: true, unitNumber: true }
        },
        trailer2: {
          select: { id: true, unitNumber: true }
        },
        dolly: {
          select: { id: true, unitNumber: true }
        },
        dolly2: {
          select: { id: true, unitNumber: true }
        },
        loadsheets: {
          select: {
            id: true,
            manifestNumber: true,
            linehaulName: true,
            originTerminalCode: true,
            destinationTerminalCode: true,
            sealNumber: true,
            trailerNumber: true
          }
        }
      }
    });

    res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        number: driver.number
      },
      trips
    });
  } catch (error) {
    console.error('Error fetching driver trips:', error);
    res.status(500).json({ message: 'Failed to fetch driver trips' });
  }
};

// Get available loadsheets for dispatch
export const getAvailableLoadsheets = async (_req: Request, res: Response): Promise<void> => {
  try {
    const loadsheets = await prisma.loadsheet.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED', 'LOADING'] },
        linehaulTripId: null
      },
      select: {
        id: true,
        manifestNumber: true,
        linehaulName: true,
        trailerNumber: true,
        originTerminalCode: true,
        destinationTerminalCode: true,
        pieces: true,
        weight: true
      },
      orderBy: { manifestNumber: 'asc' },
      take: 100
    });

    res.json(loadsheets);
  } catch (error) {
    console.error('Error fetching loadsheets:', error);
    res.status(500).json({ message: 'Failed to fetch loadsheets' });
  }
};

// Get available equipment (trucks and dollies) for dispatch
export const getAvailableEquipment = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [trucks, dollies, trailers] = await Promise.all([
      prisma.equipmentTruck.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true, unitNumber: true, truckType: true },
        orderBy: { unitNumber: 'asc' },
        take: 100
      }),
      prisma.equipmentDolly.findMany({
        where: { status: 'AVAILABLE' },
        select: { id: true, unitNumber: true, dollyType: true },
        orderBy: { unitNumber: 'asc' },
        take: 100
      }),
      prisma.equipmentTrailer.findMany({
        select: { id: true, unitNumber: true, trailerType: true },
        orderBy: { unitNumber: 'asc' },
        take: 500
      })
    ]);

    res.json({ trucks, dollies, trailers });
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ message: 'Failed to fetch equipment' });
  }
};

// Get linehaul profiles for dispatch
export const getLinehaulProfiles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const profiles = await prisma.linehaulProfile.findMany({
      where: { active: true },
      select: {
        id: true,
        profileCode: true,
        name: true,
        originTerminal: { select: { code: true, name: true } },
        destinationTerminal: { select: { code: true, name: true } }
      },
      orderBy: { profileCode: 'asc' }
    });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ message: 'Failed to fetch profiles' });
  }
};

// Create and dispatch a trip (for driver self-service)
export const createAndDispatchTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      driverId,
      loadsheetIds,
      dollyId,
      dolly2Id,
      truckId,
      isOwnerOperator,
      notes
    } = req.body;

    const driverIdNum = parseInt(driverId, 10);

    // Verify driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: driverIdNum }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    // Validate loadsheets
    if (!loadsheetIds || loadsheetIds.length === 0) {
      res.status(400).json({ message: 'At least one manifest is required' });
      return;
    }

    // Get loadsheets
    const loadsheets = await prisma.loadsheet.findMany({
      where: { id: { in: loadsheetIds.map((id: string | number) => parseInt(String(id), 10)) } }
    });

    if (loadsheets.length === 0) {
      res.status(400).json({ message: 'No valid loadsheets found' });
      return;
    }

    const firstLoadsheet = loadsheets[0];

    // Find matching linehaul profile
    const profile = await prisma.linehaulProfile.findFirst({
      where: {
        OR: [
          { profileCode: firstLoadsheet.linehaulName },
          { name: firstLoadsheet.linehaulName }
        ],
        active: true
      }
    });

    if (!profile) {
      res.status(400).json({ message: `Could not find linehaul profile for "${firstLoadsheet.linehaulName}"` });
      return;
    }

    // Find trailer IDs from loadsheet trailer numbers
    let trailerId: number | undefined;
    let trailer2Id: number | undefined;

    if (firstLoadsheet.trailerNumber) {
      const trailer = await prisma.equipmentTrailer.findFirst({
        where: { unitNumber: { equals: firstLoadsheet.trailerNumber, mode: 'insensitive' } }
      });
      if (trailer) trailerId = trailer.id;
    }

    if (loadsheets.length > 1 && loadsheets[1].trailerNumber) {
      const trailer2 = await prisma.equipmentTrailer.findFirst({
        where: { unitNumber: { equals: loadsheets[1].trailerNumber, mode: 'insensitive' } }
      });
      if (trailer2) trailer2Id = trailer2.id;
    }

    // Generate trip number (format: YYMMDD + 3-digit sequence, matching main app)
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    const lastTrip = await prisma.linehaulTrip.findFirst({
      where: { tripNumber: { startsWith: dateStr } },
      orderBy: { tripNumber: 'desc' }
    });
    let sequence = 1;
    if (lastTrip) {
      const lastSeq = parseInt(lastTrip.tripNumber.slice(-3), 10);
      sequence = lastSeq + 1;
    }
    const tripNumber = `${dateStr}${sequence.toString().padStart(3, '0')}`;

    // Create trip and update statuses in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the trip
      const trip = await tx.linehaulTrip.create({
        data: {
          tripNumber,
          linehaulProfileId: profile.id,
          dispatchDate: new Date(),
          actualDeparture: new Date(),
          driverId: driverIdNum,
          truckId: isOwnerOperator ? undefined : (truckId ? parseInt(String(truckId), 10) : undefined),
          trailerId,
          trailer2Id,
          dollyId: dollyId ? parseInt(String(dollyId), 10) : undefined,
          dolly2Id: dolly2Id ? parseInt(String(dolly2Id), 10) : undefined,
          notes: (notes || '') + (isOwnerOperator ? '\nOwner Operator' : ''),
          status: 'IN_TRANSIT'
        }
      });

      // Update loadsheets: set status to DISPATCHED and clear door numbers
      for (const ls of loadsheets) {
        await tx.loadsheet.update({
          where: { id: ls.id },
          data: { linehaulTripId: trip.id, status: 'DISPATCHED', doorNumber: null }
        });
      }

      // Update equipment status to DISPATCHED
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'DISPATCHED' }
        });
      }
      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'DISPATCHED' }
        });
      }
      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'DISPATCHED' }
        });
      }
      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'DISPATCHED' }
        });
      }
      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update driver status to ON_DUTY
      await tx.carrierDriver.update({
        where: { id: driverIdNum },
        data: { driverStatus: 'ON_DUTY' }
      });

      return trip;
    });

    // Generate trip documents asynchronously (non-blocking)
    tripDocumentService.generateAllDocuments(result.id)
      .then(() => {
        console.log(`Trip documents generated for trip ${result.id}`);
      })
      .catch((error) => {
        console.error(`Failed to generate trip documents for trip ${result.id}:`, error);
      });

    // Auto-create TripPay and PayrollLineItem with PENDING status when dispatched
    const payrollResult = await calculateAndCreateTripPay(result.id);
    if (!payrollResult.success) {
      console.warn(`[Driver Portal Dispatch] Payroll item creation warning for trip ${result.id}: ${payrollResult.message}`);
    }

    // Get full trip details
    const fullTrip = await prisma.linehaulTrip.findUnique({
      where: { id: result.id },
      include: {
        linehaulProfile: {
          select: {
            profileCode: true,
            name: true,
            originTerminal: { select: { code: true, name: true } },
            destinationTerminal: { select: { code: true, name: true } }
          }
        },
        truck: { select: { id: true, unitNumber: true } },
        trailer: { select: { id: true, unitNumber: true } },
        loadsheets: { select: { id: true, manifestNumber: true } }
      }
    });

    res.status(201).json({
      message: 'Trip created and dispatched successfully',
      trip: fullTrip
    });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Failed to create trip' });
  }
};

// Dispatch a trip (driver confirms departure, status goes to IN_TRANSIT)
export const dispatchTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { driverId, notes } = req.body;
    const tripIdNum = parseInt(tripId, 10);
    const driverIdNum = parseInt(driverId, 10);

    // Get the trip
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      include: {
        truck: true,
        trailer: true,
        trailer2: true,
        trailer3: true,
        dolly: true,
        dolly2: true,
        driver: true
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Verify the driver is assigned to this trip
    if (trip.driverId !== driverIdNum && trip.teamDriverId !== driverIdNum) {
      res.status(403).json({ message: 'You are not assigned to this trip' });
      return;
    }

    // Validate trip can be dispatched (must be ASSIGNED or DISPATCHED status)
    if (!['ASSIGNED', 'DISPATCHED'].includes(trip.status)) {
      res.status(400).json({
        message: `Cannot dispatch trip with status '${trip.status}'. Trip must be in ASSIGNED or DISPATCHED status.`
      });
      return;
    }

    // Update trip and equipment status in a transaction
    const updatedTrip = await prisma.$transaction(async (tx) => {
      // Update truck status to DISPATCHED
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update trailer(s) status to DISPATCHED
      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.trailer3Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer3Id },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update dolly(ies) status to DISPATCHED
      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'DISPATCHED' }
        });
      }

      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'DISPATCHED' }
        });
      }

      // Update driver status to ON_DUTY
      if (trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: 'ON_DUTY' }
        });
      }

      // Update loadsheets: set status to DISPATCHED and clear door numbers
      await tx.loadsheet.updateMany({
        where: { linehaulTripId: tripIdNum },
        data: {
          status: 'DISPATCHED',
          doorNumber: null
        }
      });

      // Update the trip
      return tx.linehaulTrip.update({
        where: { id: tripIdNum },
        data: {
          status: 'DISPATCHED',
          actualDeparture: new Date(),
          ...(notes && { notes: trip.notes ? `${trip.notes}\n${notes}` : notes })
        },
        include: {
          linehaulProfile: {
            select: {
              id: true,
              profileCode: true,
              name: true,
              originTerminal: { select: { code: true, name: true } },
              destinationTerminal: { select: { code: true, name: true } }
            }
          },
          truck: { select: { id: true, unitNumber: true } },
          trailer: { select: { id: true, unitNumber: true } },
          loadsheets: {
            select: { id: true, manifestNumber: true }
          }
        }
      });
    });

    // Generate trip documents asynchronously (non-blocking)
    tripDocumentService.generateAllDocuments(tripIdNum)
      .then(() => {
        console.log(`Trip documents generated for trip ${tripIdNum}`);
      })
      .catch((error) => {
        console.error(`Failed to generate trip documents for trip ${tripIdNum}:`, error);
      });

    // Auto-create TripPay and PayrollLineItem with PENDING status when dispatched
    const payrollResult = await calculateAndCreateTripPay(tripIdNum);
    if (!payrollResult.success) {
      console.warn(`[Driver Portal Dispatch] Payroll item creation warning for trip ${tripIdNum}: ${payrollResult.message}`);
    }

    res.json({
      message: 'Trip dispatched successfully',
      trip: updatedTrip,
      payroll: payrollResult
    });
  } catch (error) {
    console.error('Error dispatching trip:', error);
    res.status(500).json({ message: 'Failed to dispatch trip' });
  }
};

// Arrive a trip (driver submits arrival details)
export const arriveTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const tripIdNum = parseInt(tripId, 10);
    const {
      driverId,
      actualArrival,
      actualMileage,
      dropAndHook,
      chainUpCycles,
      waitTimeStart,
      waitTimeEnd,
      waitTimeReason,
      notes,
      equipmentIssue,
      moraleRating
    } = req.body;

    const driverIdNum = parseInt(driverId, 10);

    // Use provided arrival time or default to now
    const arrivalTime = actualArrival ? new Date(actualArrival) : new Date();

    // Get the trip with driver info
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      include: {
        driver: true,
        truck: true,
        trailer: true,
        trailer2: true,
        trailer3: true,
        dolly: true,
        dolly2: true,
        linehaulProfile: {
          include: {
            destinationTerminal: { select: { code: true } }
          }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // Verify the driver is assigned to this trip
    if (trip.driverId !== driverIdNum && trip.teamDriverId !== driverIdNum) {
      res.status(403).json({ message: 'You are not assigned to this trip' });
      return;
    }

    // Validate trip can be arrived (must be DISPATCHED or IN_TRANSIT status)
    if (!['DISPATCHED', 'IN_TRANSIT'].includes(trip.status)) {
      res.status(400).json({
        message: `Cannot arrive trip with status '${trip.status}'. Trip must be DISPATCHED or IN_TRANSIT.`
      });
      return;
    }

    // Calculate wait time in minutes if both start and end are provided
    let waitTimeMinutes: number | null = null;
    if (waitTimeStart && waitTimeEnd) {
      const start = new Date(waitTimeStart);
      const end = new Date(waitTimeEnd);
      waitTimeMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    // Create the driver trip report and update trip status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update trip status to ARRIVED
      const updatedTrip = await tx.linehaulTrip.update({
        where: { id: tripIdNum },
        data: {
          status: 'ARRIVED',
          actualArrival: arrivalTime,
          actualMileage: actualMileage ? parseInt(actualMileage, 10) : undefined
        }
      });

      // Update equipment status to AVAILABLE
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.trailer3Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer3Id },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'AVAILABLE' }
        });
      }

      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'AVAILABLE' }
        });
      }

      // Update driver status to AVAILABLE
      if (trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: 'AVAILABLE' }
        });
      }

      // Process loadsheets with proper status handling (matching main application logic)
      const destinationCode = trip.destinationTerminalCode || trip.linehaulProfile?.destinationTerminal?.code;

      // Check if destination is a physical terminal and get its ID
      let isPhysicalTerminal = false;
      let destinationTerminalId: number | null = null;
      if (destinationCode) {
        const destinationLocation = await tx.location.findUnique({
          where: { code: destinationCode },
          select: { id: true, isPhysicalTerminal: true }
        });
        isPhysicalTerminal = destinationLocation?.isPhysicalTerminal || false;
        destinationTerminalId = destinationLocation?.id || null;
      }

      // Get loadsheets assigned to this trip (include linehaulName to check individual final destinations)
      const loadsheets = await tx.loadsheet.findMany({
        where: { linehaulTripId: tripIdNum },
        select: { id: true, manifestNumber: true, pieces: true, weight: true, linehaulName: true }
      });

      // For each loadsheet, recalculate capacity based on freight not yet unloaded at this terminal
      for (const loadsheet of loadsheets) {
        // Get freight items for this loadsheet that have been unloaded at this terminal
        const unloadedItems = await tx.manifestFreightItem.aggregate({
          where: {
            manifestNumber: loadsheet.manifestNumber,
            unloadedTerminal: destinationCode
          },
          _sum: {
            pieces: true,
            weight: true
          }
        });

        // Get total freight items for this loadsheet
        const totalItems = await tx.manifestFreightItem.aggregate({
          where: {
            manifestNumber: loadsheet.manifestNumber
          },
          _sum: {
            pieces: true,
            weight: true
          }
        });

        // Calculate remaining pieces and weight after unloading
        const totalPieces = totalItems._sum.pieces || 0;
        const totalWeight = totalItems._sum.weight || 0;
        const unloadedPieces = unloadedItems._sum.pieces || 0;
        const unloadedWeight = unloadedItems._sum.weight || 0;

        // If no freight items tracked, use loadsheet's existing pieces/weight as "remaining"
        const remainingPieces = totalPieces > 0
          ? totalPieces - unloadedPieces
          : (loadsheet.pieces || 0);
        const remainingWeight = totalWeight > 0
          ? totalWeight - unloadedWeight
          : (loadsheet.weight || 0);

        // Determine capacity percentage based on remaining weight
        const maxWeight = 45000;
        let capacityPercent = '0%';
        if (remainingWeight > 0) {
          const percentFull = (remainingWeight / maxWeight) * 100;
          if (percentFull >= 90) capacityPercent = '100%';
          else if (percentFull >= 65) capacityPercent = '75%';
          else if (percentFull >= 40) capacityPercent = '50%';
          else if (percentFull >= 15) capacityPercent = '25%';
          else capacityPercent = '0%';
        }

        // Check if THIS SPECIFIC loadsheet has reached its final destination
        const loadsheetFinalDest = extractFinalDestination(loadsheet.linehaulName);
        const isLoadsheetAtFinalDestination = destinationCode && loadsheetFinalDest &&
          destinationCode.toUpperCase() === loadsheetFinalDest.toUpperCase();

        // Update loadsheet based on arrival location and remaining freight:
        // - CLOSED: Arrived at final destination (no more legs to continue)
        // - OPEN: Physical terminal, available for next leg (default for continuing loads)
        // - UNLOADED: Freight has been explicitly LHUNLOAD scanned off
        let newStatus: 'OPEN' | 'UNLOADED' | 'CLOSED';
        if (isLoadsheetAtFinalDestination) {
          newStatus = 'CLOSED';
        } else if (isPhysicalTerminal) {
          if (unloadedPieces > 0 && remainingPieces <= 0) {
            newStatus = 'UNLOADED';
          } else {
            newStatus = 'OPEN';
          }
        } else {
          newStatus = 'OPEN';
        }

        // Get current date for continuing loadsheets
        const today = new Date().toISOString().split('T')[0];

        // For continuing loads, determine the next leg destination from the linehaulName
        let nextDestination: string | null = null;
        if (!isLoadsheetAtFinalDestination && loadsheet.linehaulName) {
          const routeBase = loadsheet.linehaulName.replace(/\d+$/, '').toUpperCase();
          if (routeBase.length >= 3) {
            const extractedDest = routeBase.slice(-3);
            if (extractedDest !== destinationCode?.toUpperCase()) {
              nextDestination = extractedDest;
            }
          }
        }

        console.log(`[Driver Portal Arrive] Loadsheet ${loadsheet.manifestNumber}: linehaulName=${loadsheet.linehaulName}, finalDest=${loadsheetFinalDest}, arrivalDest=${destinationCode}, isAtFinal=${isLoadsheetAtFinalDestination}, newStatus=${newStatus}`);

        await tx.loadsheet.update({
          where: { id: loadsheet.id },
          data: {
            // Keep linehaulTripId for all loadsheets so they display on Inbound tab
            linehaulTripId: tripIdNum,
            // Only update origin for continuing loads (not at final destination)
            ...(!isLoadsheetAtFinalDestination && destinationCode && { originTerminalCode: destinationCode }),
            ...(!isLoadsheetAtFinalDestination && destinationTerminalId && { originTerminalId: destinationTerminalId }),
            // Set next destination for continuing loads, null for final destination
            destinationTerminalCode: isLoadsheetAtFinalDestination ? null : nextDestination,
            status: newStatus,
            pieces: remainingPieces > 0 ? remainingPieces : 0,
            weight: remainingWeight > 0 ? remainingWeight : 0,
            capacity: capacityPercent,
            // Update loadDate and scheduledDepartDate for continuing loads
            ...(newStatus === 'OPEN' && {
              loadDate: new Date(),
              scheduledDepartDate: today
            })
          }
        });
      }

      // Create driver trip report
      const driverReport = await tx.driverTripReport.create({
        data: {
          tripId: tripIdNum,
          driverId: trip.driverId,
          dropAndHook: dropAndHook !== undefined ? parseInt(dropAndHook, 10) : null,
          chainUpCycles: chainUpCycles !== undefined ? parseInt(chainUpCycles, 10) : null,
          waitTimeStart: waitTimeStart ? new Date(waitTimeStart) : null,
          waitTimeEnd: waitTimeEnd ? new Date(waitTimeEnd) : null,
          waitTimeMinutes,
          waitTimeReason: waitTimeReason || null,
          notes: notes || null,
          arrivedAt: arrivalTime
        }
      });

      // Create equipment issue if provided
      let createdIssue = null;
      if (equipmentIssue && equipmentIssue.equipmentType && equipmentIssue.equipmentNumber && equipmentIssue.description) {
        createdIssue = await tx.equipmentIssue.create({
          data: {
            tripId: tripIdNum,
            driverId: trip.driverId,
            equipmentType: equipmentIssue.equipmentType,
            equipmentNumber: equipmentIssue.equipmentNumber,
            description: equipmentIssue.description,
            reportedAt: arrivalTime
          }
        });
      }

      // Create morale rating if provided
      let createdMoraleRating = null;
      if (moraleRating && moraleRating >= 1 && moraleRating <= 5) {
        // Check if rating already exists for this trip
        const existingRating = await tx.driverMoraleRating.findUnique({
          where: { tripId: tripIdNum }
        });

        if (!existingRating) {
          createdMoraleRating = await tx.driverMoraleRating.create({
            data: {
              tripId: tripIdNum,
              driverId: trip.driverId!,
              rating: parseInt(moraleRating, 10),
              arrivedAt: arrivalTime
            }
          });
        }
      }

      return { trip: updatedTrip, driverReport, equipmentIssue: createdIssue, moraleRating: createdMoraleRating };
    });

    // Update PayrollLineItem status to COMPLETE and add accessorial details
    const payrollResult = await completePayrollOnArrival(tripIdNum);
    if (!payrollResult.success) {
      console.warn(`[Driver Portal Arrive] Payroll completion warning for trip ${tripIdNum}: ${payrollResult.message}`);
    }

    res.json({
      message: 'Trip arrived successfully',
      trip: result.trip,
      driverReport: result.driverReport,
      equipmentIssue: result.equipmentIssue,
      moraleRating: result.moraleRating,
      payroll: payrollResult
    });
  } catch (error) {
    console.error('Error arriving trip:', error);
    res.status(500).json({ message: 'Failed to arrive trip' });
  }
};

// Get trip details for driver view
export const getTripDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { driverId } = req.query;
    const tripIdNum = parseInt(tripId, 10);
    const driverIdNum = driverId ? parseInt(driverId as string, 10) : null;

    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      include: {
        linehaulProfile: {
          include: {
            originTerminal: true,
            destinationTerminal: true
          }
        },
        driver: {
          select: { id: true, name: true }
        },
        teamDriver: {
          select: { id: true, name: true }
        },
        truck: {
          select: { id: true, unitNumber: true }
        },
        trailer: {
          select: { id: true, unitNumber: true }
        },
        trailer2: {
          select: { id: true, unitNumber: true }
        },
        trailer3: {
          select: { id: true, unitNumber: true }
        },
        dolly: {
          select: { id: true, unitNumber: true }
        },
        dolly2: {
          select: { id: true, unitNumber: true }
        },
        loadsheets: {
          select: {
            id: true,
            manifestNumber: true,
            linehaulName: true,
            originTerminalCode: true,
            destinationTerminalCode: true,
            sealNumber: true,
            pieces: true,
            weight: true
          }
        }
      }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // If driverId is provided, verify the driver is assigned to this trip
    if (driverIdNum && trip.driverId !== driverIdNum && trip.teamDriverId !== driverIdNum) {
      res.status(403).json({ message: 'You are not assigned to this trip' });
      return;
    }

    res.json(trip);
  } catch (error) {
    console.error('Error fetching trip details:', error);
    res.status(500).json({ message: 'Failed to fetch trip details' });
  }
};

// Create cut pay request (driver self-service)
export const createCutPayRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      driverId,
      trailerConfig,
      cutPayType,
      hoursRequested,
      milesRequested,
      reason,
      notes
    } = req.body;

    const driverIdNum = parseInt(driverId, 10);

    // Validate driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: driverIdNum },
      select: {
        id: true,
        name: true,
        number: true,
        active: true
      }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    if (!driver.active) {
      res.status(400).json({ message: 'Driver is not active' });
      return;
    }

    // Determine cut pay type and validate appropriate field
    const payType: CutPayType = cutPayType === 'MILES' ? 'MILES' : 'HOURS';

    // Parse numeric values - handle both string and number inputs
    const parsedHours = hoursRequested !== undefined && hoursRequested !== null
      ? parseFloat(String(hoursRequested))
      : NaN;
    const parsedMiles = milesRequested !== undefined && milesRequested !== null
      ? parseFloat(String(milesRequested))
      : NaN;

    if (payType === 'HOURS' && (isNaN(parsedHours) || parsedHours <= 0)) {
      res.status(400).json({ message: 'Hours requested is required for cut pay by hours' });
      return;
    }

    if (payType === 'MILES' && (isNaN(parsedMiles) || parsedMiles <= 0)) {
      res.status(400).json({ message: 'Miles requested is required for cut pay by miles' });
      return;
    }

    // Validate trailer config
    const validTrailerConfigs = ['SINGLE', 'DOUBLE', 'TRIPLE'];
    const config = trailerConfig && validTrailerConfigs.includes(trailerConfig) ? trailerConfig : 'SINGLE';

    // Create the cut pay request
    const request = await prisma.cutPayRequest.create({
      data: {
        driverId: driverIdNum,
        trailerConfig: config,
        cutPayType: payType,
        hoursRequested: payType === 'HOURS' ? new Prisma.Decimal(parsedHours) : null,
        milesRequested: payType === 'MILES' ? new Prisma.Decimal(parsedMiles) : null,
        reason: reason || null,
        notes: notes || null,
        status: 'PENDING'
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            number: true
          }
        }
      }
    });

    // Create PayrollLineItem for the cut pay request
    await createPayrollLineItemFromCutPay(request.id);

    res.status(201).json({
      message: 'Cut pay request submitted successfully',
      request
    });
  } catch (error) {
    console.error('Error creating cut pay request:', error);
    res.status(500).json({ message: 'Failed to create cut pay request' });
  }
};

// Get driver's cut pay requests
export const getDriverCutPayRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const driverIdNum = parseInt(driverId, 10);

    // Verify driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: driverIdNum },
      select: { id: true, name: true, number: true }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    // Get cut pay requests from past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const requests = await prisma.cutPayRequest.findMany({
      where: {
        driverId: driverIdNum,
        requestDate: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { requestDate: 'desc' },
      select: {
        id: true,
        requestDate: true,
        status: true,
        trailerConfig: true,
        cutPayType: true,
        hoursRequested: true,
        milesRequested: true,
        reason: true,
        totalPay: true,
        createdAt: true
      }
    });

    res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        number: driver.number
      },
      requests
    });
  } catch (error) {
    console.error('Error fetching driver cut pay requests:', error);
    res.status(500).json({ message: 'Failed to fetch cut pay requests' });
  }
};

// Get trip documents (for driver to view/download)
export const getTripDocumentsForDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId } = req.params;
    const { driverId } = req.query;
    const tripIdNum = parseInt(tripId, 10);
    const driverIdNum = driverId ? parseInt(driverId as string, 10) : null;

    // Get the trip to verify driver assignment
    const trip = await prisma.linehaulTrip.findUnique({
      where: { id: tripIdNum },
      select: { id: true, driverId: true, teamDriverId: true }
    });

    if (!trip) {
      res.status(404).json({ message: 'Trip not found' });
      return;
    }

    // If driverId is provided, verify the driver is assigned to this trip
    if (driverIdNum && trip.driverId !== driverIdNum && trip.teamDriverId !== driverIdNum) {
      res.status(403).json({ message: 'You are not assigned to this trip' });
      return;
    }

    // Get documents for this trip
    const documents = await prisma.tripDocument.findMany({
      where: { tripId: tripIdNum },
      select: {
        id: true,
        documentType: true,
        documentNumber: true,
        status: true,
        generatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ tripId: tripIdNum, documents });
  } catch (error) {
    console.error('Error fetching trip documents:', error);
    res.status(500).json({ message: 'Failed to fetch trip documents' });
  }
};

// Download a trip document as PDF
export const downloadTripDocumentForDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;
    const { driverId } = req.query;
    const documentIdNum = parseInt(documentId, 10);
    const driverIdNum = driverId ? parseInt(driverId as string, 10) : null;

    // Get the document with trip info
    const document = await prisma.tripDocument.findUnique({
      where: { id: documentIdNum },
      include: {
        trip: {
          select: { id: true, driverId: true, teamDriverId: true }
        }
      }
    });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    // If driverId is provided, verify the driver is assigned to this trip
    if (driverIdNum && document.trip.driverId !== driverIdNum && document.trip.teamDriverId !== driverIdNum) {
      res.status(403).json({ message: 'You are not assigned to this trip' });
      return;
    }

    let pdfBuffer: Buffer;
    let filename: string;

    if (document.documentType === 'LINEHAUL_MANIFEST') {
      pdfBuffer = await tripDocumentService.generateManifestPDF(documentIdNum);
      filename = `linehaul-manifest-${document.documentNumber}.pdf`;
    } else if (document.documentType === 'PLACARD_SHEET') {
      pdfBuffer = await tripDocumentService.generatePlacardSheetPDF(documentIdNum);
      filename = `placard-info-${document.documentNumber}.pdf`;
    } else {
      res.status(400).json({ message: 'Unsupported document type for download' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Failed to download document' });
  }
};
