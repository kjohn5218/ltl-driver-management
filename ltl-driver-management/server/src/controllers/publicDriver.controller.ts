import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, CutPayType } from '@prisma/client';

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

    // Find driver by number
    const driver = await prisma.carrierDriver.findFirst({
      where: {
        number: driverNumber.toString().trim(),
        active: true
      },
      select: {
        id: true,
        name: true,
        number: true,
        phoneNumber: true,
        driverStatus: true
      }
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

    // Generate trip number
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
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

      // Update loadsheets
      for (const ls of loadsheets) {
        await tx.loadsheet.update({
          where: { id: ls.id },
          data: { linehaulTripId: trip.id, status: 'DISPATCHED' }
        });
      }

      // Update equipment status
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'IN_TRANSIT' }
        });
      }
      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'IN_TRANSIT' }
        });
      }
      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'IN_TRANSIT' }
        });
      }
      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'IN_TRANSIT' }
        });
      }
      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'IN_TRANSIT' }
        });
      }

      // Update driver status
      await tx.carrierDriver.update({
        where: { id: driverIdNum },
        data: { driverStatus: 'DRIVING' }
      });

      return trip;
    });

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
      // Update truck status to IN_TRANSIT
      if (trip.truckId) {
        await tx.equipmentTruck.update({
          where: { id: trip.truckId },
          data: { status: 'IN_TRANSIT' }
        });
      }

      // Update trailer(s) status to IN_TRANSIT
      if (trip.trailerId) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailerId },
          data: { status: 'IN_TRANSIT' }
        });
      }

      if (trip.trailer2Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer2Id },
          data: { status: 'IN_TRANSIT' }
        });
      }

      if (trip.trailer3Id) {
        await tx.equipmentTrailer.update({
          where: { id: trip.trailer3Id },
          data: { status: 'IN_TRANSIT' }
        });
      }

      // Update dolly(ies) status to IN_TRANSIT
      if (trip.dollyId) {
        await tx.equipmentDolly.update({
          where: { id: trip.dollyId },
          data: { status: 'IN_TRANSIT' }
        });
      }

      if (trip.dolly2Id) {
        await tx.equipmentDolly.update({
          where: { id: trip.dolly2Id },
          data: { status: 'IN_TRANSIT' }
        });
      }

      // Update driver status to DRIVING
      if (trip.driverId) {
        await tx.carrierDriver.update({
          where: { id: trip.driverId },
          data: { driverStatus: 'DRIVING' }
        });
      }

      // Update the trip
      return tx.linehaulTrip.update({
        where: { id: tripIdNum },
        data: {
          status: 'IN_TRANSIT',
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

    res.json({
      message: 'Trip dispatched successfully',
      trip: updatedTrip
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

    // Validate trip can be arrived (must be IN_TRANSIT status)
    if (trip.status !== 'IN_TRANSIT') {
      res.status(400).json({
        message: `Cannot arrive trip with status '${trip.status}'. Trip must be IN_TRANSIT.`
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
          actualArrival: arrivalTime
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

      // Release loadsheets for next leg
      const destinationCode = trip.linehaulProfile?.destinationTerminal?.code;
      await tx.loadsheet.updateMany({
        where: { linehaulTripId: tripIdNum },
        data: {
          linehaulTripId: null,
          ...(destinationCode && { originTerminalCode: destinationCode }),
          destinationTerminalCode: null,
          status: 'OPEN'
        }
      });

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

    res.json({
      message: 'Trip arrived successfully',
      trip: result.trip,
      driverReport: result.driverReport,
      equipmentIssue: result.equipmentIssue,
      moraleRating: result.moraleRating
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

    if (payType === 'HOURS' && (!hoursRequested || parseFloat(hoursRequested) <= 0)) {
      res.status(400).json({ message: 'Hours requested is required for cut pay by hours' });
      return;
    }

    if (payType === 'MILES' && (!milesRequested || parseFloat(milesRequested) <= 0)) {
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
        hoursRequested: payType === 'HOURS' ? new Prisma.Decimal(hoursRequested) : null,
        milesRequested: payType === 'MILES' ? new Prisma.Decimal(milesRequested) : null,
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
