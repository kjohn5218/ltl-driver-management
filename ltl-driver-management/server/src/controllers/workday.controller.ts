import { Request, Response } from 'express';
import { prisma } from '../index';

// Note: This is a mock implementation for Workday integration.
// In production, this would make actual API calls to Workday.

// Get all Workday paycodes
export const getWorkdayPaycodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { payType, trailerConfig, isCutPay, active } = req.query;

    const where: any = {};

    if (payType) {
      where.payType = payType as string;
    }

    if (trailerConfig) {
      where.trailerConfig = trailerConfig as string;
    }

    if (isCutPay !== undefined) {
      where.isCutPay = isCutPay === 'true';
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const paycodes = await prisma.workdayPaycode.findMany({
      where,
      orderBy: [{ payType: 'asc' }, { trailerConfig: 'asc' }]
    });

    res.json(paycodes);
  } catch (error) {
    console.error('Error fetching Workday paycodes:', error);
    res.status(500).json({ message: 'Failed to fetch Workday paycodes' });
  }
};

// Get paycode mapping for a specific pay type and trailer config
export const getPaycodeMapping = async (req: Request, res: Response): Promise<void> => {
  try {
    const { payType, trailerConfig, isCutPay } = req.query;

    const where: any = {
      active: true
    };

    if (payType) {
      where.payType = payType as string;
    }

    if (trailerConfig) {
      where.trailerConfig = trailerConfig as string;
    }

    if (isCutPay !== undefined) {
      where.isCutPay = isCutPay === 'true';
    }

    const paycode = await prisma.workdayPaycode.findFirst({
      where
    });

    if (!paycode) {
      res.status(404).json({ message: 'Paycode mapping not found' });
      return;
    }

    res.json(paycode);
  } catch (error) {
    console.error('Error fetching paycode mapping:', error);
    res.status(500).json({ message: 'Failed to fetch paycode mapping' });
  }
};

// Get driver rate info from Workday (mock implementation)
export const getDriverRateInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    const driver = await prisma.carrierDriver.findUnique({
      where: { id: parseInt(driverId, 10) },
      select: {
        id: true,
        name: true,
        number: true,
        workdayEmployeeId: true,
        workdayLastSync: true,
        workdayRateInfo: true
      }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    if (!driver.workdayEmployeeId) {
      res.status(400).json({ message: 'Driver does not have a Workday Employee ID configured' });
      return;
    }

    // In production, this would call the Workday API
    // For now, return stored rate info or mock data
    let rateInfo = driver.workdayRateInfo ? JSON.parse(driver.workdayRateInfo) : null;

    if (!rateInfo) {
      // Mock rate info for demo purposes
      rateInfo = {
        employeeId: driver.workdayEmployeeId,
        payRates: {
          singleMiles: 0.55,
          doubleMiles: 0.65,
          tripleMiles: 0.75,
          singleCutMiles: 0.45,
          doubleCutMiles: 0.55,
          tripleCutMiles: 0.65,
          dropHookSingle: 25.00,
          dropHookDouble: 30.00,
          dropHookTriple: 35.00,
          chainUp: 35.00,
          stopHours: 20.00
        },
        lastUpdated: new Date().toISOString()
      };
    }

    res.json({
      driver: {
        id: driver.id,
        name: driver.name,
        number: driver.number,
        workdayEmployeeId: driver.workdayEmployeeId,
        lastSync: driver.workdayLastSync
      },
      rateInfo
    });
  } catch (error) {
    console.error('Error fetching driver rate info:', error);
    res.status(500).json({ message: 'Failed to fetch driver rate info' });
  }
};

