import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, RateCardType, RateMethod, AccessorialType } from '@prisma/client';

// ==================== RATE CARDS ====================

// Get all rate cards with filtering
export const getRateCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      type,
      active,
      driverId,
      carrierId,
      profileId,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.RateCardWhereInput = {};

    if (search) {
      where.notes = { contains: search as string, mode: 'insensitive' };
    }

    if (type) {
      where.rateType = type as RateCardType;
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    // EntityId is used for driver, carrier, or profile based on rateType
    if (driverId) {
      where.rateType = 'DRIVER';
      where.entityId = parseInt(driverId as string, 10);
    }

    if (carrierId) {
      where.rateType = 'CARRIER';
      where.entityId = parseInt(carrierId as string, 10);
    }

    if (profileId) {
      where.linehaulProfileId = parseInt(profileId as string, 10);
    }

    const [rateCards, total] = await Promise.all([
      prisma.rateCard.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ rateType: 'asc' }, { priority: 'asc' }],
        include: {
          originTerminal: {
            select: { id: true, code: true, name: true }
          },
          destinationTerminal: {
            select: { id: true, code: true, name: true }
          },
          linehaulProfile: {
            select: { id: true, profileCode: true, name: true }
          },
          _count: {
            select: { accessorialRates: true }
          }
        }
      }),
      prisma.rateCard.count({ where })
    ]);

    res.json({
      rateCards,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching rate cards:', error);
    res.status(500).json({ message: 'Failed to fetch rate cards' });
  }
};

// Get rate card by ID
export const getRateCardById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        },
        linehaulProfile: {
          include: {
            originTerminal: {
              select: { code: true, name: true }
            },
            destinationTerminal: {
              select: { code: true, name: true }
            }
          }
        },
        accessorialRates: {
          orderBy: { accessorialType: 'asc' }
        }
      }
    });

    if (!rateCard) {
      res.status(404).json({ message: 'Rate card not found' });
      return;
    }

    res.json(rateCard);
  } catch (error) {
    console.error('Error fetching rate card:', error);
    res.status(500).json({ message: 'Failed to fetch rate card' });
  }
};

// Create rate card
export const createRateCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      rateType,
      entityId,
      linehaulProfileId,
      originTerminalId,
      destinationTerminalId,
      rateMethod,
      rateAmount,
      minimumAmount,
      maximumAmount,
      effectiveDate,
      expirationDate,
      equipmentType,
      priority,
      notes,
      active
    } = req.body;

    // Validate type-specific requirements
    if (rateType === 'DRIVER' && !entityId) {
      res.status(400).json({ message: 'Entity ID (driver) required for DRIVER rate card type' });
      return;
    }
    if (rateType === 'CARRIER' && !entityId) {
      res.status(400).json({ message: 'Entity ID (carrier) required for CARRIER rate card type' });
      return;
    }
    if (rateType === 'LINEHAUL' && !linehaulProfileId) {
      res.status(400).json({ message: 'Linehaul Profile ID required for LINEHAUL rate card type' });
      return;
    }
    if (rateType === 'OD_PAIR' && (!originTerminalId || !destinationTerminalId)) {
      res.status(400).json({ message: 'Origin and Destination terminal IDs required for OD_PAIR rate card type' });
      return;
    }

    const rateCard = await prisma.rateCard.create({
      data: {
        rateType: rateType as RateCardType,
        entityId: entityId ? parseInt(entityId, 10) : null,
        linehaulProfileId: linehaulProfileId ? parseInt(linehaulProfileId, 10) : null,
        originTerminalId: originTerminalId ? parseInt(originTerminalId, 10) : null,
        destinationTerminalId: destinationTerminalId ? parseInt(destinationTerminalId, 10) : null,
        rateMethod: rateMethod as RateMethod,
        rateAmount: new Prisma.Decimal(rateAmount),
        minimumAmount: minimumAmount ? new Prisma.Decimal(minimumAmount) : null,
        maximumAmount: maximumAmount ? new Prisma.Decimal(maximumAmount) : null,
        effectiveDate: new Date(effectiveDate),
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        equipmentType,
        priority: priority || 5,
        notes,
        active: active !== undefined ? active : true
      },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        },
        linehaulProfile: {
          select: { id: true, profileCode: true, name: true }
        }
      }
    });

    res.status(201).json(rateCard);
  } catch (error) {
    console.error('Error creating rate card:', error);
    res.status(500).json({ message: 'Failed to create rate card' });
  }
};

