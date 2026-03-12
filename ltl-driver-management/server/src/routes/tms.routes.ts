/**
 * TMS Routes
 *
 * API routes for TMS (Transportation Management System) integration
 */

import { Router } from 'express';
import { query, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import {
  getTmsStatus,
  getLaneVolumes,
  getLaneVolumesAggregated,
  getLaneShipmentDetails,
  getDailySummary,
  getManifest,
} from '../controllers/tms.controller';

const router = Router();

/**
 * Get TMS integration status
 * GET /api/tms/status
 */
router.get('/status', getTmsStatus);

/**
 * Get expected lane volumes
 * GET /api/tms/lane-volumes?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&origin=XXX&destination=XXX
 */
router.get(
  '/lane-volumes',
  [
    query('startDate').isISO8601().withMessage('startDate must be YYYY-MM-DD format'),
    query('endDate').isISO8601().withMessage('endDate must be YYYY-MM-DD format'),
    query('origin').optional().isString().isLength({ min: 2, max: 10 }),
    query('destination').optional().isString().isLength({ min: 2, max: 10 }),
  ],
  validateRequest,
  getLaneVolumes
);

/**
 * Get aggregated lane volumes
 * GET /api/tms/lane-volumes/aggregated?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&origin=XXX
 */
router.get(
  '/lane-volumes/aggregated',
  [
    query('startDate').isISO8601().withMessage('startDate must be YYYY-MM-DD format'),
    query('endDate').isISO8601().withMessage('endDate must be YYYY-MM-DD format'),
    query('origin').optional().isString().isLength({ min: 2, max: 10 }),
  ],
  validateRequest,
  getLaneVolumesAggregated
);

/**
 * Get detailed shipments for a lane
 * GET /api/tms/lane-shipments?origin=XXX&destination=XXX&date=YYYY-MM-DD
 */
router.get(
  '/lane-shipments',
  [
    query('origin').isString().isLength({ min: 2, max: 10 }).withMessage('origin is required'),
    query('destination').isString().isLength({ min: 2, max: 10 }).withMessage('destination is required'),
    query('date').isISO8601().withMessage('date must be YYYY-MM-DD format'),
  ],
  validateRequest,
  getLaneShipmentDetails
);

/**
 * Get daily summary
 * GET /api/tms/daily-summary?date=YYYY-MM-DD
 */
router.get(
  '/daily-summary',
  [query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD format')],
  validateRequest,
  getDailySummary
);

/**
 * Get manifest data with shipments
 * GET /api/tms/manifest/:manifestNumber
 */
router.get(
  '/manifest/:manifestNumber',
  [param('manifestNumber').isString().isLength({ min: 1, max: 50 }).withMessage('Manifest number is required')],
  validateRequest,
  getManifest
);

export default router;
