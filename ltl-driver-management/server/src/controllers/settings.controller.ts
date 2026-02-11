import { Request, Response } from 'express';
import { prisma } from '../index';
import { isFuelPriceConfigured } from '../config/fuelPrice.config';
import { getFuelPriceService } from '../services/fuelPrice.service';

export const getSystemSettings = async (_req: Request, res: Response) => {
  try {
    let settings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          fuelSurchargeRate: 0.00,
          fuelSurchargeSource: 'manual'
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
      // Update existing settings (manual entry)
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          fuelSurchargeRate: parseFloat(fuelSurchargeRate),
          fuelSurchargeSource: 'manual',
          fuelSurchargeExternalId: null,
          updatedBy: userId
        }
      });
    } else {
      // Create new settings record
      settings = await prisma.systemSettings.create({
        data: {
          fuelSurchargeRate: parseFloat(fuelSurchargeRate),
          fuelSurchargeSource: 'manual',
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

// External API endpoint to receive fuel surcharge from outside source
export const updateFuelSurchargeExternal = async (req: Request, res: Response) => {
  try {
    const { fuelSurchargeRate, externalId, source } = req.body;

    // Validate rate
    const rate = parseFloat(fuelSurchargeRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'Invalid fuel surcharge rate. Must be between 0 and 100.' });
    }

    // Get or create settings record
    let settings = await prisma.systemSettings.findFirst({
      orderBy: { id: 'desc' }
    });

    if (settings) {
      // Update existing settings from external source
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          fuelSurchargeRate: rate,
          fuelSurchargeSource: 'external',
          fuelSurchargeExternalId: externalId || source || 'external-api'
        }
      });
    } else {
      // Create new settings record
      settings = await prisma.systemSettings.create({
        data: {
          fuelSurchargeRate: rate,
          fuelSurchargeSource: 'external',
          fuelSurchargeExternalId: externalId || source || 'external-api'
        }
      });
    }

    return res.json({
      success: true,
      fuelSurchargeRate: settings.fuelSurchargeRate,
      source: settings.fuelSurchargeSource,
      externalId: settings.fuelSurchargeExternalId,
      updatedAt: settings.updatedAt
    });
  } catch (error) {
    console.error('External fuel surcharge update error:', error);
    return res.status(500).json({ message: 'Failed to update fuel surcharge rate' });
  }
};

// Sync fuel surcharge from external fuel price API
export const syncFuelSurcharge = async (req: Request, res: Response) => {
  try {
    // Check if fuel price API is configured
    if (!isFuelPriceConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Fuel Price API is not configured. Please set FUEL_PRICE_API_URL in environment variables.'
      });
    }

    const { effectiveDate } = req.query;
    const dateParam = effectiveDate ? String(effectiveDate) : undefined;

    const service = getFuelPriceService();
    const result = await service.syncFuelSurcharge(dateParam);

    if (result.success) {
      return res.json({
        success: true,
        previousRate: result.previousRate,
        newRate: result.newRate,
        source: result.source,
        effectiveDate: result.effectiveDate,
        syncedAt: result.syncedAt
      });
    } else {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to sync fuel surcharge',
        effectiveDate: result.effectiveDate,
        syncedAt: result.syncedAt
      });
    }
  } catch (error) {
    console.error('Sync fuel surcharge error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: `Failed to sync fuel surcharge: ${message}`
    });
  }
};

// Get fuel price sync status
export const getFuelPriceSyncStatus = async (_req: Request, res: Response) => {
  try {
    const configured = isFuelPriceConfigured();

    if (!configured) {
      return res.json({
        configured: false,
        message: 'Fuel Price API is not configured'
      });
    }

    const service = getFuelPriceService();
    const status = service.getSyncStatus();
    const currentRate = await service.getCurrentRate();

    return res.json({
      configured: true,
      currentRate: currentRate?.rate,
      source: currentRate?.source,
      lastUpdated: currentRate?.updatedAt,
      lastSyncAt: status.lastSyncAt,
      lastSyncResult: status.lastResult
    });
  } catch (error) {
    console.error('Get fuel price sync status error:', error);
    return res.status(500).json({ message: 'Failed to get fuel price sync status' });
  }
};