// Update rate card
export const updateRateCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rateCardId = parseInt(id, 10);

    const existingRateCard = await prisma.rateCard.findUnique({
      where: { id: rateCardId }
    });

    if (!existingRateCard) {
      res.status(404).json({ message: 'Rate card not found' });
      return;
    }

    const {
      rateMethod,
      rateAmount,
      minimumAmount,
      maximumAmount,
      effectiveDate,
      expirationDate,
      equipmentType,
      priority,
      notes,
      active
    } = req.body;

    const rateCard = await prisma.rateCard.update({
      where: { id: rateCardId },
      data: {
        ...(rateMethod && { rateMethod: rateMethod as RateMethod }),
        ...(rateAmount !== undefined && { rateAmount: new Prisma.Decimal(rateAmount) }),
        ...(minimumAmount !== undefined && { minimumAmount: minimumAmount ? new Prisma.Decimal(minimumAmount) : null }),
        ...(maximumAmount !== undefined && { maximumAmount: maximumAmount ? new Prisma.Decimal(maximumAmount) : null }),
        ...(effectiveDate && { effectiveDate: new Date(effectiveDate) }),
        ...(expirationDate !== undefined && { expirationDate: expirationDate ? new Date(expirationDate) : null }),
        ...(equipmentType !== undefined && { equipmentType }),
        ...(priority !== undefined && { priority }),
        ...(notes !== undefined && { notes }),
        ...(active !== undefined && { active })
      },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        destinationTerminal: {
          select: { id: true, code: true, name: true }
        },
        linehaulProfile: {
          select: { id: true, profileCode: true, name: true }
        }
      }
    });

    res.json(rateCard);
  } catch (error) {
    console.error('Error updating rate card:', error);
    res.status(500).json({ message: 'Failed to update rate card' });
  }
};

// Delete rate card
export const deleteRateCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rateCardId = parseInt(id, 10);

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: rateCardId }
    });

    if (!rateCard) {
      res.status(404).json({ message: 'Rate card not found' });
      return;
    }

    // Delete associated accessorial rates first
    await prisma.accessorialRate.deleteMany({
      where: { rateCardId }
    });

    await prisma.rateCard.delete({
      where: { id: rateCardId }
    });

    res.json({ message: 'Rate card deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate card:', error);
    res.status(500).json({ message: 'Failed to delete rate card' });
  }
};

// Get applicable rate for a trip/driver combination
export const getApplicableRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId, carrierId, profileId, originTerminalId, destinationTerminalId } = req.query;

    const today = new Date();

    // Rate hierarchy: Driver > Carrier > Linehaul > O/D Pair > Default
    let rateCard = null;

    // 1. Check for driver-specific rate
    if (driverId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'DRIVER',
          entityId: parseInt(driverId as string, 10),
          active: true,
          effectiveDate: { lte: today },
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: today } }
          ]
        },
        include: { accessorialRates: true },
        orderBy: { priority: 'asc' }
      });
    }

    // 2. Check for carrier-specific rate
    if (!rateCard && carrierId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'CARRIER',
          entityId: parseInt(carrierId as string, 10),
          active: true,
          effectiveDate: { lte: today },
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: today } }
          ]
        },
        include: { accessorialRates: true },
        orderBy: { priority: 'asc' }
      });
    }

    // 3. Check for linehaul profile rate
    if (!rateCard && profileId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'LINEHAUL',
          linehaulProfileId: parseInt(profileId as string, 10),
          active: true,
          effectiveDate: { lte: today },
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: today } }
          ]
        },
        include: { accessorialRates: true },
        orderBy: { priority: 'asc' }
      });
    }

    // 4. Check for O/D pair rate
    if (!rateCard && originTerminalId && destinationTerminalId) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'OD_PAIR',
          originTerminalId: parseInt(originTerminalId as string, 10),
          destinationTerminalId: parseInt(destinationTerminalId as string, 10),
          active: true,
          effectiveDate: { lte: today },
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: today } }
          ]
        },
        include: { accessorialRates: true },
        orderBy: { priority: 'asc' }
      });
    }

    // 5. Get default rate
    if (!rateCard) {
      rateCard = await prisma.rateCard.findFirst({
        where: {
          rateType: 'DEFAULT',
          active: true,
          effectiveDate: { lte: today },
          OR: [
            { expirationDate: null },
            { expirationDate: { gte: today } }
          ]
        },
        include: { accessorialRates: true },
        orderBy: { priority: 'asc' }
      });
    }

    if (!rateCard) {
      res.status(404).json({ message: 'No applicable rate card found' });
      return;
    }

    res.json(rateCard);
  } catch (error) {
    console.error('Error fetching applicable rate:', error);
    res.status(500).json({ message: 'Failed to fetch applicable rate' });
  }
};

