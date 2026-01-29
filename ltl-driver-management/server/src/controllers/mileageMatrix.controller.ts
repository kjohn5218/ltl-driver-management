import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

// Get all mileage matrix entries with pagination and filtering
export const getMileageEntries = async (req: Request, res: Response) => {
  try {
    const { search, active, originCode, destinationCode, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Build filter
    const where: Prisma.MileageMatrixWhereInput = {};

    // Add active filter
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Add origin/destination code filters
    if (originCode) {
      where.originCode = { contains: originCode as string, mode: 'insensitive' };
    }

    if (destinationCode) {
      where.destinationCode = { contains: destinationCode as string, mode: 'insensitive' };
    }

    // Add search filter if provided (searches both origin and destination)
    if (search) {
      const searchTerm = search as string;
      where.OR = [
        { originCode: { contains: searchTerm, mode: 'insensitive' } },
        { destinationCode: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.mileageMatrix.count({ where });

    // Get entries with pagination
    const entries = await prisma.mileageMatrix.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: [
        { originCode: 'asc' },
        { destinationCode: 'asc' }
      ]
    });

    return res.json({
      entries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get mileage entries error:', error);
    return res.status(500).json({ message: 'Failed to fetch mileage entries' });
  }
};

// Lookup mileage for a specific origin-destination pair
export const lookupMileage = async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }

    const originCode = (origin as string).toUpperCase();
    const destinationCode = (destination as string).toUpperCase();

    // Try exact match first
    let entry = await prisma.mileageMatrix.findUnique({
      where: {
        originCode_destinationCode: {
          originCode,
          destinationCode
        }
      }
    });

    // If not found, try reverse direction (bidirectional fallback)
    if (!entry) {
      entry = await prisma.mileageMatrix.findUnique({
        where: {
          originCode_destinationCode: {
            originCode: destinationCode,
            destinationCode: originCode
          }
        }
      });
    }

    if (!entry || !entry.active) {
      return res.status(404).json({
        message: 'Mileage not found for this route',
        miles: null,
        originCode,
        destinationCode
      });
    }

    return res.json({
      miles: entry.miles,
      originCode,
      destinationCode,
      source: 'matrix'
    });
  } catch (error) {
    console.error('Lookup mileage error:', error);
    return res.status(500).json({ message: 'Failed to lookup mileage' });
  }
};

// Get single mileage entry by ID
export const getMileageById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const entry = await prisma.mileageMatrix.findUnique({
      where: { id: parseInt(id) }
    });

    if (!entry) {
      return res.status(404).json({ message: 'Mileage entry not found' });
    }

    return res.json(entry);
  } catch (error) {
    console.error('Get mileage by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch mileage entry' });
  }
};

// Create a new mileage entry
export const createMileageEntry = async (req: Request, res: Response) => {
  try {
    const { originCode, destinationCode, miles, notes } = req.body;

    // Normalize codes to uppercase
    const normalizedOrigin = originCode.toUpperCase();
    const normalizedDestination = destinationCode.toUpperCase();

    // Check if entry already exists
    const existingEntry = await prisma.mileageMatrix.findUnique({
      where: {
        originCode_destinationCode: {
          originCode: normalizedOrigin,
          destinationCode: normalizedDestination
        }
      }
    });

    if (existingEntry) {
      return res.status(400).json({
        message: `Mileage entry for ${normalizedOrigin} to ${normalizedDestination} already exists`
      });
    }

    const entry = await prisma.mileageMatrix.create({
      data: {
        originCode: normalizedOrigin,
        destinationCode: normalizedDestination,
        miles: parseFloat(miles),
        notes: notes || undefined,
        active: true
      }
    });

    return res.status(201).json(entry);
  } catch (error) {
    console.error('Create mileage entry error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Mileage entry for this route already exists' });
      }
    }
    return res.status(500).json({ message: 'Failed to create mileage entry' });
  }
};

