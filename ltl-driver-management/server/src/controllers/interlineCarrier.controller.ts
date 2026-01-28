import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

// Get all interline carriers with filtering
export const getInterlineCarriers = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      active,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.InterlineCarrierWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } },
        { scacCode: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [carriers, total] = await Promise.all([
      prisma.interlineCarrier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { linehaulProfiles: true }
          }
        }
      }),
      prisma.interlineCarrier.count({ where })
    ]);

    res.json({
      carriers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching interline carriers:', error);
    res.status(500).json({ message: 'Failed to fetch interline carriers' });
  }
};

// Get interline carrier by ID
export const getInterlineCarrierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const carrier = await prisma.interlineCarrier.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        linehaulProfiles: {
          select: {
            id: true,
            profileCode: true,
            name: true,
            active: true
          }
        },
        _count: {
          select: { linehaulProfiles: true }
        }
      }
    });

    if (!carrier) {
      res.status(404).json({ message: 'Interline carrier not found' });
      return;
    }

    res.json(carrier);
  } catch (error) {
    console.error('Error fetching interline carrier:', error);
    res.status(500).json({ message: 'Failed to fetch interline carrier' });
  }
};

// Create new interline carrier
export const createInterlineCarrier = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      scacCode,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      active
    } = req.body;

    // Check for duplicate code
    const existingCarrier = await prisma.interlineCarrier.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (existingCarrier) {
      res.status(400).json({ message: 'Carrier code already exists' });
      return;
    }

    // Check for duplicate SCAC code if provided
    if (scacCode) {
      const existingScac = await prisma.interlineCarrier.findUnique({
        where: { scacCode: scacCode.toUpperCase() }
      });

      if (existingScac) {
        res.status(400).json({ message: 'SCAC code already exists' });
        return;
      }
    }

    const carrier = await prisma.interlineCarrier.create({
      data: {
        code: code.toUpperCase(),
        name,
        scacCode: scacCode ? scacCode.toUpperCase() : null,
        contactName,
        contactPhone,
        contactEmail,
        notes,
        active: active !== undefined ? active : true
      }
    });

    res.status(201).json(carrier);
  } catch (error) {
    console.error('Error creating interline carrier:', error);
    res.status(500).json({ message: 'Failed to create interline carrier' });
  }
};

// Update interline carrier
export const updateInterlineCarrier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const carrierId = parseInt(id, 10);

    const existingCarrier = await prisma.interlineCarrier.findUnique({
      where: { id: carrierId }
    });

    if (!existingCarrier) {
      res.status(404).json({ message: 'Interline carrier not found' });
      return;
    }

    const {
      code,
      name,
      scacCode,
      contactName,
      contactPhone,
      contactEmail,
      notes,
      active
    } = req.body;

    // Check for code conflict
    if (code && code.toUpperCase() !== existingCarrier.code) {
      const codeConflict = await prisma.interlineCarrier.findUnique({
        where: { code: code.toUpperCase() }
      });
      if (codeConflict) {
        res.status(400).json({ message: 'Carrier code already exists' });
        return;
      }
    }

    // Check for SCAC code conflict
    if (scacCode && scacCode.toUpperCase() !== existingCarrier.scacCode) {
      const scacConflict = await prisma.interlineCarrier.findUnique({
        where: { scacCode: scacCode.toUpperCase() }
      });
      if (scacConflict) {
        res.status(400).json({ message: 'SCAC code already exists' });
        return;
      }
    }

    const carrier = await prisma.interlineCarrier.update({
      where: { id: carrierId },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(name && { name }),
        ...(scacCode !== undefined && { scacCode: scacCode ? scacCode.toUpperCase() : null }),
        ...(contactName !== undefined && { contactName }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active })
      }
    });

    res.json(carrier);
  } catch (error) {
    console.error('Error updating interline carrier:', error);
    res.status(500).json({ message: 'Failed to update interline carrier' });
  }
};

// Delete interline carrier
export const deleteInterlineCarrier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const carrierId = parseInt(id, 10);

    const carrier = await prisma.interlineCarrier.findUnique({
      where: { id: carrierId },
      include: {
        _count: {
          select: { linehaulProfiles: true }
        }
      }
    });

    if (!carrier) {
      res.status(404).json({ message: 'Interline carrier not found' });
      return;
    }

    if (carrier._count.linehaulProfiles > 0) {
      res.status(400).json({
        message: 'Cannot delete carrier with associated linehaul profiles. Consider deactivating instead.',
        profileCount: carrier._count.linehaulProfiles
      });
      return;
    }

    await prisma.interlineCarrier.delete({
      where: { id: carrierId }
    });

    res.json({ message: 'Interline carrier deleted successfully' });
  } catch (error) {
    console.error('Error deleting interline carrier:', error);
    res.status(500).json({ message: 'Failed to delete interline carrier' });
  }
};

// Get simple list of active carriers for dropdowns
export const getInterlineCarriersList = async (_req: Request, res: Response): Promise<void> => {
  try {
    const carriers = await prisma.interlineCarrier.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        scacCode: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(carriers);
  } catch (error) {
    console.error('Error fetching interline carriers list:', error);
    res.status(500).json({ message: 'Failed to fetch interline carriers list' });
  }
};

// Toggle carrier active status
export const toggleCarrierStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const carrierId = parseInt(id, 10);

    const carrier = await prisma.interlineCarrier.findUnique({
      where: { id: carrierId }
    });

    if (!carrier) {
      res.status(404).json({ message: 'Interline carrier not found' });
      return;
    }

    const updatedCarrier = await prisma.interlineCarrier.update({
      where: { id: carrierId },
      data: { active: !carrier.active }
    });

    res.json(updatedCarrier);
  } catch (error) {
    console.error('Error toggling carrier status:', error);
    res.status(500).json({ message: 'Failed to toggle carrier status' });
  }
};