// ==================== ACCESSORIAL RATES ====================

// Get accessorial rates for a rate card
export const getAccessorialRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;

    const rates = await prisma.accessorialRate.findMany({
      where: { rateCardId: parseInt(rateCardId, 10) },
      orderBy: { accessorialType: 'asc' }
    });

    res.json(rates);
  } catch (error) {
    console.error('Error fetching accessorial rates:', error);
    res.status(500).json({ message: 'Failed to fetch accessorial rates' });
  }
};

// Add accessorial rate to rate card
export const addAccessorialRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;
    const { type, description, rateAmount, rateMethod, minimumCharge, maximumCharge } = req.body;

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: parseInt(rateCardId, 10) }
    });

    if (!rateCard) {
      res.status(404).json({ message: 'Rate card not found' });
      return;
    }

    // Check for duplicate type
    const existingRate = await prisma.accessorialRate.findFirst({
      where: {
        rateCardId: parseInt(rateCardId, 10),
        accessorialType: type as AccessorialType
      }
    });

    if (existingRate) {
      res.status(400).json({ message: 'Accessorial rate type already exists for this rate card' });
      return;
    }

    const rate = await prisma.accessorialRate.create({
      data: {
        rateCardId: parseInt(rateCardId, 10),
        accessorialType: type as AccessorialType,
        description,
        rateAmount: new Prisma.Decimal(rateAmount),
        rateMethod: rateMethod as RateMethod || 'FLAT_RATE',
        minimumCharge: minimumCharge ? new Prisma.Decimal(minimumCharge) : null,
        maximumCharge: maximumCharge ? new Prisma.Decimal(maximumCharge) : null
      }
    });

    res.status(201).json(rate);
  } catch (error) {
    console.error('Error adding accessorial rate:', error);
    res.status(500).json({ message: 'Failed to add accessorial rate' });
  }
};

// Update accessorial rate
export const updateAccessorialRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId, rateId } = req.params;
    const { description, rateAmount, rateMethod, minimumCharge, maximumCharge } = req.body;

    const rate = await prisma.accessorialRate.findFirst({
      where: {
        id: parseInt(rateId, 10),
        rateCardId: parseInt(rateCardId, 10)
      }
    });

    if (!rate) {
      res.status(404).json({ message: 'Accessorial rate not found' });
      return;
    }

    const updatedRate = await prisma.accessorialRate.update({
      where: { id: parseInt(rateId, 10) },
      data: {
        ...(description !== undefined && { description }),
        ...(rateAmount !== undefined && { rateAmount: new Prisma.Decimal(rateAmount) }),
        ...(rateMethod !== undefined && { rateMethod: rateMethod as RateMethod }),
        ...(minimumCharge !== undefined && { minimumCharge: minimumCharge ? new Prisma.Decimal(minimumCharge) : null }),
        ...(maximumCharge !== undefined && { maximumCharge: maximumCharge ? new Prisma.Decimal(maximumCharge) : null })
      }
    });

    res.json(updatedRate);
  } catch (error) {
    console.error('Error updating accessorial rate:', error);
    res.status(500).json({ message: 'Failed to update accessorial rate' });
  }
};

// Delete accessorial rate
export const deleteAccessorialRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId, rateId } = req.params;

    const rate = await prisma.accessorialRate.findFirst({
      where: {
        id: parseInt(rateId, 10),
        rateCardId: parseInt(rateCardId, 10)
      }
    });

    if (!rate) {
      res.status(404).json({ message: 'Accessorial rate not found' });
      return;
    }

    await prisma.accessorialRate.delete({
      where: { id: parseInt(rateId, 10) }
    });

    res.json({ message: 'Accessorial rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting accessorial rate:', error);
    res.status(500).json({ message: 'Failed to delete accessorial rate' });
  }
};

