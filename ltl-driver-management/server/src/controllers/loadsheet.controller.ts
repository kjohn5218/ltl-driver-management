import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma, LoadsheetStatus } from '@prisma/client';
import { generateManifestNumber, generateLoadsheetPDF } from '../services/loadsheet.service';

// Get all loadsheets with filtering
export const getLoadsheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      linehaulTripId,
      originTerminalId,
      originTerminalCode,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.LoadsheetWhereInput = {};

    if (search) {
      where.OR = [
        { manifestNumber: { contains: search as string, mode: 'insensitive' } },
        { trailerNumber: { contains: search as string, mode: 'insensitive' } },
        { linehaulName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (linehaulTripId) {
      // When querying by linehaulTripId, return all loadsheets for that trip regardless of status
      const parsedTripId = parseInt(linehaulTripId as string, 10);
      where.linehaulTripId = parsedTripId;
      console.log(`[Loadsheet Query] Fetching loadsheets for linehaulTripId: ${parsedTripId}`);
      // Only apply status filter if explicitly requested
      if (status) {
        where.status = status as LoadsheetStatus;
      }
    } else {
      // Default to showing only OPEN and LOADING loadsheets unless specific status requested
      if (status) {
        where.status = status as LoadsheetStatus;
      } else {
        // Only show loadsheets that are available for loading (OPEN or LOADING)
        where.status = { in: ['OPEN', 'LOADING'] };
      }
    }

    // Filter by origin terminal - support both ID and code
    // This filter now works for both originating loadsheets and arrived/continuing loadsheets
    if (originTerminalId) {
      where.originTerminalId = parseInt(originTerminalId as string, 10);
    } else if (originTerminalCode) {
      where.originTerminalCode = { equals: originTerminalCode as string, mode: 'insensitive' };
    }

    if (startDate) {
      where.loadDate = {
        ...where.loadDate as object,
        gte: new Date(startDate as string)
      };
    }

    if (endDate) {
      where.loadDate = {
        ...where.loadDate as object,
        lte: new Date(endDate as string)
      };
    }

    // Get loadsheets matching the basic filters
    let loadsheets = await prisma.loadsheet.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        originTerminal: {
          select: { id: true, code: true, name: true }
        },
        linehaulTrip: {
          select: { id: true, tripNumber: true, status: true }
        },
        _count: {
          select: { hazmatItems: true, dispatchEntries: true }
        }
      }
    });

    // Log results when querying by trip ID
    if (linehaulTripId) {
      console.log(`[Loadsheet Query] Found ${loadsheets.length} loadsheets for tripId ${linehaulTripId}:`,
        loadsheets.map(ls => ({ id: ls.id, manifest: ls.manifestNumber, linehaulTripId: ls.linehaulTripId })));
    }

    // If filtering by location, exclude loadsheets where the location is the final destination
    // (final destination means freight can only be unloaded, not loaded - belongs on Inbound tab)
    // EXCEPTIONS:
    // 1. If status is explicitly set to OPEN, these are continuing loads and should be shown
    // 2. Loadsheets linked to an ARRIVED trip are continuing loads and should be shown
    if (originTerminalCode && loadsheets.length > 0) {
      // If specifically querying for OPEN status, don't filter by final destination
      // OPEN loadsheets have freight that needs to continue, regardless of location
      const isQueryingOpenStatus = status === 'OPEN';

      if (!isQueryingOpenStatus) {
        // Get unique linehaul names from the loadsheets
        const linehaulNames = [...new Set(loadsheets.map(ls => ls.linehaulName))];

        // For each linehaul name, find the final destination
        const finalDestinations = new Map<string, string>();

        for (const linehaulName of linehaulNames) {
          // Find the last leg (highest legOrder) for this profile
          const lastLeg = await prisma.route.findFirst({
            where: {
              name: linehaulName,
              active: true
            },
            orderBy: { legOrder: 'desc' },
            select: { destination: true }
          });

          if (lastLeg?.destination) {
            finalDestinations.set(linehaulName, lastLeg.destination.toUpperCase());
          }
        }

        // Get IDs of loadsheets linked to ARRIVED trips (these are continuing loads)
        const continuingLoadsheetIds = new Set(
          loadsheets
            .filter(ls => ls.linehaulTripId && ls.linehaulTrip?.status === 'ARRIVED')
            .map(ls => ls.id)
        );

        // Filter out loadsheets where the current location is the final destination
        // These should appear on the Inbound tab, not the Loads page
        // EXCEPTION: Always include loadsheets linked to ARRIVED trips (continuing loads)
        loadsheets = loadsheets.filter(ls => {
          // Always include continuing loads (linked to ARRIVED trip)
          if (continuingLoadsheetIds.has(ls.id)) {
            return true;
          }

          const finalDest = finalDestinations.get(ls.linehaulName);
          // If the current origin is the final destination, don't show on loads page
          if (finalDest && ls.originTerminalCode?.toUpperCase() === finalDest) {
            return false;
          }
          return true;
        });
      }
    }

    // Get total count (need to apply same filtering logic for accurate count)
    let total = await prisma.loadsheet.count({ where });

    // Adjust total if we filtered out final destinations
    if (originTerminalCode) {
      total = loadsheets.length; // Use the filtered count for this page
      // For accurate pagination, we'd need to count all filtered results
      // For now, this is a simplification
    }

    res.json({
      loadsheets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching loadsheets:', error);
    res.status(500).json({ message: 'Failed to fetch loadsheets' });
  }
};

