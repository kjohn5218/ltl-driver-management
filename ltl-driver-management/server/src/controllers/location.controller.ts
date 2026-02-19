import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';

export const getLocations = async (req: Request, res: Response) => {
  try {
    const { search, active, isPhysicalTerminal, page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Build filter
    const where: Prisma.LocationWhereInput = {};

    // Add active filter
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Add physical terminal filter
    if (isPhysicalTerminal !== undefined) {
      where.isPhysicalTerminal = isPhysicalTerminal === 'true';
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
        active: locationData.active !== undefined ? locationData.active : true,
        isPhysicalTerminal: locationData.isPhysicalTerminal ?? false,
        isVirtualTerminal: locationData.isVirtualTerminal ?? false
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
        active: updateData.active,
        isPhysicalTerminal: updateData.isPhysicalTerminal,
        isVirtualTerminal: updateData.isVirtualTerminal
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

// Get locations that are terminals (for Okay to Load/Dispatch lists)
export const getTerminalLocations = async (_req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      where: {
        active: true,
        OR: [
          { isPhysicalTerminal: true },
          { isVirtualTerminal: true }
        ]
      },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        isPhysicalTerminal: true,
        isVirtualTerminal: true,
        isDispatchLocation: true
      },
      orderBy: { code: 'asc' }
    });

    return res.json(locations);
  } catch (error) {
    console.error('Get terminal locations error:', error);
    return res.status(500).json({ message: 'Failed to fetch terminal locations' });
  }
};

// Haversine formula to calculate distance between two GPS coordinates
const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Lookup mileage between two locations
// First checks linehaul profiles, then falls back to GPS calculation
export const lookupMileage = async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ message: 'Origin and destination are required' });
    }

    const originCode = (origin as string).toUpperCase();
    const destinationCode = (destination as string).toUpperCase();

    // First, try to find mileage from linehaul profiles
    // Look for a profile that matches origin and destination terminals by code
    const profile = await prisma.linehaulProfile.findFirst({
      where: {
        active: true,
        distanceMiles: { not: null },
        originTerminal: { code: originCode },
        destinationTerminal: { code: destinationCode }
      },
      select: {
        distanceMiles: true,
        profileCode: true
      }
    });

    if (profile && profile.distanceMiles) {
      return res.json({
        miles: profile.distanceMiles,
        originCode,
        destinationCode,
        source: 'profile',
        profileCode: profile.profileCode
      });
    }

    // Try reverse direction (destination to origin)
    const reverseProfile = await prisma.linehaulProfile.findFirst({
      where: {
        active: true,
        distanceMiles: { not: null },
        originTerminal: { code: destinationCode },
        destinationTerminal: { code: originCode }
      },
      select: {
        distanceMiles: true,
        profileCode: true
      }
    });

    if (reverseProfile && reverseProfile.distanceMiles) {
      return res.json({
        miles: reverseProfile.distanceMiles,
        originCode,
        destinationCode,
        source: 'profile',
        profileCode: reverseProfile.profileCode
      });
    }

    // Fall back to GPS calculation
    const [originLocation, destinationLocation] = await Promise.all([
      prisma.location.findUnique({
        where: { code: originCode },
        select: { latitude: true, longitude: true }
      }),
      prisma.location.findUnique({
        where: { code: destinationCode },
        select: { latitude: true, longitude: true }
      })
    ]);

    if (!originLocation || !destinationLocation) {
      return res.status(404).json({
        message: 'One or both locations not found',
        miles: null,
        originCode,
        destinationCode
      });
    }

    if (!originLocation.latitude || !originLocation.longitude ||
        !destinationLocation.latitude || !destinationLocation.longitude) {
      return res.status(404).json({
        message: 'GPS coordinates not available for one or both locations',
        miles: null,
        originCode,
        destinationCode
      });
    }

    // Calculate straight-line distance and apply road factor (1.3)
    const straightLineDistance = calculateHaversineDistance(
      Number(originLocation.latitude),
      Number(originLocation.longitude),
      Number(destinationLocation.latitude),
      Number(destinationLocation.longitude)
    );

    const roadFactor = 1.3;
    const drivingDistance = Math.round(straightLineDistance * roadFactor * 10) / 10;

    return res.json({
      miles: drivingDistance,
      originCode,
      destinationCode,
      source: 'gps'
    });
  } catch (error) {
    console.error('Lookup mileage error:', error);
    return res.status(500).json({ message: 'Failed to lookup mileage' });
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

// Get all locations as a simple list (for dropdowns)
export const getLocationsList = async (_req: Request, res: Response) => {
  try {
    const locations = await prisma.location.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        state: true,
        isPhysicalTerminal: true,
        isVirtualTerminal: true
      },
      orderBy: { code: 'asc' }
    });

    return res.json(locations);
  } catch (error) {
    console.error('Get locations list error:', error);
    return res.status(500).json({ message: 'Failed to fetch locations list' });
  }
};

