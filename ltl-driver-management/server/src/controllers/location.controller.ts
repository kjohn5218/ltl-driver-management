import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

export const getLocations = async (req: Request, res: Response) => {
  try {
    const { search, active, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter
    const where: Prisma.LocationWhereInput = {};
    
    // Add active filter
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    // Add search filter if provided
    if (search) {
      const searchTerm = search as string;
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { state: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.location.count({ where });

    // Get locations with pagination
    const locations = await prisma.location.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { code: 'asc' }
    });

    return res.json({
      locations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get locations error:', error);
    return res.status(500).json({ message: 'Failed to fetch locations' });
  }
};

export const getLocationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const location = await prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    return res.json(location);
  } catch (error) {
    console.error('Get location by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch location' });
  }
};

export const getLocationByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    const location = await prisma.location.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    return res.json(location);
  } catch (error) {
    console.error('Get location by code error:', error);
    return res.status(500).json({ message: 'Failed to fetch location' });
  }
};

export const searchLocations = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }

    const searchTerm = q.trim();
    if (searchTerm.length < 2) {
      return res.json([]);
    }

    const locations = await prisma.location.findMany({
      where: {
        active: true,
        OR: [
          { code: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { state: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: 10,
      orderBy: [
        { code: 'asc' },
        { name: 'asc' }
      ]
    });

    return res.json(locations);
  } catch (error) {
    console.error('Search locations error:', error);
    return res.status(500).json({ message: 'Failed to search locations' });
  }
};

export const createLocation = async (req: Request, res: Response) => {
  try {
    const locationData = req.body;

    // Check if location code already exists
    const existingLocation = await prisma.location.findUnique({
      where: { code: locationData.code }
    });

    if (existingLocation) {
      return res.status(400).json({ message: 'Location code already exists' });
    }

    const location = await prisma.location.create({
      data: {
        code: locationData.code.toUpperCase(),
        name: locationData.name || undefined,
        address: locationData.address || undefined,
        city: locationData.city || undefined,
        state: locationData.state || undefined,
        zipCode: locationData.zipCode || undefined,
        contact: locationData.contact || undefined,
        phone: locationData.phone || undefined,
        hours: locationData.hours || undefined,
        timeZone: locationData.timeZone || undefined,
        latitude: locationData.latitude ? parseFloat(locationData.latitude) : undefined,
        longitude: locationData.longitude ? parseFloat(locationData.longitude) : undefined,
        notes: locationData.notes || undefined,
        active: locationData.active !== undefined ? locationData.active : true
      }
    });

    return res.status(201).json(location);
  } catch (error) {
    console.error('Create location error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Location code already exists' });
      }
    }
    return res.status(500).json({ message: 'Failed to create location' });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingLocation) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if location code is being changed and already exists
    if (updateData.code && updateData.code !== existingLocation.code) {
      const codeExists = await prisma.location.findUnique({
        where: { code: updateData.code.toUpperCase() }
      });

      if (codeExists) {
        return res.status(400).json({ message: 'Location code already exists' });
      }
    }

    const location = await prisma.location.update({
      where: { id: parseInt(id) },
      data: {
        code: updateData.code ? updateData.code.toUpperCase() : undefined,
        name: updateData.name || undefined,
        address: updateData.address || undefined,
        city: updateData.city || undefined,
        state: updateData.state || undefined,
        zipCode: updateData.zipCode || undefined,
        contact: updateData.contact || undefined,
        phone: updateData.phone || undefined,
        hours: updateData.hours || undefined,
        timeZone: updateData.timeZone || undefined,
        latitude: updateData.latitude ? parseFloat(updateData.latitude) : undefined,
        longitude: updateData.longitude ? parseFloat(updateData.longitude) : undefined,
        notes: updateData.notes || undefined,
        active: updateData.active
      }
    });

    return res.json(location);
  } catch (error) {
    console.error('Update location error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Location code already exists' });
      }
    }
    return res.status(500).json({ message: 'Failed to update location' });
  }
};

export const deleteLocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if location exists
    const existingLocation = await prisma.location.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingLocation) {
      return res.status(404).json({ message: 'Location not found' });
    }

    await prisma.location.delete({
      where: { id: parseInt(id) }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete location error:', error);
    return res.status(500).json({ message: 'Failed to delete location' });
  }
};