// Bulk update accessorial rates
export const bulkUpdateAccessorialRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCardId } = req.params;
    const { rates } = req.body;

    const rateCard = await prisma.rateCard.findUnique({
      where: { id: parseInt(rateCardId, 10) }
    });

    if (!rateCard) {
      res.status(404).json({ message: 'Rate card not found' });
      return;
    }

    // Delete existing and create new in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.accessorialRate.deleteMany({
        where: { rateCardId: parseInt(rateCardId, 10) }
      });

      if (rates && rates.length > 0) {
        await tx.accessorialRate.createMany({
          data: rates.map((r: any) => ({
            rateCardId: parseInt(rateCardId, 10),
            accessorialType: r.type as AccessorialType,
            description: r.description,
            rateAmount: new Prisma.Decimal(r.rateAmount),
            rateMethod: (r.rateMethod as RateMethod) || 'FLAT_RATE',
            minimumCharge: r.minimumCharge ? new Prisma.Decimal(r.minimumCharge) : null,
            maximumCharge: r.maximumCharge ? new Prisma.Decimal(r.maximumCharge) : null
          }))
        });
      }
    });

    const updatedRates = await prisma.accessorialRate.findMany({
      where: { rateCardId: parseInt(rateCardId, 10) },
      orderBy: { accessorialType: 'asc' }
    });

    res.json(updatedRates);
  } catch (error) {
    console.error('Error bulk updating accessorial rates:', error);
    res.status(500).json({ message: 'Failed to update accessorial rates' });
  }
};

// ==================== IMPORT ====================

// Import rate cards from file upload (CSV/JSON)
export const importRateCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCards } = req.body;

    if (!Array.isArray(rateCards) || rateCards.length === 0) {
      res.status(400).json({ message: 'No rate cards provided for import' });
      return;
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { index: number; error: string }[]
    };

    for (let i = 0; i < rateCards.length; i++) {
      const rc = rateCards[i];
      try {
        // Check for existing rate card by externalRateId
        let existingCard = null;
        if (rc.externalRateId) {
          existingCard = await prisma.rateCard.findFirst({
            where: { externalRateId: rc.externalRateId }
          });
        }

        const data = {
          rateType: rc.rateType as RateCardType,
          entityId: rc.entityId ? parseInt(rc.entityId, 10) : null,
          linehaulProfileId: rc.linehaulProfileId ? parseInt(rc.linehaulProfileId, 10) : null,
          originTerminalId: rc.originTerminalId ? parseInt(rc.originTerminalId, 10) : null,
          destinationTerminalId: rc.destinationTerminalId ? parseInt(rc.destinationTerminalId, 10) : null,
          rateMethod: (rc.rateMethod as RateMethod) || 'PER_MILE',
          rateAmount: new Prisma.Decimal(rc.rateAmount),
          minimumAmount: rc.minimumAmount ? new Prisma.Decimal(rc.minimumAmount) : null,
          maximumAmount: rc.maximumAmount ? new Prisma.Decimal(rc.maximumAmount) : null,
          effectiveDate: new Date(rc.effectiveDate),
          expirationDate: rc.expirationDate ? new Date(rc.expirationDate) : null,
          equipmentType: rc.equipmentType || null,
          priority: rc.priority || 5,
          externalRateId: rc.externalRateId || null,
          notes: rc.notes || null,
          active: rc.active !== undefined ? rc.active : true
        };

        if (existingCard) {
          await prisma.rateCard.update({
            where: { id: existingCard.id },
            data
          });
          results.updated++;
        } else {
          const newCard = await prisma.rateCard.create({ data });

          // Create accessorial rates if provided
          if (rc.accessorialRates && Array.isArray(rc.accessorialRates)) {
            await prisma.accessorialRate.createMany({
              data: rc.accessorialRates.map((ar: any) => ({
                rateCardId: newCard.id,
                accessorialType: ar.type as AccessorialType,
                description: ar.description,
                rateAmount: new Prisma.Decimal(ar.rateAmount),
                rateMethod: (ar.rateMethod as RateMethod) || 'FLAT_RATE',
                minimumCharge: ar.minimumCharge ? new Prisma.Decimal(ar.minimumCharge) : null,
                maximumCharge: ar.maximumCharge ? new Prisma.Decimal(ar.maximumCharge) : null
              }))
            });
          }
          results.created++;
        }
      } catch (err: any) {
        results.errors.push({ index: i, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Import completed: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
      results
    });
  } catch (error) {
    console.error('Error importing rate cards:', error);
    res.status(500).json({ message: 'Failed to import rate cards' });
  }
};