// ==================== EQUIPMENT FUNCTIONALITY (migrated from Terminal) ====================

// Get location equipment summary
export const getLocationEquipmentSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id, 10);

    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    const [trucks, trailers, dollies] = await Promise.all([
      prisma.equipmentTruck.groupBy({
        by: ['status'],
        where: { currentLocationId: locationId },
        _count: { id: true }
      }),
      prisma.equipmentTrailer.groupBy({
        by: ['status'],
        where: { currentLocationId: locationId },
        _count: { id: true }
      }),
      prisma.equipmentDolly.groupBy({
        by: ['status'],
        where: { currentLocationId: locationId },
        _count: { id: true }
      })
    ]);

    return res.json({
      locationCode: location.code,
      locationName: location.name,
      trucks: trucks.map(t => ({ status: t.status, count: t._count.id })),
      trailers: trailers.map(t => ({ status: t.status, count: t._count.id })),
      dollies: dollies.map(d => ({ status: d.status, count: d._count.id }))
    });
  } catch (error) {
    console.error('Get location equipment summary error:', error);
    return res.status(500).json({ message: 'Failed to fetch location equipment summary' });
  }
};

// Get location equipment requirements
export const getLocationEquipmentRequirements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id, 10);

    const requirements = await prisma.locationEquipmentRequirement.findMany({
      where: { locationId },
      orderBy: { dayOfWeek: 'asc' }
    });

    return res.json(requirements);
  } catch (error) {
    console.error('Get location equipment requirements error:', error);
    return res.status(500).json({ message: 'Failed to fetch location equipment requirements' });
  }
};

// Create or update location equipment requirement
export const upsertLocationEquipmentRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id, 10);
    const {
      dayOfWeek,
      equipmentType,
      minCount,
      maxCount,
      effectiveDate,
      expirationDate,
      seasonalNote
    } = req.body;

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Check if requirement for this day and equipment type already exists
    const existingRequirement = await prisma.locationEquipmentRequirement.findFirst({
      where: {
        locationId,
        dayOfWeek,
        equipmentType
      }
    });

    let requirement;
    if (existingRequirement) {
      requirement = await prisma.locationEquipmentRequirement.update({
        where: { id: existingRequirement.id },
        data: {
          minCount: minCount !== undefined ? minCount : existingRequirement.minCount,
          maxCount: maxCount !== undefined ? maxCount : existingRequirement.maxCount,
          effectiveDate: effectiveDate !== undefined ? (effectiveDate ? new Date(effectiveDate) : null) : existingRequirement.effectiveDate,
          expirationDate: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : existingRequirement.expirationDate,
          seasonalNote: seasonalNote !== undefined ? seasonalNote : existingRequirement.seasonalNote
        }
      });
    } else {
      requirement = await prisma.locationEquipmentRequirement.create({
        data: {
          locationId,
          dayOfWeek,
          equipmentType,
          minCount: minCount || 0,
          maxCount: maxCount || null,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          seasonalNote
        }
      });
    }

    return res.status(existingRequirement ? 200 : 201).json(requirement);
  } catch (error) {
    console.error('Upsert location equipment requirement error:', error);
    return res.status(500).json({ message: 'Failed to save location equipment requirement' });
  }
};