// Get loadsheet by ID
export const getLoadsheetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        originTerminal: true,
        linehaulTrip: {
          include: {
            linehaulProfile: true,
            driver: { select: { id: true, name: true } },
            truck: { select: { id: true, unitNumber: true } },
            trailer: { select: { id: true, unitNumber: true } }
          }
        },
        hazmatItems: { orderBy: { itemNumber: 'asc' } },
        dispatchEntries: { orderBy: { rowNumber: 'asc' } },
        freightPlacements: { orderBy: { rowNumber: 'asc' } }
      }
    });

    if (!loadsheet) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    res.json(loadsheet);
  } catch (error) {
    console.error('Error fetching loadsheet:', error);
    res.status(500).json({ message: 'Failed to fetch loadsheet' });
  }
};

// Get loadsheet by manifest number
export const getLoadsheetByManifest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { manifestNumber } = req.params;

    const loadsheet = await prisma.loadsheet.findUnique({
      where: { manifestNumber },
      include: {
        originTerminal: true,
        linehaulTrip: true,
        hazmatItems: { orderBy: { itemNumber: 'asc' } },
        dispatchEntries: { orderBy: { rowNumber: 'asc' } },
        freightPlacements: { orderBy: { rowNumber: 'asc' } }
      }
    });

    if (!loadsheet) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    res.json(loadsheet);
  } catch (error) {
    console.error('Error fetching loadsheet by manifest:', error);
    res.status(500).json({ message: 'Failed to fetch loadsheet' });
  }
};

