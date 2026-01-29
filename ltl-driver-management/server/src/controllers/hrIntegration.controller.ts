import { Request, Response } from 'express';
import { prisma } from '../index';

interface DriverSyncData {
  externalDriverId: string;
  carrierId: number;
  name: string;
  phoneNumber?: string;
  email?: string;
  number?: string;
  licenseNumber?: string;
  licenseClass?: string;
  licenseState?: string;
  licenseExpiration?: string;
  medicalCardExpiration?: string;
  dateOfHire?: string;
  dateOfBirth?: string;
  endorsements?: string;
  active?: boolean;
}

/**
 * Sync a single driver from HR system.
 * Creates a new driver if not found, updates if exists (matched by externalDriverId).
 */
export const syncDriver = async (req: Request, res: Response): Promise<Response> => {
  try {
    const driverData: DriverSyncData = req.body;

    // Verify carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id: driverData.carrierId }
    });

    if (!carrier) {
      return res.status(400).json({
        success: false,
        message: `Carrier with ID ${driverData.carrierId} not found`
      });
    }

    // Check if driver already exists by externalDriverId
    const existingDriver = await prisma.carrierDriver.findFirst({
      where: { externalDriverId: driverData.externalDriverId }
    });

    // Prepare data for create/update
    const driverPayload = {
      carrierId: driverData.carrierId,
      name: driverData.name,
      externalDriverId: driverData.externalDriverId,
      ...(driverData.phoneNumber !== undefined && { phoneNumber: driverData.phoneNumber }),
      ...(driverData.email !== undefined && { email: driverData.email }),
      ...(driverData.number !== undefined && { number: driverData.number }),
      ...(driverData.licenseNumber !== undefined && { licenseNumber: driverData.licenseNumber }),
      ...(driverData.licenseClass !== undefined && { licenseClass: driverData.licenseClass }),
      ...(driverData.licenseState !== undefined && { licenseState: driverData.licenseState }),
      ...(driverData.licenseExpiration && { licenseExpiration: new Date(driverData.licenseExpiration) }),
      ...(driverData.medicalCardExpiration && { medicalCardExpiration: new Date(driverData.medicalCardExpiration) }),
      ...(driverData.dateOfHire && { dateOfHire: new Date(driverData.dateOfHire) }),
      ...(driverData.dateOfBirth && { dateOfBirth: new Date(driverData.dateOfBirth) }),
      ...(driverData.endorsements !== undefined && { endorsements: driverData.endorsements }),
      ...(driverData.active !== undefined && { active: driverData.active })
    };

    let driver;
    let action: 'created' | 'updated';

    if (existingDriver) {
      // Update existing driver
      driver = await prisma.carrierDriver.update({
        where: { id: existingDriver.id },
        data: driverPayload,
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
      action = 'updated';
    } else {
      // Create new driver
      driver = await prisma.carrierDriver.create({
        data: driverPayload,
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
      action = 'created';
    }

    const statusCode = action === 'created' ? 201 : 200;
    return res.status(statusCode).json({
      success: true,
      action,
      driver
    });
  } catch (error) {
    console.error('Error syncing driver from HR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync driver'
    });
  }
};

/**
 * Sync multiple drivers from HR system in batch.
 * Creates new drivers if not found, updates if exists (matched by externalDriverId).
 */
export const syncDriversBatch = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { drivers } = req.body as { drivers: DriverSyncData[] };

    if (!Array.isArray(drivers) || drivers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'drivers array is required and must not be empty'
      });
    }

    // Limit batch size to prevent timeouts
    if (drivers.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Batch size cannot exceed 500 drivers'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { externalDriverId: string; error: string }[]
    };

    // Get all unique carrier IDs and validate they exist
    const carrierIds = [...new Set(drivers.map(d => d.carrierId))];
    const existingCarriers = await prisma.carrier.findMany({
      where: { id: { in: carrierIds } },
      select: { id: true }
    });
    const validCarrierIds = new Set(existingCarriers.map(c => c.id));

    // Get existing drivers by externalDriverId
    const externalIds = drivers.map(d => d.externalDriverId);
    const existingDrivers = await prisma.carrierDriver.findMany({
      where: { externalDriverId: { in: externalIds } }
    });
    const existingDriverMap = new Map(
      existingDrivers.map(d => [d.externalDriverId, d])
    );

    // Process each driver
    for (const driverData of drivers) {
      try {
        // Validate carrier exists
        if (!validCarrierIds.has(driverData.carrierId)) {
          results.errors.push({
            externalDriverId: driverData.externalDriverId,
            error: `Carrier with ID ${driverData.carrierId} not found`
          });
          continue;
        }

        const driverPayload = {
          carrierId: driverData.carrierId,
          name: driverData.name,
          externalDriverId: driverData.externalDriverId,
          ...(driverData.phoneNumber !== undefined && { phoneNumber: driverData.phoneNumber }),
          ...(driverData.email !== undefined && { email: driverData.email }),
          ...(driverData.number !== undefined && { number: driverData.number }),
          ...(driverData.licenseNumber !== undefined && { licenseNumber: driverData.licenseNumber }),
          ...(driverData.licenseClass !== undefined && { licenseClass: driverData.licenseClass }),
          ...(driverData.licenseState !== undefined && { licenseState: driverData.licenseState }),
          ...(driverData.licenseExpiration && { licenseExpiration: new Date(driverData.licenseExpiration) }),
          ...(driverData.medicalCardExpiration && { medicalCardExpiration: new Date(driverData.medicalCardExpiration) }),
          ...(driverData.dateOfHire && { dateOfHire: new Date(driverData.dateOfHire) }),
          ...(driverData.dateOfBirth && { dateOfBirth: new Date(driverData.dateOfBirth) }),
          ...(driverData.endorsements !== undefined && { endorsements: driverData.endorsements }),
          ...(driverData.active !== undefined && { active: driverData.active })
        };

        const existingDriver = existingDriverMap.get(driverData.externalDriverId);

        if (existingDriver) {
          await prisma.carrierDriver.update({
            where: { id: existingDriver.id },
            data: driverPayload
          });
          results.updated++;
        } else {
          await prisma.carrierDriver.create({
            data: driverPayload
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({
          externalDriverId: driverData.externalDriverId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error batch syncing drivers from HR:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to batch sync drivers'
    });
  }
};
