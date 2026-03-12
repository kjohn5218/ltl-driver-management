/**
 * TMS Controller
 *
 * API endpoints for TMS integration operations
 */

import { Request, Response } from 'express';
import { tmsService } from '../services/tms.service';

/**
 * Get TMS integration status and health
 * GET /api/tms/status
 */
export const getTmsStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const health = await tmsService.healthCheck();

    res.json({
      configured: health.configured,
      connected: health.connected,
      version: health.version,
      error: health.error,
      mode: health.configured ? 'live' : 'mock',
    });
  } catch (error) {
    console.error('Error checking TMS status:', error);
    res.status(500).json({ message: 'Failed to check TMS status' });
  }
};

/**
 * Get expected lane volumes for planning
 * GET /api/tms/lane-volumes?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&origin=XXX
 */
export const getLaneVolumes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, origin, destination } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required' });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const volumes = await tmsService.getLaneVolumes(
      start,
      end,
      origin as string | undefined,
      destination as string | undefined
    );

    res.json({
      source: tmsService.isConfigured() ? 'tms' : 'mock',
      startDate,
      endDate,
      laneCount: volumes.length,
      volumes,
    });
  } catch (error) {
    console.error('Error fetching lane volumes:', error);
    res.status(500).json({ message: 'Failed to fetch lane volumes' });
  }
};

/**
 * Get aggregated lane volumes
 * GET /api/tms/lane-volumes/aggregated?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&origin=XXX
 */
export const getLaneVolumesAggregated = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, origin } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required' });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const volumes = await tmsService.getLaneVolumesAggregated(
      start,
      end,
      origin as string | undefined
    );

    res.json({
      source: tmsService.isConfigured() ? 'tms' : 'mock',
      startDate,
      endDate,
      laneCount: volumes.length,
      volumes,
    });
  } catch (error) {
    console.error('Error fetching aggregated lane volumes:', error);
    res.status(500).json({ message: 'Failed to fetch aggregated lane volumes' });
  }
};

/**
 * Get detailed shipments for a lane
 * GET /api/tms/lane-shipments?origin=XXX&destination=XXX&date=YYYY-MM-DD
 */
export const getLaneShipmentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { origin, destination, date } = req.query;

    if (!origin || !destination || !date) {
      res.status(400).json({ message: 'origin, destination, and date are required' });
      return;
    }

    const forecastDate = new Date(date as string);

    if (isNaN(forecastDate.getTime())) {
      res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const shipments = await tmsService.getLaneShipmentDetails(
      origin as string,
      destination as string,
      forecastDate
    );

    res.json({
      source: tmsService.isConfigured() ? 'tms' : 'mock',
      origin,
      destination,
      date,
      shipmentCount: shipments.length,
      shipments,
    });
  } catch (error) {
    console.error('Error fetching lane shipment details:', error);
    res.status(500).json({ message: 'Failed to fetch lane shipment details' });
  }
};

/**
 * Get daily summary
 * GET /api/tms/daily-summary?date=YYYY-MM-DD
 */
export const getDailySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query;

    const forecastDate = date ? new Date(date as string) : new Date();

    if (isNaN(forecastDate.getTime())) {
      res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const summary = await tmsService.getDailySummary(forecastDate);

    res.json({
      source: tmsService.isConfigured() ? 'tms' : 'mock',
      date: forecastDate.toISOString().split('T')[0],
      ...summary,
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ message: 'Failed to fetch daily summary' });
  }
};

/**
 * Get manifest/trip data with shipments
 * GET /api/tms/manifest/:manifestNumber
 */
export const getManifest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { manifestNumber } = req.params;

    if (!manifestNumber) {
      res.status(400).json({ message: 'Manifest number is required' });
      return;
    }

    const tripData = await tmsService.getTripData(0, manifestNumber);

    res.json({
      source: tmsService.isConfigured() ? 'tms' : 'mock',
      ...tripData,
    });
  } catch (error) {
    console.error('Error fetching manifest:', error);
    res.status(500).json({ message: 'Failed to fetch manifest' });
  }
};