// Create new loadsheet
export const createLoadsheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      trailerNumber,
      linehaulName,
      suggestedTrailerLength,
      pintleHookRequired,
      targetDispatchTime,
      scheduledDepartDate,
      preloadManifest,
      originTerminalId,
      originTerminalCode,
      linehaulTripId,
      doorNumber,
      loadDate,
      straps,
      closeTime,
      loadType,
      loadbars,
      loaderNumber,
      exceptions,
      capacity,
      blankets,
      loaderName,
      sealNumber,
      pieces,
      weight,
      wallCondition,
      floorCondition,
      roofCondition,
      trailerConditionComment,
      hazmatPlacards,
      hazmatItems,
      dispatchEntries,
      freightPlacements
    } = req.body;

    // Generate unique manifest number
    const manifestNumber = await generateManifestNumber();

    // Validate terminal if ID provided - only include if terminal exists in database
    let validTerminalId: number | null = null;
    let terminalCode = originTerminalCode;

    if (originTerminalId) {
      const terminal = await prisma.terminal.findUnique({
        where: { id: originTerminalId },
        select: { id: true, code: true }
      });
      if (terminal) {
        validTerminalId = terminal.id;
        if (!terminalCode) {
          terminalCode = terminal.code;
        }
      } else {
        console.log(`Terminal ID ${originTerminalId} not found in database, using code only: ${terminalCode}`);
      }
    }

    // Look up the route to get destination and routeId
    let routeId: number | null = null;
    let destinationTerminalCode: string | null = null;

    if (linehaulName && terminalCode) {
      const route = await prisma.route.findFirst({
        where: {
          name: linehaulName,
          origin: terminalCode,
          active: true
        }
      });
      if (route) {
        routeId = route.id;
        destinationTerminalCode = route.destination;
        console.log(`Found route for ${linehaulName}/${terminalCode}: ${route.origin} -> ${route.destination} (leg ${route.legOrder})`);
      } else {
        console.log(`No route found for linehaulName=${linehaulName}, origin=${terminalCode}`);
      }
    }

    // Create loadsheet with related data (default status is OPEN)
    const loadsheet = await prisma.loadsheet.create({
      data: {
        manifestNumber,
        trailerNumber,
        linehaulName,
        status: 'OPEN',
        suggestedTrailerLength: suggestedTrailerLength || 53,
        pintleHookRequired: pintleHookRequired || false,
        targetDispatchTime,
        scheduledDepartDate,
        preloadManifest,
        originTerminalId: validTerminalId,
        originTerminalCode: terminalCode,
        destinationTerminalCode,
        routeId,
        linehaulTripId,
        doorNumber,
        loadDate: loadDate ? new Date(loadDate) : new Date(),
        straps,
        closeTime,
        loadType: loadType || 'PURE',
        loadbars,
        loaderNumber,
        exceptions,
        capacity,
        blankets,
        loaderName,
        sealNumber,
        pieces,
        weight,
        wallCondition: wallCondition || 'OK',
        floorCondition: floorCondition || 'OK',
        roofCondition: roofCondition || 'OK',
        trailerConditionComment,
        hazmatPlacards: hazmatPlacards ? JSON.stringify(hazmatPlacards) : null,
        createdBy: (req as any).user?.id,
        hazmatItems: hazmatItems ? {
          create: hazmatItems.map((item: any) => ({
            itemNumber: item.itemNumber,
            proNumber: item.proNumber,
            hazmatClass: item.hazmatClass,
            weight: item.weight
          }))
        } : undefined,
        dispatchEntries: dispatchEntries ? {
          create: dispatchEntries.map((entry: any) => ({
            rowNumber: entry.rowNumber,
            dispatchTime: entry.dispatchTime,
            dispatchTerminal: entry.dispatchTerminal,
            nextTerminal: entry.nextTerminal,
            tractorNumber: entry.tractorNumber,
            driverNumber: entry.driverNumber,
            driverName: entry.driverName,
            supervisorNumber: entry.supervisorNumber
          }))
        } : undefined,
        freightPlacements: freightPlacements ? {
          create: freightPlacements.map((placement: any) => ({
            rowNumber: placement.rowNumber,
            loose: placement.loose,
            left: placement.left,
            right: placement.right
          }))
        } : undefined
      },
      include: {
        originTerminal: true,
        linehaulTrip: true,
        hazmatItems: { orderBy: { itemNumber: 'asc' } },
        dispatchEntries: { orderBy: { rowNumber: 'asc' } },
        freightPlacements: { orderBy: { rowNumber: 'asc' } }
      }
    });

    res.status(201).json(loadsheet);
  } catch (error: any) {
    console.error('Error creating loadsheet:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    if (error.meta) {
      console.error('Error meta:', error.meta);
    }
    res.status(500).json({
      message: 'Failed to create loadsheet',
      error: error.message,
      code: error.code
    });
  }
};