// Sync driver rates from Workday (mock implementation)
export const syncDriverRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverIds } = req.body;

    // Get drivers with Workday IDs
    const where: any = {
      workdayEmployeeId: { not: null }
    };

    if (driverIds && Array.isArray(driverIds) && driverIds.length > 0) {
      where.id = { in: driverIds.map((id: any) => parseInt(id, 10)) };
    }

    const drivers = await prisma.carrierDriver.findMany({
      where,
      select: {
        id: true,
        name: true,
        workdayEmployeeId: true
      }
    });

    if (drivers.length === 0) {
      res.json({
        message: 'No drivers with Workday Employee IDs found',
        synced: 0,
        errors: []
      });
      return;
    }

    const results = {
      synced: 0,
      errors: [] as { driverId: number; name: string; error: string }[]
    };

    // In production, this would batch call the Workday API
    // For now, generate mock rate info for each driver
    for (const driver of drivers) {
      try {
        // Mock rate info - in production this would come from Workday
        const mockRateInfo = {
          employeeId: driver.workdayEmployeeId,
          payRates: {
            singleMiles: 0.55 + Math.random() * 0.1,
            doubleMiles: 0.65 + Math.random() * 0.1,
            tripleMiles: 0.75 + Math.random() * 0.1,
            singleCutMiles: 0.45 + Math.random() * 0.1,
            doubleCutMiles: 0.55 + Math.random() * 0.1,
            tripleCutMiles: 0.65 + Math.random() * 0.1,
            dropHookSingle: 25.00,
            dropHookDouble: 30.00,
            dropHookTriple: 35.00,
            chainUp: 35.00,
            stopHours: 20.00
          },
          lastUpdated: new Date().toISOString()
        };

        await prisma.carrierDriver.update({
          where: { id: driver.id },
          data: {
            workdayRateInfo: JSON.stringify(mockRateInfo),
            workdayLastSync: new Date()
          }
        });

        results.synced++;
      } catch (err: any) {
        results.errors.push({
          driverId: driver.id,
          name: driver.name,
          error: err.message
        });
      }
    }

    res.json({
      message: `Synced ${results.synced} driver(s) from Workday`,
      synced: results.synced,
      errors: results.errors
    });
  } catch (error) {
    console.error('Error syncing driver rates:', error);
    res.status(500).json({ message: 'Failed to sync driver rates from Workday' });
  }
};

// Webhook endpoint for Workday to push rate updates
export const workdayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType, data } = req.body;

    console.log('Workday webhook received:', { eventType, data });

    switch (eventType) {
      case 'RATE_UPDATE':
        // Handle rate update from Workday
        if (data.employeeId && data.rateInfo) {
          const driver = await prisma.carrierDriver.findFirst({
            where: { workdayEmployeeId: data.employeeId }
          });

          if (driver) {
            await prisma.carrierDriver.update({
              where: { id: driver.id },
              data: {
                workdayRateInfo: JSON.stringify(data.rateInfo),
                workdayLastSync: new Date()
              }
            });

            res.json({
              success: true,
              message: `Rate info updated for driver ${driver.name}`
            });
            return;
          }
        }
        res.status(400).json({ success: false, message: 'Invalid rate update data' });
        break;

      case 'EMPLOYEE_CREATED':
      case 'EMPLOYEE_UPDATED':
        // Handle employee sync from Workday
        // This would link Workday employee IDs to our drivers
        res.json({
          success: true,
          message: `Employee event ${eventType} received`
        });
        break;

      default:
        res.status(400).json({
          success: false,
          message: `Unknown event type: ${eventType}`
        });
    }
  } catch (error) {
    console.error('Error processing Workday webhook:', error);
    res.status(500).json({ success: false, message: 'Failed to process webhook' });
  }
};

// Get Workday sync status
export const getWorkdaySyncStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get counts of drivers with/without Workday IDs
    const [totalDrivers, driversWithWorkdayId, recentlySynced] = await Promise.all([
      prisma.carrierDriver.count({ where: { active: true } }),
      prisma.carrierDriver.count({
        where: {
          active: true,
          workdayEmployeeId: { not: null }
        }
      }),
      prisma.carrierDriver.count({
        where: {
          active: true,
          workdayLastSync: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    // Get last sync time
    const lastSyncedDriver = await prisma.carrierDriver.findFirst({
      where: {
        workdayLastSync: { not: null }
      },
      orderBy: { workdayLastSync: 'desc' },
      select: { workdayLastSync: true }
    });

    res.json({
      totalDrivers,
      driversWithWorkdayId,
      driversWithoutWorkdayId: totalDrivers - driversWithWorkdayId,
      recentlySynced,
      lastSyncTime: lastSyncedDriver?.workdayLastSync || null
    });
  } catch (error) {
    console.error('Error fetching Workday sync status:', error);
    res.status(500).json({ message: 'Failed to fetch sync status' });
  }
};

// Update driver Workday Employee ID
export const updateDriverWorkdayId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { workdayEmployeeId } = req.body;

    const driver = await prisma.carrierDriver.findUnique({
      where: { id: parseInt(driverId, 10) }
    });

    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    const updatedDriver = await prisma.carrierDriver.update({
      where: { id: parseInt(driverId, 10) },
      data: {
        workdayEmployeeId: workdayEmployeeId || null
      },
      select: {
        id: true,
        name: true,
        number: true,
        workdayEmployeeId: true,
        workdayLastSync: true
      }
    });

    res.json(updatedDriver);
  } catch (error) {
    console.error('Error updating driver Workday ID:', error);
    res.status(500).json({ message: 'Failed to update Workday Employee ID' });
  }
};
