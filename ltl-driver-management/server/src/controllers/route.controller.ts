import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

export const getRoutes = async (req: Request, res: Response) => {
  try {
    const { origin, destination, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter
    const where: Prisma.RouteWhereInput = {};
    if (origin) where.origin = { contains: origin as string, mode: 'insensitive' };
    if (destination) where.destination = { contains: destination as string, mode: 'insensitive' };

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

    // Parse time strings if provided
    const departureTime = routeData.departureTime 
      ? new Date(`1970-01-01T${routeData.departureTime}:00`)
      : undefined;
    const arrivalTime = routeData.arrivalTime 
      ? new Date(`1970-01-01T${routeData.arrivalTime}:00`)
      : undefined;

    const route = await prisma.route.create({
      data: {
        ...routeData,
        distance: parseInt(routeData.distance),
        standardRate: parseFloat(routeData.standardRate),
        departureTime,
        arrivalTime
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

    // Parse time strings if provided
    if (updateData.departureTime) {
      updateData.departureTime = new Date(`1970-01-01T${updateData.departureTime}:00`);
    }
    if (updateData.arrivalTime) {
      updateData.arrivalTime = new Date(`1970-01-01T${updateData.arrivalTime}:00`);
    }

    const route = await prisma.route.update({
      where: { id: parseInt(id) },
      data: {
        ...updateData,
        distance: updateData.distance ? parseInt(updateData.distance) : undefined,
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