// Update loadsheet
export const updateLoadsheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const loadsheetId = parseInt(id, 10);

    const {
      trailerNumber,
      linehaulName,
      suggestedTrailerLength,
      pintleHookRequired,
      targetDispatchTime,
      scheduledDepartDate,
      preloadManifest,
      originTerminalId,
      originTerminalCode,
      linehaulTripId,
      doorNumber,
      loadDate,
      straps,
      closeTime,
      loadType,
      loadbars,
      loaderNumber,
      exceptions,
      capacity,
      blankets,
      loaderName,
      sealNumber,
      pieces,
      weight,
      wallCondition,
      floorCondition,
      roofCondition,
      trailerConditionComment,
      hazmatPlacards,
      status,
      hazmatItems,
      dispatchEntries,
      freightPlacements
    } = req.body;

    // Check if loadsheet exists
    const existing = await prisma.loadsheet.findUnique({
      where: { id: loadsheetId }
    });

    if (!existing) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    // Validate terminal if ID provided - only include if terminal exists in database
    let validTerminalId: number | null | undefined = undefined;
    let terminalCode = originTerminalCode;

    if (originTerminalId !== undefined) {
      if (originTerminalId === null) {
        validTerminalId = null;
      } else {
        const terminal = await prisma.terminal.findUnique({
          where: { id: originTerminalId },
          select: { id: true, code: true }
        });
        if (terminal) {
          validTerminalId = terminal.id;
          if (!terminalCode) {
            terminalCode = terminal.code;
          }
        } else {
          // Terminal doesn't exist, don't update the ID but update the code
          console.log(`Terminal ID ${originTerminalId} not found in database, using code only: ${terminalCode}`);
        }
      }
    }

    // Log linehaulTripId updates
    if (linehaulTripId !== undefined) {
      console.log(`[Loadsheet Update] Setting linehaulTripId=${linehaulTripId} for loadsheet ${loadsheetId}`);
    }

    // Update in transaction to handle related data
    const loadsheet = await prisma.$transaction(async (tx) => {
      // Delete existing related data if new data provided
      if (hazmatItems !== undefined) {
        await tx.loadsheetHazmatItem.deleteMany({ where: { loadsheetId } });
      }
      if (dispatchEntries !== undefined) {
        await tx.loadsheetDispatchEntry.deleteMany({ where: { loadsheetId } });
      }
      if (freightPlacements !== undefined) {
        await tx.loadsheetFreightPlacement.deleteMany({ where: { loadsheetId } });
      }

      // Update loadsheet with new data
      return tx.loadsheet.update({
        where: { id: loadsheetId },
        data: {
          ...(trailerNumber !== undefined && { trailerNumber }),
          ...(linehaulName !== undefined && { linehaulName }),
          ...(suggestedTrailerLength !== undefined && { suggestedTrailerLength }),
          ...(pintleHookRequired !== undefined && { pintleHookRequired }),
          ...(targetDispatchTime !== undefined && { targetDispatchTime }),
          ...(scheduledDepartDate !== undefined && { scheduledDepartDate }),
          ...(preloadManifest !== undefined && { preloadManifest }),
          ...(validTerminalId !== undefined && { originTerminalId: validTerminalId }),
          ...(terminalCode !== undefined && { originTerminalCode: terminalCode }),
          ...(linehaulTripId !== undefined && { linehaulTripId }),
          ...(doorNumber !== undefined && { doorNumber }),
          ...(loadDate !== undefined && { loadDate: new Date(loadDate) }),
          ...(straps !== undefined && { straps }),
          ...(closeTime !== undefined && { closeTime }),
          ...(loadType !== undefined && { loadType }),
          ...(loadbars !== undefined && { loadbars }),
          ...(loaderNumber !== undefined && { loaderNumber }),
          ...(exceptions !== undefined && { exceptions }),
          ...(capacity !== undefined && { capacity }),
          ...(blankets !== undefined && { blankets }),
          ...(loaderName !== undefined && { loaderName }),
          ...(sealNumber !== undefined && { sealNumber }),
          ...(pieces !== undefined && { pieces }),
          ...(weight !== undefined && { weight }),
          ...(wallCondition !== undefined && { wallCondition }),
          ...(floorCondition !== undefined && { floorCondition }),
          ...(roofCondition !== undefined && { roofCondition }),
          ...(trailerConditionComment !== undefined && { trailerConditionComment }),
          ...(hazmatPlacards !== undefined && { hazmatPlacards: JSON.stringify(hazmatPlacards) }),
          ...(status !== undefined && { status }),
          hazmatItems: hazmatItems ? {
            create: hazmatItems.map((item: any) => ({
              itemNumber: item.itemNumber,
              proNumber: item.proNumber,
              hazmatClass: item.hazmatClass,
              weight: item.weight
            }))
          } : undefined,
          dispatchEntries: dispatchEntries ? {
            create: dispatchEntries.map((entry: any) => ({
              rowNumber: entry.rowNumber,
              dispatchTime: entry.dispatchTime,
              dispatchTerminal: entry.dispatchTerminal,
              nextTerminal: entry.nextTerminal,
              tractorNumber: entry.tractorNumber,
              driverNumber: entry.driverNumber,
              driverName: entry.driverName,
              supervisorNumber: entry.supervisorNumber
            }))
          } : undefined,
          freightPlacements: freightPlacements ? {
            create: freightPlacements.map((placement: any) => ({
              rowNumber: placement.rowNumber,
              loose: placement.loose,
              left: placement.left,
              right: placement.right
            }))
          } : undefined
        },
        include: {
          originTerminal: true,
          linehaulTrip: true,
          hazmatItems: { orderBy: { itemNumber: 'asc' } },
          dispatchEntries: { orderBy: { rowNumber: 'asc' } },
          freightPlacements: { orderBy: { rowNumber: 'asc' } }
        }
      });
    });

    res.json(loadsheet);
  } catch (error) {
    console.error('Error updating loadsheet:', error);
    res.status(500).json({ message: 'Failed to update loadsheet' });
  }
};

