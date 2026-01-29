import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all drivers with filtering
export const getDrivers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { active, carrierId, search, page = 1, limit = 20 } = req.query;
    console.log('getDrivers called with params:', { active, carrierId, search, page, limit });
    
    // Build where clause
    const where: any = {};
    
    if (active !== undefined) {
      where.active = active === 'true';
    }
    
    if (carrierId) {
      where.carrierId = parseInt(carrierId as string);
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phoneNumber: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { licenseNumber: { contains: search as string, mode: 'insensitive' } },
        { number: { contains: search as string, mode: 'insensitive' } },
        { carrier: { name: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    // Calculate pagination with validation
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Get drivers with carrier and location information
    const [drivers, total] = await Promise.all([
      prisma.carrierDriver.findMany({
        where,
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          location: {
            select: {
              id: true,
              code: true,
              name: true,
              city: true,
              state: true
            }
          }
        },
        orderBy: [
          { carrier: { name: 'asc' } },
          { name: 'asc' }
        ],
        skip,
        take
      }),
      prisma.carrierDriver.count({ where })
    ]);

    return res.json({
      drivers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

// Get active drivers by carrier
export const getActiveDriversByCarrier = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { carrierId } = req.params;

    const drivers = await prisma.carrierDriver.findMany({
      where: {
        carrierId: parseInt(carrierId),
        active: true
      },
      orderBy: { name: 'asc' }
    });

    return res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers by carrier:', error);
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
};

// Get driver by ID
export const getDriverById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const driver = await prisma.carrierDriver.findUnique({
      where: { id: parseInt(id) },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    return res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    return res.status(500).json({ error: 'Failed to fetch driver' });
  }
};

// Create new driver
export const createDriver = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { carrierId, name, phoneNumber, email, licenseNumber, number, locationId, hazmatEndorsement } = req.body;

    // Verify carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId }
    });

    if (!carrier) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    // Verify location exists if provided
    if (locationId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId }
      });

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
    }

    // Create driver with extended properties
    const driver = await prisma.carrierDriver.create({
      data: {
        carrierId,
        name,
        number,
        phoneNumber,
        email,
        licenseNumber,
        hazmatEndorsement: hazmatEndorsement ?? false,
        locationId: locationId || null
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    return res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    return res.status(500).json({ error: 'Failed to create driver' });
  }
};

// Update driver
export const updateDriver = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, email, licenseNumber, active, carrierId, number, locationId, hazmatEndorsement } = req.body;

    // Verify driver exists
    const existingDriver = await prisma.carrierDriver.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingDriver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // If changing carrier, verify new carrier exists
    if (carrierId && carrierId !== existingDriver.carrierId) {
      const carrier = await prisma.carrier.findUnique({
        where: { id: carrierId }
      });

      if (!carrier) {
        return res.status(404).json({ error: 'New carrier not found' });
      }
    }

    // If changing location, verify new location exists
    if (locationId !== undefined && locationId !== null && locationId !== existingDriver.locationId) {
      const location = await prisma.location.findUnique({
        where: { id: locationId }
      });

      if (!location) {
        return res.status(404).json({ error: 'Location not found' });
      }
    }

    // Update driver
    const driver = await prisma.carrierDriver.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        ...(email !== undefined && { email }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(active !== undefined && { active }),
        ...(carrierId !== undefined && { carrierId }),
        ...(number !== undefined && { number }),
        ...(locationId !== undefined && { locationId: locationId || null }),
        ...(hazmatEndorsement !== undefined && { hazmatEndorsement })
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        location: {
          select: {
            id: true,
            code: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    return res.json(driver);
  } catch (error) {
    console.error('Error updating driver:', error);
    return res.status(500).json({ error: 'Failed to update driver' });
  }
};

// Delete driver (soft delete by marking inactive)
export const deleteDriver = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Verify driver exists
    const driver = await prisma.carrierDriver.findUnique({
      where: { id: parseInt(id) }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Soft delete by marking as inactive
    await prisma.carrierDriver.update({
      where: { id: parseInt(id) },
      data: { active: false }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting driver:', error);
    return res.status(500).json({ error: 'Failed to delete driver' });
  }
};