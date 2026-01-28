import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

export const getRoutes = async (req: Request, res: Response) => {
  try {
    const { origin, destination, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter - always include active routes by default
    const where: Prisma.RouteWhereInput = {
      active: true
    };
    
    // Build conditions array for combining filters
    const conditions: Prisma.RouteWhereInput[] = [];
    
    // Add search filter if provided
    if (search) {
      const searchTerm = search as string;
      conditions.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { origin: { contains: searchTerm, mode: 'insensitive' } },
          { destination: { contains: searchTerm, mode: 'insensitive' } }
        ]
      });
    }
    
    // Add origin filter if provided
    if (origin) {
      conditions.push({
        origin: { contains: origin as string, mode: 'insensitive' }
      });
    }
    
    // Add destination filter if provided
    if (destination) {
      conditions.push({
        destination: { contains: destination as string, mode: 'insensitive' }
      });
    }
    
    // Combine all conditions with AND logic
    if (conditions.length > 0) {
      where.AND = conditions;
    }

    // Get total count
    const total = await prisma.route.count({ where });

    // Get routes with pagination
    const routes = await prisma.route.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { name: 'asc' },
      include: {
        interlineCarrier: {
          select: { id: true, code: true, name: true }
        },
        _count: {
          select: {
            bookings: true,
            preferredBy: true
          }
        }
      }
    });

    return res.json({
      routes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get routes error:', error);
    return res.status(500).json({ message: 'Failed to fetch routes' });
  }
};

export const getRouteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const route = await prisma.route.findUnique({
      where: { id: parseInt(id) },
      include: {
        bookings: {
          include: {
            carrier: true
          },
          orderBy: { bookingDate: 'desc' },
          take: 10
        },
        preferredBy: {
          include: {
            carrier: true
          }
        }
      }
    });

    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    return res.json(route);
  } catch (error) {
    console.error('Get route by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch route' });
  }
};

export const getRouteCarriers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get carriers who prefer this route
    const preferredCarriers = await prisma.carrierPreferredRoute.findMany({
      where: { routeId: parseInt(id) },
      include: {
        carrier: true
      }
    });

    // Get carriers who have completed bookings on this route
    const experiencedCarriers = await prisma.booking.findMany({
      where: {
        routeId: parseInt(id),
        status: 'COMPLETED'
      },
      select: {
        carrier: true
      },
      distinct: ['carrierId']
    });

    return res.json({
      preferred: preferredCarriers.map(pc => pc.carrier),
      experienced: experiencedCarriers.map(ec => ec.carrier)
    });
  } catch (error) {
    console.error('Get route carriers error:', error);
    return res.status(500).json({ message: 'Failed to fetch route carriers' });
  }
};