// Import rate cards from external payroll system (API key authenticated)
export const importRateCardsExternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateCards, accessorialRates } = req.body;

    const results = {
      rateCardsCreated: 0,
      rateCardsUpdated: 0,
      accessorialsCreated: 0,
      accessorialsUpdated: 0,
      errors: [] as { type: string; id: string; error: string }[]
    };

    // Process rate cards
    if (Array.isArray(rateCards)) {
      for (const rc of rateCards) {
        try {
          // Upsert logic based on externalRateId
          if (!rc.externalRateId) {
            results.errors.push({ type: 'rateCard', id: 'unknown', error: 'externalRateId is required for external imports' });
            continue;
          }

          const existingCard = await prisma.rateCard.findFirst({
            where: { externalRateId: rc.externalRateId }
          });

          const data = {
            rateType: rc.rateType as RateCardType,
            entityId: rc.entityId ? parseInt(rc.entityId, 10) : null,
            linehaulProfileId: rc.linehaulProfileId ? parseInt(rc.linehaulProfileId, 10) : null,
            originTerminalId: rc.originTerminalId ? parseInt(rc.originTerminalId, 10) : null,
            destinationTerminalId: rc.destinationTerminalId ? parseInt(rc.destinationTerminalId, 10) : null,
            rateMethod: (rc.rateMethod as RateMethod) || 'PER_MILE',
            rateAmount: new Prisma.Decimal(rc.rateAmount),
            minimumAmount: rc.minimumAmount ? new Prisma.Decimal(rc.minimumAmount) : null,
            maximumAmount: rc.maximumAmount ? new Prisma.Decimal(rc.maximumAmount) : null,
            effectiveDate: new Date(rc.effectiveDate),
            expirationDate: rc.expirationDate ? new Date(rc.expirationDate) : null,
            equipmentType: rc.equipmentType || null,
            priority: rc.priority || 5,
            externalRateId: rc.externalRateId,
            notes: rc.notes || null,
            active: rc.active !== undefined ? rc.active : true
          };

          if (existingCard) {
            await prisma.rateCard.update({
              where: { id: existingCard.id },
              data
            });
            results.rateCardsUpdated++;
          } else {
            await prisma.rateCard.create({ data });
            results.rateCardsCreated++;
          }
        } catch (err: any) {
          results.errors.push({ type: 'rateCard', id: rc.externalRateId || 'unknown', error: err.message });
        }
      }
    }

    // Process accessorial rates
    if (Array.isArray(accessorialRates)) {
      for (const ar of accessorialRates) {
        try {
          if (!ar.externalRateCardId) {
            results.errors.push({ type: 'accessorial', id: 'unknown', error: 'externalRateCardId is required' });
            continue;
          }

          const rateCard = await prisma.rateCard.findFirst({
            where: { externalRateId: ar.externalRateCardId }
          });

          if (!rateCard) {
            results.errors.push({ type: 'accessorial', id: ar.externalRateCardId, error: 'Parent rate card not found' });
            continue;
          }

          // Check if accessorial already exists
          const existingAccessorial = await prisma.accessorialRate.findFirst({
            where: {
              rateCardId: rateCard.id,
              accessorialType: ar.type as AccessorialType
            }
          });

          const accessorialData = {
            accessorialType: ar.type as AccessorialType,
            description: ar.description,
            rateAmount: new Prisma.Decimal(ar.rateAmount),
            rateMethod: (ar.rateMethod as RateMethod) || 'FLAT_RATE',
            minimumCharge: ar.minimumCharge ? new Prisma.Decimal(ar.minimumCharge) : null,
            maximumCharge: ar.maximumCharge ? new Prisma.Decimal(ar.maximumCharge) : null
          };

          if (existingAccessorial) {
            await prisma.accessorialRate.update({
              where: { id: existingAccessorial.id },
              data: accessorialData
            });
            results.accessorialsUpdated++;
          } else {
            await prisma.accessorialRate.create({
              data: {
                rateCardId: rateCard.id,
                ...accessorialData
              }
            });
            results.accessorialsCreated++;
          }
        } catch (err: any) {
          results.errors.push({ type: 'accessorial', id: ar.externalRateCardId || 'unknown', error: err.message });
        }
      }
    }

    res.json({
      success: results.errors.length === 0,
      message: `Import completed: ${results.rateCardsCreated} rate cards created, ${results.rateCardsUpdated} updated; ${results.accessorialsCreated} accessorials created, ${results.accessorialsUpdated} updated; ${results.errors.length} errors`,
      results
    });
  } catch (error) {
    console.error('Error importing from external system:', error);
    res.status(500).json({ success: false, message: 'Failed to import from external system' });
  }
};

