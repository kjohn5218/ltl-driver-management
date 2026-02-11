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
            select: { id: true, profileCode: true, name: true, originTerminal: { select: { code: true } }, destinationTerminal: { select: { code: true } } }
          },
          _count: {
            select: { accessorialRates: true }
          }
        }
      }),
      prisma.rateCard.count({ where })
    ]);

    // Collect driver and carrier IDs that need to be looked up
    const driverIds = rateCards.filter(rc => rc.rateType === 'DRIVER' && rc.entityId).map(rc => rc.entityId!);
    const carrierIds = rateCards.filter(rc => rc.rateType === 'CARRIER' && rc.entityId).map(rc => rc.entityId!);

    // Fetch driver and carrier names in parallel
    const [drivers, carriers] = await Promise.all([
      driverIds.length > 0
        ? prisma.carrierDriver.findMany({
            where: { id: { in: driverIds } },
            select: { id: true, name: true, number: true, workdayEmployeeId: true, carrier: { select: { id: true, name: true } } }
          })
        : [],
      carrierIds.length > 0
        ? prisma.carrier.findMany({
            where: { id: { in: carrierIds } },
            select: { id: true, name: true }
          })
        : []
    ]);

    // Create lookup maps
    const driverMap = new Map(drivers.map(d => [d.id, d]));
    const carrierMap = new Map(carriers.map(c => [c.id, c]));

    // Helper to parse driver/employer info from notes
    const parseNotesInfo = (notes: string | null) => {
      if (!notes) return { driverName: null, employer: null };
      // Match both formats: "Driver: Name" and "driverName: Name"
      const driverMatch = notes.match(/(?:Driver|driverName):\s*([^;.]+)/i);
      const employerMatch = notes.match(/(?:Employer|employer):\s*([^;.]+)/i);
      return {
        driverName: driverMatch ? driverMatch[1].trim() : null,
        employer: employerMatch ? employerMatch[1].trim() : null
      };
    };

    // Attach driver/carrier info to rate cards
    let enrichedRateCards = rateCards.map(rc => {
      let driver = rc.rateType === 'DRIVER' && rc.entityId ? driverMap.get(rc.entityId) || null : null;
      let carrier = rc.rateType === 'CARRIER' && rc.entityId ? carrierMap.get(rc.entityId) || null : null;

      // If driver not found by entityId, try to extract from notes
      if (rc.rateType === 'DRIVER' && !driver) {
        const notesInfo = parseNotesInfo(rc.notes);
        if (notesInfo.driverName) {
          driver = {
            id: 0,
            name: notesInfo.driverName,
            number: null,
            workdayEmployeeId: null,
            carrier: notesInfo.employer ? { id: 0, name: notesInfo.employer } : null
          } as any;
        }
      }

      // If carrier not found by entityId for CARRIER types, try to extract from notes
      if (rc.rateType === 'CARRIER' && !carrier) {
        const notesInfo = parseNotesInfo(rc.notes);
        if (notesInfo.employer) {
          carrier = { id: 0, name: notesInfo.employer };
        }
      }

      return { ...rc, driver, carrier };
    });

    // Deduplicate: If multiple rate cards exist for the same driver (by name),
    // keep only the one linked to a Workday-connected driver
    const driverRateCards = enrichedRateCards.filter(rc => rc.rateType === 'DRIVER' && rc.driver?.name);
    const otherRateCards = enrichedRateCards.filter(rc => rc.rateType !== 'DRIVER' || !rc.driver?.name);

    // Normalize driver name for comparison (lowercase, trim)
    const normalizeName = (name: string) => name.toLowerCase().trim();

    // Group driver rate cards by normalized driver name
    const byDriverName = new Map<string, typeof enrichedRateCards>();
    for (const rc of driverRateCards) {
      const name = normalizeName(rc.driver!.name);
      if (!byDriverName.has(name)) {
        byDriverName.set(name, []);
      }
      byDriverName.get(name)!.push(rc);
    }

    // For each driver name, prefer: 1) Workday-connected, 2) Has driver number, 3) First one
    const deduplicatedDriverRateCards: typeof enrichedRateCards = [];
    for (const [, cards] of byDriverName) {
      if (cards.length === 1) {
        deduplicatedDriverRateCards.push(cards[0]);
      } else {
        // Multiple cards for same driver name - prefer Workday-connected
        const workdayCard = cards.find(c => c.driver?.workdayEmployeeId);
        if (workdayCard) {
          deduplicatedDriverRateCards.push(workdayCard);
        } else {
          // No Workday card, prefer one with driver number
          const cardWithNumber = cards.find(c => c.driver?.number);
          if (cardWithNumber) {
            deduplicatedDriverRateCards.push(cardWithNumber);
          } else {
            // No card with number, just take the first one
            deduplicatedDriverRateCards.push(cards[0]);
          }
        }
      }
    }

    enrichedRateCards = [...otherRateCards, ...deduplicatedDriverRateCards];

    res.json({
      rateCards: enrichedRateCards,
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
      active,
      // Flattened pay rule fields
      autoArrive,
      perTrip,
      perCutTrip,
      cutMiles,
      cutMilesType,
      perSingleMile,
      perDoubleMile,
      perTripleMile,
      perWorkHour,
      perStopHour,
      perSingleDH,
      perDoubleDH,
      perTripleDH,
      perChainUp,
      fuelSurcharge
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
        priority: priority ?? false,
        notes,
        active: active !== undefined ? active : true,
        // Flattened pay rule fields
        autoArrive: autoArrive ?? false,
        perTrip: perTrip ? new Prisma.Decimal(perTrip) : null,
        perCutTrip: perCutTrip ? new Prisma.Decimal(perCutTrip) : null,
        cutMiles: cutMiles ? new Prisma.Decimal(cutMiles) : null,
        cutMilesType: cutMilesType || null,
        perSingleMile: perSingleMile ? new Prisma.Decimal(perSingleMile) : null,
        perDoubleMile: perDoubleMile ? new Prisma.Decimal(perDoubleMile) : null,
        perTripleMile: perTripleMile ? new Prisma.Decimal(perTripleMile) : null,
        perWorkHour: perWorkHour ? new Prisma.Decimal(perWorkHour) : null,
        perStopHour: perStopHour ? new Prisma.Decimal(perStopHour) : null,
        perSingleDH: perSingleDH ? new Prisma.Decimal(perSingleDH) : null,
        perDoubleDH: perDoubleDH ? new Prisma.Decimal(perDoubleDH) : null,
        perTripleDH: perTripleDH ? new Prisma.Decimal(perTripleDH) : null,
        perChainUp: perChainUp ? new Prisma.Decimal(perChainUp) : null,
        fuelSurcharge: fuelSurcharge ? new Prisma.Decimal(fuelSurcharge) : null
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
      active,
      // Flattened pay rule fields
      autoArrive,
      perTrip,
      perCutTrip,
      cutMiles,
      cutMilesType,
      perSingleMile,
      perDoubleMile,
      perTripleMile,
      perWorkHour,
      perStopHour,
      perSingleDH,
      perDoubleDH,
      perTripleDH,
      perChainUp,
      fuelSurcharge
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
        ...(active !== undefined && { active }),
        // Flattened pay rule fields
        ...(autoArrive !== undefined && { autoArrive }),
        ...(perTrip !== undefined && { perTrip: perTrip ? new Prisma.Decimal(perTrip) : null }),
        ...(perCutTrip !== undefined && { perCutTrip: perCutTrip ? new Prisma.Decimal(perCutTrip) : null }),
        ...(cutMiles !== undefined && { cutMiles: cutMiles ? new Prisma.Decimal(cutMiles) : null }),
        ...(cutMilesType !== undefined && { cutMilesType: cutMilesType || null }),
        ...(perSingleMile !== undefined && { perSingleMile: perSingleMile ? new Prisma.Decimal(perSingleMile) : null }),
        ...(perDoubleMile !== undefined && { perDoubleMile: perDoubleMile ? new Prisma.Decimal(perDoubleMile) : null }),
        ...(perTripleMile !== undefined && { perTripleMile: perTripleMile ? new Prisma.Decimal(perTripleMile) : null }),
        ...(perWorkHour !== undefined && { perWorkHour: perWorkHour ? new Prisma.Decimal(perWorkHour) : null }),
        ...(perStopHour !== undefined && { perStopHour: perStopHour ? new Prisma.Decimal(perStopHour) : null }),
        ...(perSingleDH !== undefined && { perSingleDH: perSingleDH ? new Prisma.Decimal(perSingleDH) : null }),
        ...(perDoubleDH !== undefined && { perDoubleDH: perDoubleDH ? new Prisma.Decimal(perDoubleDH) : null }),
        ...(perTripleDH !== undefined && { perTripleDH: perTripleDH ? new Prisma.Decimal(perTripleDH) : null }),
        ...(perChainUp !== undefined && { perChainUp: perChainUp ? new Prisma.Decimal(perChainUp) : null }),
        ...(fuelSurcharge !== undefined && { fuelSurcharge: fuelSurcharge ? new Prisma.Decimal(fuelSurcharge) : null })
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
        orderBy: { priority: 'desc' }
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
        orderBy: { priority: 'desc' }
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
        orderBy: { priority: 'desc' }
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
        orderBy: { priority: 'desc' }
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
        orderBy: { priority: 'desc' }
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
          priority: rc.priority ?? false,
          externalRateId: rc.externalRateId || null,
          notes: rc.notes || null,
          active: rc.active !== undefined ? rc.active : true,
          // Flattened pay rule fields
          autoArrive: rc.autoArrive ?? false,
          perTrip: rc.perTrip ? new Prisma.Decimal(rc.perTrip) : null,
          perCutTrip: rc.perCutTrip ? new Prisma.Decimal(rc.perCutTrip) : null,
          cutMiles: rc.cutMiles ? new Prisma.Decimal(rc.cutMiles) : null,
          cutMilesType: rc.cutMilesType || null,
          perSingleMile: rc.perSingleMile ? new Prisma.Decimal(rc.perSingleMile) : null,
          perDoubleMile: rc.perDoubleMile ? new Prisma.Decimal(rc.perDoubleMile) : null,
          perTripleMile: rc.perTripleMile ? new Prisma.Decimal(rc.perTripleMile) : null,
          perWorkHour: rc.perWorkHour ? new Prisma.Decimal(rc.perWorkHour) : null,
          perStopHour: rc.perStopHour ? new Prisma.Decimal(rc.perStopHour) : null,
          perSingleDH: rc.perSingleDH ? new Prisma.Decimal(rc.perSingleDH) : null,
          perDoubleDH: rc.perDoubleDH ? new Prisma.Decimal(rc.perDoubleDH) : null,
          perTripleDH: rc.perTripleDH ? new Prisma.Decimal(rc.perTripleDH) : null,
          perChainUp: rc.perChainUp ? new Prisma.Decimal(rc.perChainUp) : null,
          fuelSurcharge: rc.fuelSurcharge ? new Prisma.Decimal(rc.fuelSurcharge) : null
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
            priority: rc.priority ?? false,
            externalRateId: rc.externalRateId,
            notes: rc.notes || null,
            active: rc.active !== undefined ? rc.active : true,
            // Flattened pay rule fields
            autoArrive: rc.autoArrive ?? false,
            perTrip: rc.perTrip ? new Prisma.Decimal(rc.perTrip) : null,
            perCutTrip: rc.perCutTrip ? new Prisma.Decimal(rc.perCutTrip) : null,
            cutMiles: rc.cutMiles ? new Prisma.Decimal(rc.cutMiles) : null,
            cutMilesType: rc.cutMilesType || null,
            perSingleMile: rc.perSingleMile ? new Prisma.Decimal(rc.perSingleMile) : null,
            perDoubleMile: rc.perDoubleMile ? new Prisma.Decimal(rc.perDoubleMile) : null,
            perTripleMile: rc.perTripleMile ? new Prisma.Decimal(rc.perTripleMile) : null,
            perWorkHour: rc.perWorkHour ? new Prisma.Decimal(rc.perWorkHour) : null,
            perStopHour: rc.perStopHour ? new Prisma.Decimal(rc.perStopHour) : null,
            perSingleDH: rc.perSingleDH ? new Prisma.Decimal(rc.perSingleDH) : null,
            perDoubleDH: rc.perDoubleDH ? new Prisma.Decimal(rc.perDoubleDH) : null,
            perTripleDH: rc.perTripleDH ? new Prisma.Decimal(rc.perTripleDH) : null,
            perChainUp: rc.perChainUp ? new Prisma.Decimal(rc.perChainUp) : null,
            fuelSurcharge: rc.fuelSurcharge ? new Prisma.Decimal(rc.fuelSurcharge) : null
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

// ==================== DEFAULT RATES ====================

// Get default rate card with all accessorial rates
export const getDefaultRates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date();

    // Find the active default rate card
    let defaultRateCard = await prisma.rateCard.findFirst({
      where: {
        rateType: 'DEFAULT',
        active: true,
        effectiveDate: { lte: today },
        OR: [
          { expirationDate: null },
          { expirationDate: { gte: today } }
        ]
      },
      include: {
        accessorialRates: {
          orderBy: { accessorialType: 'asc' }
        }
      },
      orderBy: { priority: 'asc' }
    });

    // Get system fuel surcharge rate
    const systemSettings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    // If no default rate card exists, return empty with system FSC
    if (!defaultRateCard) {
      res.json({
        defaultRates: null,
        systemFuelSurcharge: systemSettings?.fuelSurchargeRate || 0,
        fuelSurchargeSource: systemSettings?.fuelSurchargeSource || 'manual'
      });
      return;
    }

    // Build a structured response with default rates
    const accessorialMap: Record<string, any> = {};
    for (const ar of defaultRateCard.accessorialRates) {
      accessorialMap[ar.accessorialType] = {
        id: ar.id,
        rateAmount: ar.rateAmount,
        rateMethod: ar.rateMethod,
        minimumCharge: ar.minimumCharge,
        maximumCharge: ar.maximumCharge,
        description: ar.description
      };
    }

    res.json({
      defaultRates: {
        id: defaultRateCard.id,
        baseRate: defaultRateCard.rateAmount,
        rateMethod: defaultRateCard.rateMethod,
        minimumAmount: defaultRateCard.minimumAmount,
        maximumAmount: defaultRateCard.maximumAmount,
        effectiveDate: defaultRateCard.effectiveDate,
        expirationDate: defaultRateCard.expirationDate,
        priority: defaultRateCard.priority,
        notes: defaultRateCard.notes,
        // Accessorial rates mapped by type
        dropHook: accessorialMap['DROP_HOOK'] || null,
        dropHookSingle: accessorialMap['DROP_HOOK_SINGLE'] || null,
        dropHookDoubleTriple: accessorialMap['DROP_HOOK_DOUBLE_TRIPLE'] || null,
        chainUp: accessorialMap['CHAIN_UP'] || null,
        fuelSurcharge: accessorialMap['FUEL_SURCHARGE'] || null,
        waitTime: accessorialMap['WAIT_TIME'] || null,
        singleTrailer: accessorialMap['SINGLE_TRAILER'] || null,
        doubleTrailer: accessorialMap['DOUBLE_TRAILER'] || null,
        tripleTrailer: accessorialMap['TRIPLE_TRAILER'] || null,
        cutPay: accessorialMap['CUT_PAY'] || null,
        cutPaySingleMiles: accessorialMap['CUT_PAY_SINGLE_MILES'] || null,
        cutPayDoubleMiles: accessorialMap['CUT_PAY_DOUBLE_MILES'] || null,
        cutPayTripleMiles: accessorialMap['CUT_PAY_TRIPLE_MILES'] || null,
        layover: accessorialMap['LAYOVER'] || null,
        detention: accessorialMap['DETENTION'] || null,
        breakdown: accessorialMap['BREAKDOWN'] || null,
        helper: accessorialMap['HELPER'] || null,
        hazmat: accessorialMap['HAZMAT'] || null,
        teamDriver: accessorialMap['TEAM_DRIVER'] || null,
        stopCharge: accessorialMap['STOP_CHARGE'] || null
      },
      systemFuelSurcharge: systemSettings?.fuelSurchargeRate || 0,
      fuelSurchargeSource: systemSettings?.fuelSurchargeSource || 'manual'
    });
  } catch (error) {
    console.error('Error fetching default rates:', error);
    res.status(500).json({ message: 'Failed to fetch default rates' });
  }
};