export const createRoute = async (req: Request, res: Response) => {
  try {
    const routeData = req.body;

    const route = await prisma.route.create({
      data: {
        name: routeData.name,
        origin: routeData.origin,
        destination: routeData.destination,
        originAddress: routeData.originAddress || undefined,
        originCity: routeData.originCity || undefined,
        originState: routeData.originState || undefined,
        originZipCode: routeData.originZipCode || undefined,
        originContact: routeData.originContact || undefined,
        originTimeZone: routeData.originTimeZone || undefined,
        originLatitude: routeData.originLatitude ? parseFloat(routeData.originLatitude) : undefined,
        originLongitude: routeData.originLongitude ? parseFloat(routeData.originLongitude) : undefined,
        destinationAddress: routeData.destinationAddress || undefined,
        destinationCity: routeData.destinationCity || undefined,
        destinationState: routeData.destinationState || undefined,
        destinationZipCode: routeData.destinationZipCode || undefined,
        destinationContact: routeData.destinationContact || undefined,
        destinationTimeZone: routeData.destinationTimeZone || undefined,
        destinationLatitude: routeData.destinationLatitude ? parseFloat(routeData.destinationLatitude) : undefined,
        destinationLongitude: routeData.destinationLongitude ? parseFloat(routeData.destinationLongitude) : undefined,
        distance: parseFloat(routeData.distance),
        runTime: routeData.runTime ? parseInt(routeData.runTime) : undefined,
        standardRate: routeData.standardRate && routeData.standardRate !== '' ? parseFloat(routeData.standardRate) : undefined,
        active: routeData.active !== undefined ? routeData.active : true,
        frequency: routeData.frequency || undefined,
        departureTime: routeData.departureTime || undefined,
        arrivalTime: routeData.arrivalTime || undefined,
        headhaul: routeData.headhaul !== undefined ? routeData.headhaul : false,
        interlineTrailer: routeData.interlineTrailer !== undefined ? routeData.interlineTrailer : false,
        interlineCarrierId: routeData.interlineCarrierId ? parseInt(routeData.interlineCarrierId) : null
      },
      include: {
        interlineCarrier: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    return res.status(201).json(route);
  } catch (error) {
    console.error('Create route error:', error);
    return res.status(500).json({ message: 'Failed to create route' });
  }
};

export const updateRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const route = await prisma.route.update({
      where: { id: parseInt(id) },
      data: {
        name: updateData.name,
        origin: updateData.origin,
        destination: updateData.destination,
        originAddress: updateData.originAddress || undefined,
        originCity: updateData.originCity || undefined,
        originState: updateData.originState || undefined,
        originZipCode: updateData.originZipCode || undefined,
        originContact: updateData.originContact || undefined,
        originTimeZone: updateData.originTimeZone || undefined,
        originLatitude: updateData.originLatitude ? parseFloat(updateData.originLatitude) : undefined,
        originLongitude: updateData.originLongitude ? parseFloat(updateData.originLongitude) : undefined,
        destinationAddress: updateData.destinationAddress || undefined,
        destinationCity: updateData.destinationCity || undefined,
        destinationState: updateData.destinationState || undefined,
        destinationZipCode: updateData.destinationZipCode || undefined,
        destinationContact: updateData.destinationContact || undefined,
        destinationTimeZone: updateData.destinationTimeZone || undefined,
        destinationLatitude: updateData.destinationLatitude ? parseFloat(updateData.destinationLatitude) : undefined,
        destinationLongitude: updateData.destinationLongitude ? parseFloat(updateData.destinationLongitude) : undefined,
        distance: parseFloat(updateData.distance),
        runTime: updateData.runTime ? parseInt(updateData.runTime) : undefined,
        standardRate: updateData.standardRate && updateData.standardRate !== '' ? parseFloat(updateData.standardRate) : undefined,
        active: updateData.active,
        frequency: updateData.frequency || undefined,
        departureTime: updateData.departureTime || undefined,
        arrivalTime: updateData.arrivalTime || undefined,
        ...(updateData.headhaul !== undefined && { headhaul: updateData.headhaul }),
        ...(updateData.interlineTrailer !== undefined && { interlineTrailer: updateData.interlineTrailer }),
        ...(updateData.interlineCarrierId !== undefined && { interlineCarrierId: updateData.interlineCarrierId ? parseInt(updateData.interlineCarrierId) : null })
      },
      include: {
        interlineCarrier: {
          select: { id: true, code: true, name: true }
        }
      }
    });

    return res.json(route);
  } catch (error) {
    console.error('Update route error:', error);
    return res.status(500).json({ message: 'Failed to update route' });
  }
};

export const deleteRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.route.delete({
      where: { id: parseInt(id) }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete route error:', error);
    return res.status(500).json({ message: 'Failed to delete route' });
  }
};

// Get all legs for a multi-leg route by name
export const getRouteLegs = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;

    const legs = await prisma.route.findMany({
      where: {
        name: name,
        active: true
      },
      orderBy: { legOrder: 'asc' },
      select: {
        id: true,
        name: true,
        origin: true,
        destination: true,
        legOrder: true,
        dayOffset: true,
        isMultiLeg: true,
        departureTime: true,
        arrivalTime: true,
        distance: true,
        runTime: true
      }
    });

    if (legs.length === 0) {
      return res.status(404).json({ message: 'Route not found' });
    }

    return res.json({
      routeName: name,
      isMultiLeg: legs[0].isMultiLeg,
      totalLegs: legs.length,
      legs
    });
  } catch (error) {
    console.error('Get route legs error:', error);
    return res.status(500).json({ message: 'Failed to fetch route legs' });
  }
};

// Get the specific leg for a route given origin terminal
export const getRouteLegByOrigin = async (req: Request, res: Response) => {
  try {
    const { name, origin } = req.params;

    const leg = await prisma.route.findFirst({
      where: {
        name: name,
        origin: origin.toUpperCase(),
        active: true
      },
      select: {
        id: true,
        name: true,
        origin: true,
        destination: true,
        legOrder: true,
        dayOffset: true,
        isMultiLeg: true,
        departureTime: true,
        arrivalTime: true,
        distance: true,
        runTime: true
      }
    });

    if (!leg) {
      return res.status(404).json({ message: 'Route leg not found' });
    }

    return res.json(leg);
  } catch (error) {
    console.error('Get route leg by origin error:', error);
    return res.status(500).json({ message: 'Failed to fetch route leg' });
  }
};

