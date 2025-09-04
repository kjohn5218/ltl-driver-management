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
        ...routeData,
        distance: routeData.distance ? parseFloat(routeData.distance) : undefined,
        miles: routeData.miles ? parseFloat(routeData.miles) : undefined,
        standardRate: routeData.standardRate ? parseFloat(routeData.standardRate) : undefined,
        active: routeData.active !== undefined ? routeData.active : true,
        departureTime: routeData.departureTime || undefined,
        arrivalTime: routeData.arrivalTime || undefined
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
        ...updateData,
        distance: updateData.distance ? parseFloat(updateData.distance) : undefined,
        miles: updateData.miles ? parseFloat(updateData.miles) : undefined,
        standardRate: updateData.standardRate ? parseFloat(updateData.standardRate) : undefined
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