// Close loadsheet
export const closeLoadsheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { sealNumber } = req.body;

    const loadsheet = await prisma.loadsheet.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: 'CLOSED',
        ...(sealNumber && { sealNumber })
      },
      include: {
        originTerminal: true,
        linehaulTrip: true,
        hazmatItems: { orderBy: { itemNumber: 'asc' } },
        dispatchEntries: { orderBy: { rowNumber: 'asc' } },
        freightPlacements: { orderBy: { rowNumber: 'asc' } }
      }
    });

    res.json(loadsheet);
  } catch (error) {
    console.error('Error closing loadsheet:', error);
    res.status(500).json({ message: 'Failed to close loadsheet' });
  }
};

// Download loadsheet as PDF
export const downloadLoadsheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const loadsheetId = parseInt(id, 10);

    // Check if loadsheet exists
    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: loadsheetId },
      select: { manifestNumber: true }
    });

    if (!loadsheet) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    // Generate PDF
    const pdfBuffer = await generateLoadsheetPDF(loadsheetId);

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=loadsheet-${loadsheet.manifestNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating loadsheet PDF:', error);
    res.status(500).json({ message: 'Failed to generate PDF' });
  }
};

// Check for duplicate loadsheets (same trailer, location, within 4 days, not DISPATCHED or CLOSED)
export const checkDuplicateLoadsheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trailerNumber, originTerminalCode } = req.body;

    if (!trailerNumber || !originTerminalCode) {
      res.status(400).json({ message: 'Trailer number and origin terminal code are required' });
      return;
    }

    // Calculate date 4 days ago
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // Find loadsheets with same trailer, same location, created in last 4 days,
    // with status NOT 'DISPATCHED' or 'CLOSED'
    const duplicates = await prisma.loadsheet.findMany({
      where: {
        trailerNumber: { equals: trailerNumber, mode: 'insensitive' },
        originTerminalCode: { equals: originTerminalCode, mode: 'insensitive' },
        loadDate: { gte: fourDaysAgo },
        status: { notIn: ['DISPATCHED', 'CLOSED'] }
      },
      select: {
        id: true,
        manifestNumber: true,
        trailerNumber: true,
        linehaulName: true,
        loadDate: true,
        status: true,
        originTerminalCode: true
      },
      orderBy: { loadDate: 'desc' }
    });

    res.json({
      hasDuplicates: duplicates.length > 0,
      duplicates
    });
  } catch (error) {
    console.error('Error checking duplicate loadsheets:', error);
    res.status(500).json({ message: 'Failed to check for duplicate loadsheets' });
  }
};

// Delete loadsheet (open only)
export const deleteLoadsheet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const loadsheetId = parseInt(id, 10);

    // Check if loadsheet exists and is open
    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: loadsheetId }
    });

    if (!loadsheet) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    if (loadsheet.status !== 'OPEN') {
      res.status(400).json({ message: 'Only open loadsheets can be deleted' });
      return;
    }

    await prisma.loadsheet.delete({
      where: { id: loadsheetId }
    });

    res.json({ message: 'Loadsheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting loadsheet:', error);
    res.status(500).json({ message: 'Failed to delete loadsheet' });
  }
};