// Check if a leg is eligible for dispatch (previous legs must be dispatched)
export const checkLegDispatchEligibility = async (req: Request, res: Response) => {
  try {
    const { routeName, originTerminalCode } = req.query;

    if (!routeName || !originTerminalCode) {
      return res.status(400).json({ message: 'routeName and originTerminalCode are required' });
    }

    // Get all legs for this route
    const allLegs = await prisma.route.findMany({
      where: {
        name: routeName as string,
        active: true
      },
      orderBy: { legOrder: 'asc' }
    });

    if (allLegs.length === 0) {
      return res.status(404).json({ message: 'Route not found' });
    }

    // Find the current leg
    const currentLeg = allLegs.find(
      leg => leg.origin.toUpperCase() === (originTerminalCode as string).toUpperCase()
    );

    if (!currentLeg) {
      return res.status(404).json({ message: 'Leg not found for given origin terminal' });
    }

    // If this is the first leg, it's always eligible
    if (currentLeg.legOrder === 1) {
      return res.json({
        eligible: true,
        currentLeg: {
          legOrder: currentLeg.legOrder,
          origin: currentLeg.origin,
          destination: currentLeg.destination
        },
        message: 'First leg - eligible for dispatch'
      });
    }

    // Check if previous legs have been dispatched
    // A leg is considered dispatched if there's a loadsheet with:
    // - Same linehaulName
    // - Origin matching that leg's origin
    // - Status is DISPATCHED or CLOSED
    const previousLegs = allLegs.filter(leg => leg.legOrder !== null && leg.legOrder < (currentLeg.legOrder || 0));

    const undispatchedPreviousLegs = [];

    for (const prevLeg of previousLegs) {
      const dispatchedLoadsheet = await prisma.loadsheet.findFirst({
        where: {
          linehaulName: routeName as string,
          originTerminalCode: prevLeg.origin,
          status: { in: ['DISPATCHED', 'CLOSED'] }
        }
      });

      if (!dispatchedLoadsheet) {
        undispatchedPreviousLegs.push({
          legOrder: prevLeg.legOrder,
          origin: prevLeg.origin,
          destination: prevLeg.destination
        });
      }
    }

    if (undispatchedPreviousLegs.length > 0) {
      return res.json({
        eligible: false,
        currentLeg: {
          legOrder: currentLeg.legOrder,
          origin: currentLeg.origin,
          destination: currentLeg.destination
        },
        undispatchedPreviousLegs,
        message: `Cannot dispatch leg ${currentLeg.legOrder}. Previous legs must be dispatched first.`
      });
    }

    return res.json({
      eligible: true,
      currentLeg: {
        legOrder: currentLeg.legOrder,
        origin: currentLeg.origin,
        destination: currentLeg.destination
      },
      message: 'All previous legs dispatched - eligible for dispatch'
    });
  } catch (error) {
    console.error('Check leg dispatch eligibility error:', error);
    return res.status(500).json({ message: 'Failed to check dispatch eligibility' });
  }
};

// Get available loadsheets for dispatch (filters out ineligible multi-leg loadsheets)
export const getDispatchableLoadsheets = async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.query;

    // Get all loadsheets that are ready for dispatch
    const loadsheets = await prisma.loadsheet.findMany({
      where: {
        status: { in: ['DRAFT', 'CLOSED'] }, // Ready to dispatch
        linehaulTripId: null // Not yet assigned to a trip
      },
      take: parseInt(limit as string),
      orderBy: { loadDate: 'desc' },
      include: {
        originTerminal: true,
        route: true
      }
    });

    // Check eligibility for each loadsheet
    const eligibleLoadsheets = [];
    const ineligibleLoadsheets = [];

    for (const loadsheet of loadsheets) {
      // Get the route for this loadsheet
      const route = await prisma.route.findFirst({
        where: {
          name: loadsheet.linehaulName,
          origin: loadsheet.originTerminalCode || '',
          active: true
        }
      });

      // If not a multi-leg route or is first leg, it's eligible
      if (!route?.isMultiLeg || route.legOrder === 1) {
        eligibleLoadsheets.push({
          ...loadsheet,
          legOrder: route?.legOrder || 1,
          isMultiLeg: route?.isMultiLeg || false,
          dispatchEligible: true,
          destination: route?.destination || null
        });
        continue;
      }

      // For multi-leg routes, check if previous legs are dispatched
      const allLegs = await prisma.route.findMany({
        where: { name: loadsheet.linehaulName, active: true },
        orderBy: { legOrder: 'asc' }
      });

      const previousLegs = allLegs.filter(
        leg => leg.legOrder !== null && leg.legOrder < (route.legOrder || 0)
      );

      let allPreviousDispatched = true;
      for (const prevLeg of previousLegs) {
        const dispatched = await prisma.loadsheet.findFirst({
          where: {
            linehaulName: loadsheet.linehaulName,
            originTerminalCode: prevLeg.origin,
            status: { in: ['DISPATCHED', 'CLOSED'] }
          }
        });
        if (!dispatched) {
          allPreviousDispatched = false;
          break;
        }
      }

      if (allPreviousDispatched) {
        eligibleLoadsheets.push({
          ...loadsheet,
          legOrder: route.legOrder,
          isMultiLeg: true,
          dispatchEligible: true,
          destination: route.destination
        });
      } else {
        ineligibleLoadsheets.push({
          ...loadsheet,
          legOrder: route.legOrder,
          isMultiLeg: true,
          dispatchEligible: false,
          destination: route.destination,
          reason: 'Previous legs not yet dispatched'
        });
      }
    }

    return res.json({
      eligible: eligibleLoadsheets,
      ineligible: ineligibleLoadsheets,
      total: loadsheets.length,
      eligibleCount: eligibleLoadsheets.length,
      ineligibleCount: ineligibleLoadsheets.length
    });
  } catch (error) {
    console.error('Get dispatchable loadsheets error:', error);
    return res.status(500).json({ message: 'Failed to fetch dispatchable loadsheets' });
  }
};