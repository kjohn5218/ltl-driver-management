import { Request, Response } from 'express';
import { prisma } from '../index';

export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          fuelSurchargeRate: 0.00
        }
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Get system settings error:', error);
    return res.status(500).json({ message: 'Failed to fetch system settings' });
  }
};

export const updateFuelSurchargeRate = async (req: Request, res: Response) => {
  try {
    const { fuelSurchargeRate } = req.body;
    const userId = (req as any).user?.id;

    // Get or create settings record
    let settings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (settings) {
      // Update existing settings
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          fuelSurchargeRate: parseFloat(fuelSurchargeRate),
          updatedBy: userId
        }
      });
    } else {
      // Create new settings record
      settings = await prisma.systemSettings.create({
        data: {
          fuelSurchargeRate: parseFloat(fuelSurchargeRate),
          updatedBy: userId
        }
      });
    }

    return res.json(settings);
  } catch (error) {
    console.error('Update fuel surcharge rate error:', error);
    return res.status(500).json({ message: 'Failed to update fuel surcharge rate' });
  }
};