// Get shipments loaded to a loadsheet
// Returns shipments from trip documents if dispatched, or mock data if not yet dispatched
export const getLoadsheetShipments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const loadsheetId = parseInt(id, 10);

    // Get loadsheet basic info
    const loadsheet = await prisma.loadsheet.findUnique({
      where: { id: loadsheetId }
    });

    if (!loadsheet) {
      res.status(404).json({ message: 'Loadsheet not found' });
      return;
    }

    // Try to get shipments from trip documents first (if dispatched)
    let shipments: any[] = [];

    if (loadsheet.linehaulTripId) {
      // Fetch trip documents separately
      const tripDocuments = await prisma.tripDocument.findMany({
        where: {
          tripId: loadsheet.linehaulTripId,
          documentType: 'LINEHAUL_MANIFEST',
          status: 'GENERATED'
        },
        include: {
          manifestData: {
            include: {
              freightItems: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });

      if (tripDocuments.length > 0) {
        const manifest = tripDocuments[0];
        if (manifest.manifestData?.freightItems) {
          // Filter to shipments for this manifest number
          shipments = manifest.manifestData.freightItems.filter(
            (item: any) => item.manifestNumber === loadsheet.manifestNumber
          );
        }
      }
    }

    // If no shipments from trip documents, generate mock data based on loadsheet status
    if (shipments.length === 0 && loadsheet.status !== 'DRAFT') {
      // Generate mock shipments based on loadsheet pieces/weight
      const mockShipmentCount = loadsheet.status === 'OPEN' ? 0 :
                                loadsheet.status === 'LOADING' ? Math.floor(Math.random() * 8) + 3 :
                                Math.floor(Math.random() * 12) + 8;

      const destinations = ['ATL', 'MEM', 'DFW', 'LAX', 'ORD', 'PHX', 'SEA', 'DEN'];
      const companies = [
        'Acme Corp', 'Global Industries', 'Metro Supplies', 'Tech Solutions',
        'Prime Logistics', 'Quality Goods Inc', 'Fast Track Co', 'Summit Products'
      ];
      const cities = [
        'Atlanta, GA', 'Memphis, TN', 'Dallas, TX', 'Los Angeles, CA',
        'Chicago, IL', 'Phoenix, AZ', 'Seattle, WA', 'Denver, CO'
      ];

      let totalPieces = 0;
      let totalWeight = 0;
      const targetPieces = loadsheet.pieces || Math.floor(Math.random() * 200) + 50;
      const targetWeight = loadsheet.weight || Math.floor(Math.random() * 15000) + 5000;

      for (let i = 0; i < mockShipmentCount; i++) {
        const piecesForThis = Math.floor(targetPieces / mockShipmentCount) + Math.floor(Math.random() * 10);
        const weightForThis = Math.floor(targetWeight / mockShipmentCount) + Math.floor(Math.random() * 500);
        const destIndex = Math.floor(Math.random() * destinations.length);
        const isHazmat = Math.random() < 0.15; // 15% chance of hazmat

        shipments.push({
          id: i + 1,
          proNumber: `PRO${String(100000000 + Math.floor(Math.random() * 900000000)).substring(0, 9)}`,
          manifestNumber: loadsheet.manifestNumber,
          destTerminal: destinations[destIndex],
          destTerminalSub: null,
          consigneeName: companies[Math.floor(Math.random() * companies.length)],
          consigneeCity: cities[destIndex],
          pieces: piecesForThis,
          weight: weightForThis,
          isHazmat,
          hazmatClass: isHazmat ? ['1.4', '2.1', '3', '4.1', '8', '9'][Math.floor(Math.random() * 6)] : null,
          sortOrder: i
        });

        totalPieces += piecesForThis;
        totalWeight += weightForThis;
      }
    }

    // Calculate totals
    const totalPieces = shipments.reduce((sum: number, item: any) => sum + (item.pieces || 0), 0);
    const totalWeight = shipments.reduce((sum: number, item: any) => sum + (item.weight || 0), 0);
    const hazmatCount = shipments.filter((item: any) => item.isHazmat).length;

    res.json({
      loadsheetId,
      manifestNumber: loadsheet.manifestNumber,
      shipments,
      totalPieces,
      totalWeight,
      hazmatCount
    });
  } catch (error) {
    console.error('Error fetching loadsheet shipments:', error);
    res.status(500).json({ message: 'Failed to fetch loadsheet shipments' });
  }
};
