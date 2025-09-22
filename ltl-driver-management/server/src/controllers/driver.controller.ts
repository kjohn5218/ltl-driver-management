import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all drivers with filtering
export const getDrivers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { active, carrierId, search, page = 1, limit = 20 } = req.query;
    
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
        { licenseNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    // Get drivers with carrier information
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
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
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
    const { carrierId, name, phoneNumber, email, licenseNumber, number } = req.body;

    // Verify carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId }
    });

    if (!carrier) {
      return res.status(404).json({ error: 'Carrier not found' });
    }

    // Create driver with extended properties
    const driver = await prisma.carrierDriver.create({
      data: {
        carrierId,
        name,
        number,
        phoneNumber,
        email,
        licenseNumber
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
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
    const { name, phoneNumber, email, licenseNumber, active, carrierId, number } = req.body;

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
        ...(number !== undefined && { number })
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            status: true
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