// Get drivers with their rate cards for the Pay Rules UI
export const getDriversWithRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, carrierId, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { active: true };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { number: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (carrierId) {
      where.carrierId = parseInt(carrierId as string, 10);
    }

    const [drivers, total] = await Promise.all([
      prisma.carrierDriver.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: {
          carrier: { select: { id: true, name: true } }
        }
      }),
      prisma.carrierDriver.count({ where })
    ]);

    // Get rate cards for these drivers
    const driverIds = drivers.map(d => d.id);
    const rateCards = await prisma.rateCard.findMany({
      where: {
        rateType: 'DRIVER',
        entityId: { in: driverIds },
        active: true
      },
      include: {
        accessorialRates: true
      }
    });

    // Map rate cards to drivers
    const driversWithRates = drivers.map(driver => ({
      ...driver,
      rateCard: rateCards.find(rc => rc.entityId === driver.id) || null
    }));

    res.json({
      drivers: driversWithRates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching drivers with rates:', error);
    res.status(500).json({ message: 'Failed to fetch drivers with rates' });
  }
};

// Get carriers with their rate cards for the Pay Rules UI
export const getCarriersWithRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { status: 'active' };

    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const [carriers, total] = await Promise.all([
      prisma.carrier.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          mcNumber: true,
          status: true
        }
      }),
      prisma.carrier.count({ where })
    ]);

    // Get rate cards for these carriers
    const carrierIds = carriers.map(c => c.id);
    const rateCards = await prisma.rateCard.findMany({
      where: {
        rateType: 'CARRIER',
        entityId: { in: carrierIds },
        active: true
      },
      include: {
        accessorialRates: true
      }
    });

    // Map rate cards to carriers
    const carriersWithRates = carriers.map(carrier => ({
      ...carrier,
      rateCard: rateCards.find(rc => rc.entityId === carrier.id) || null
    }));

    res.json({
      carriers: carriersWithRates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching carriers with rates:', error);
    res.status(500).json({ message: 'Failed to fetch carriers with rates' });
  }
};

// Get linehaul profiles with their rate cards for the Pay Rules UI
export const getProfilesWithRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { active: true };

    if (search) {
      where.OR = [
        { profileCode: { contains: search as string, mode: 'insensitive' } },
        { name: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.linehaulProfile.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { profileCode: 'asc' },
        include: {
          originTerminal: { select: { code: true, name: true } },
          destinationTerminal: { select: { code: true, name: true } }
        }
      }),
      prisma.linehaulProfile.count({ where })
    ]);

    // Get rate cards for these profiles
    const profileIds = profiles.map(p => p.id);
    const rateCards = await prisma.rateCard.findMany({
      where: {
        rateType: 'LINEHAUL',
        linehaulProfileId: { in: profileIds },
        active: true
      },
      include: {
        accessorialRates: true
      }
    });

    // Map rate cards to profiles
    const profilesWithRates = profiles.map(profile => ({
      ...profile,
      rateCard: rateCards.find(rc => rc.linehaulProfileId === profile.id) || null
    }));

    res.json({
      profiles: profilesWithRates,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching profiles with rates:', error);
    res.status(500).json({ message: 'Failed to fetch profiles with rates' });
  }
};