// Bulk update location equipment requirements
export const bulkUpdateLocationEquipmentRequirements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id, 10);
    const { requirements } = req.body;

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Delete existing requirements and create new ones
    await prisma.$transaction(async (tx) => {
      await tx.locationEquipmentRequirement.deleteMany({
        where: { locationId }
      });

      if (requirements && requirements.length > 0) {
        await tx.locationEquipmentRequirement.createMany({
          data: requirements.map((req: { dayOfWeek: number; equipmentType: string; minCount?: number; maxCount?: number; effectiveDate?: string; expirationDate?: string; seasonalNote?: string }) => ({
            locationId,
            dayOfWeek: req.dayOfWeek,
            equipmentType: req.equipmentType,
            minCount: req.minCount || 0,
            maxCount: req.maxCount || null,
            effectiveDate: req.effectiveDate ? new Date(req.effectiveDate) : null,
            expirationDate: req.expirationDate ? new Date(req.expirationDate) : null,
            seasonalNote: req.seasonalNote
          }))
        });
      }
    });

    const updatedRequirements = await prisma.locationEquipmentRequirement.findMany({
      where: { locationId },
      orderBy: { dayOfWeek: 'asc' }
    });

    return res.json(updatedRequirements);
  } catch (error) {
    console.error('Bulk update location equipment requirements error:', error);
    return res.status(500).json({ message: 'Failed to update location equipment requirements' });
  }
};

// Delete location equipment requirement
export const deleteLocationEquipmentRequirement = async (req: Request, res: Response) => {
  try {
    const { id, requirementId } = req.params;
    const locationId = parseInt(id, 10);
    const reqId = parseInt(requirementId, 10);

    const requirement = await prisma.locationEquipmentRequirement.findFirst({
      where: {
        id: reqId,
        locationId
      }
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Equipment requirement not found' });
    }

    await prisma.locationEquipmentRequirement.delete({
      where: { id: reqId }
    });

    return res.json({ message: 'Equipment requirement deleted successfully' });
  } catch (error) {
    console.error('Delete location equipment requirement error:', error);
    return res.status(500).json({ message: 'Failed to delete location equipment requirement' });
  }
};

// Get equipment availability vs requirements for a location
export const getLocationEquipmentAvailability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const locationId = parseInt(id, 10);
    const { date } = req.query;

    const location = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }

    // Get the day of week (0 = Sunday, 6 = Saturday)
    const targetDate = date ? new Date(date as string) : new Date();
    const dayOfWeek = targetDate.getDay();

    // Get requirements for this day
    const requirements = await prisma.locationEquipmentRequirement.findMany({
      where: {
        locationId,
        dayOfWeek
      }
    });

    // Get current available counts using new Location FK
    const [availableTrucks, availableTrailers, availableDollies, availableDrivers] = await Promise.all([
      prisma.equipmentTruck.count({
        where: {
          currentLocationId: locationId,
          status: 'AVAILABLE'
        }
      }),
      prisma.equipmentTrailer.count({
        where: {
          currentLocationId: locationId,
          status: 'AVAILABLE'
        }
      }),
      prisma.equipmentDolly.count({
        where: {
          currentLocationId: locationId,
          status: 'AVAILABLE'
        }
      }),
      prisma.carrierDriver.count({
        where: {
          currentTerminalCode: location.code,
          driverStatus: 'AVAILABLE',
          active: true
        }
      })
    ]);

    // Group requirements by equipment type
    const requirementsByType: Record<string, { minCount: number; maxCount: number | null }> = {};
    for (const req of requirements) {
      requirementsByType[req.equipmentType] = {
        minCount: req.minCount,
        maxCount: req.maxCount
      };
    }

    return res.json({
      location: {
        id: location.id,
        code: location.code,
        name: location.name
      },
      date: targetDate.toISOString().split('T')[0],
      dayOfWeek,
      requirements: requirementsByType,
      available: {
        trucks: availableTrucks,
        trailers: availableTrailers,
        dollies: availableDollies,
        drivers: availableDrivers
      },
      variance: {
        trucks: availableTrucks - (requirementsByType['truck']?.minCount || 0),
        trailers: availableTrailers - (requirementsByType['trailer_53']?.minCount || 0) - (requirementsByType['trailer_28']?.minCount || 0),
        dollies: availableDollies - (requirementsByType['dolly_a']?.minCount || 0) - (requirementsByType['dolly_b']?.minCount || 0)
      }
    });
  } catch (error) {
    console.error('Get location equipment availability error:', error);
    return res.status(500).json({ message: 'Failed to fetch location equipment availability' });
  }
};