// Update or create default rate card with accessorial rates
export const updateDefaultRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      baseRate,
      rateMethod,
      minimumAmount,
      maximumAmount,
      effectiveDate,
      expirationDate,
      notes,
      // Accessorial rates
      dropHook,
      dropHookSingle,
      dropHookDoubleTriple,
      chainUp,
      fuelSurcharge,
      waitTime,
      singleTrailer,
      doubleTrailer,
      tripleTrailer,
      cutPay,
      cutPaySingleMiles,
      cutPayDoubleMiles,
      cutPayTripleMiles,
      layover,
      detention,
      breakdown,
      helper,
      hazmat,
      teamDriver,
      stopCharge
    } = req.body;

    const today = new Date();

    // Find existing active default rate card
    let defaultRateCard = await prisma.rateCard.findFirst({
      where: {
        rateType: 'DEFAULT',
        active: true
      },
      orderBy: { priority: 'asc' }
    });

    // Create or update the default rate card
    if (defaultRateCard) {
      defaultRateCard = await prisma.rateCard.update({
        where: { id: defaultRateCard.id },
        data: {
          rateAmount: baseRate !== undefined ? new Prisma.Decimal(baseRate) : undefined,
          rateMethod: rateMethod || undefined,
          minimumAmount: minimumAmount !== undefined ? new Prisma.Decimal(minimumAmount) : undefined,
          maximumAmount: maximumAmount !== undefined ? new Prisma.Decimal(maximumAmount) : undefined,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          notes: notes !== undefined ? notes : undefined
        }
      });
    } else {
      // Create new default rate card
      defaultRateCard = await prisma.rateCard.create({
        data: {
          rateType: 'DEFAULT',
          rateMethod: rateMethod || 'PER_MILE',
          rateAmount: new Prisma.Decimal(baseRate || 0),
          minimumAmount: minimumAmount ? new Prisma.Decimal(minimumAmount) : null,
          maximumAmount: maximumAmount ? new Prisma.Decimal(maximumAmount) : null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : today,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          priority: false, // Default rates have no priority override
          notes: notes || 'Default rate card',
          active: true
        }
      });
    }

    // Helper function to upsert accessorial rate
    const upsertAccessorial = async (
      type: AccessorialType,
      data: { rateAmount?: number; rateMethod?: string; minimumCharge?: number; maximumCharge?: number; description?: string } | null
    ) => {
      if (!data || data.rateAmount === undefined) return;

      const existing = await prisma.accessorialRate.findFirst({
        where: {
          rateCardId: defaultRateCard!.id,
          accessorialType: type
        }
      });

      if (existing) {
        await prisma.accessorialRate.update({
          where: { id: existing.id },
          data: {
            rateAmount: new Prisma.Decimal(data.rateAmount),
            rateMethod: (data.rateMethod as RateMethod) || 'FLAT_RATE',
            minimumCharge: data.minimumCharge ? new Prisma.Decimal(data.minimumCharge) : null,
            maximumCharge: data.maximumCharge ? new Prisma.Decimal(data.maximumCharge) : null,
            description: data.description || null
          }
        });
      } else {
        await prisma.accessorialRate.create({
          data: {
            rateCardId: defaultRateCard!.id,
            accessorialType: type,
            rateAmount: new Prisma.Decimal(data.rateAmount),
            rateMethod: (data.rateMethod as RateMethod) || 'FLAT_RATE',
            minimumCharge: data.minimumCharge ? new Prisma.Decimal(data.minimumCharge) : null,
            maximumCharge: data.maximumCharge ? new Prisma.Decimal(data.maximumCharge) : null,
            description: data.description || null
          }
        });
      }
    };

    // Upsert all accessorial rates
    await Promise.all([
      upsertAccessorial('DROP_HOOK', dropHook),
      upsertAccessorial('DROP_HOOK_SINGLE', dropHookSingle),
      upsertAccessorial('DROP_HOOK_DOUBLE_TRIPLE', dropHookDoubleTriple),
      upsertAccessorial('CHAIN_UP', chainUp),
      upsertAccessorial('FUEL_SURCHARGE', fuelSurcharge),
      upsertAccessorial('WAIT_TIME', waitTime),
      upsertAccessorial('SINGLE_TRAILER', singleTrailer),
      upsertAccessorial('DOUBLE_TRAILER', doubleTrailer),
      upsertAccessorial('TRIPLE_TRAILER', tripleTrailer),
      upsertAccessorial('CUT_PAY', cutPay),
      upsertAccessorial('CUT_PAY_SINGLE_MILES', cutPaySingleMiles),
      upsertAccessorial('CUT_PAY_DOUBLE_MILES', cutPayDoubleMiles),
      upsertAccessorial('CUT_PAY_TRIPLE_MILES', cutPayTripleMiles),
      upsertAccessorial('LAYOVER', layover),
      upsertAccessorial('DETENTION', detention),
      upsertAccessorial('BREAKDOWN', breakdown),
      upsertAccessorial('HELPER', helper),
      upsertAccessorial('HAZMAT', hazmat),
      upsertAccessorial('TEAM_DRIVER', teamDriver),
      upsertAccessorial('STOP_CHARGE', stopCharge)
    ]);

    // Fetch and return the updated default rates
    const updatedCard = await prisma.rateCard.findUnique({
      where: { id: defaultRateCard.id },
      include: {
        accessorialRates: {
          orderBy: { accessorialType: 'asc' }
        }
      }
    });

    res.json({
      message: 'Default rates updated successfully',
      rateCard: updatedCard
    });
  } catch (error) {
    console.error('Error updating default rates:', error);
    res.status(500).json({ message: 'Failed to update default rates' });
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