// Bulk create or update mileage entries
export const bulkCreateOrUpdate = async (req: Request, res: Response) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'Entries array is required' });
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      const { originCode, destinationCode, miles, notes } = entry;

      if (!originCode || !destinationCode || miles === undefined) {
        errors.push(`Invalid entry: missing required fields for ${originCode || 'unknown'} - ${destinationCode || 'unknown'}`);
        continue;
      }

      const normalizedOrigin = originCode.toUpperCase();
      const normalizedDestination = destinationCode.toUpperCase();

      try {
        const result = await prisma.mileageMatrix.upsert({
          where: {
            originCode_destinationCode: {
              originCode: normalizedOrigin,
              destinationCode: normalizedDestination
            }
          },
          update: {
            miles: parseFloat(miles),
            notes: notes || undefined,
            active: true
          },
          create: {
            originCode: normalizedOrigin,
            destinationCode: normalizedDestination,
            miles: parseFloat(miles),
            notes: notes || undefined,
            active: true
          }
        });

        // Check if it was created or updated by comparing dates
        const timeDiff = result.updatedAt.getTime() - result.createdAt.getTime();
        if (timeDiff < 1000) { // Created within the last second
          created++;
        } else {
          updated++;
        }
      } catch (entryError) {
        errors.push(`Failed to process ${normalizedOrigin} - ${normalizedDestination}`);
      }
    }

    return res.json({
      message: 'Bulk operation completed',
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk create/update mileage error:', error);
    return res.status(500).json({ message: 'Failed to process bulk mileage entries' });
  }
};

// Update a mileage entry
export const updateMileageEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { originCode, destinationCode, miles, notes, active } = req.body;

    // Check if entry exists
    const existingEntry = await prisma.mileageMatrix.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ message: 'Mileage entry not found' });
    }

    // If changing codes, check for duplicates
    if (originCode || destinationCode) {
      const newOrigin = originCode ? originCode.toUpperCase() : existingEntry.originCode;
      const newDestination = destinationCode ? destinationCode.toUpperCase() : existingEntry.destinationCode;

      if (newOrigin !== existingEntry.originCode || newDestination !== existingEntry.destinationCode) {
        const duplicate = await prisma.mileageMatrix.findUnique({
          where: {
            originCode_destinationCode: {
              originCode: newOrigin,
              destinationCode: newDestination
            }
          }
        });

        if (duplicate && duplicate.id !== parseInt(id)) {
          return res.status(400).json({
            message: `Mileage entry for ${newOrigin} to ${newDestination} already exists`
          });
        }
      }
    }

    const entry = await prisma.mileageMatrix.update({
      where: { id: parseInt(id) },
      data: {
        originCode: originCode ? originCode.toUpperCase() : undefined,
        destinationCode: destinationCode ? destinationCode.toUpperCase() : undefined,
        miles: miles !== undefined ? parseFloat(miles) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        active: active !== undefined ? active : undefined
      }
    });

    return res.json(entry);
  } catch (error) {
    console.error('Update mileage entry error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Mileage entry for this route already exists' });
      }
    }
    return res.status(500).json({ message: 'Failed to update mileage entry' });
  }
};

// Delete a mileage entry
export const deleteMileageEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if entry exists
    const existingEntry = await prisma.mileageMatrix.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingEntry) {
      return res.status(404).json({ message: 'Mileage entry not found' });
    }

    await prisma.mileageMatrix.delete({
      where: { id: parseInt(id) }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete mileage entry error:', error);
    return res.status(500).json({ message: 'Failed to delete mileage entry' });
  }
};

// Get all unique terminal codes from mileage matrix
export const getTerminalCodes = async (_req: Request, res: Response) => {
  try {
    const origins = await prisma.mileageMatrix.findMany({
      where: { active: true },
      select: { originCode: true },
      distinct: ['originCode']
    });

    const destinations = await prisma.mileageMatrix.findMany({
      where: { active: true },
      select: { destinationCode: true },
      distinct: ['destinationCode']
    });

    // Combine and deduplicate
    const allCodes = new Set([
      ...origins.map(o => o.originCode),
      ...destinations.map(d => d.destinationCode)
    ]);

    return res.json(Array.from(allCodes).sort());
  } catch (error) {
    console.error('Get terminal codes error:', error);
    return res.status(500).json({ message: 'Failed to fetch terminal codes' });
  }
};
