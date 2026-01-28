import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getExpectedShipments,
  getExpectedShipmentsFromTMS,
  getLaneShipmentDetails,
  getDailySummary,
  syncFromTMS,
  upsertExpectedShipment,
  deleteExpectedShipments
} from '../controllers/expectedShipment.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get expected shipments from database
router.get(
  '/',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('originTerminalCode').optional().isString(),
    query('destinationTerminalCode').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 }),
    validateRequest
  ],
  getExpectedShipments
);

// Get expected shipments from TMS (mock service)
router.get(
  '/tms',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('originTerminalCode').optional().isString(),
    query('destinationTerminalCode').optional().isString(),
    query('aggregated').optional().isIn(['true', 'false']),
    validateRequest
  ],
  getExpectedShipmentsFromTMS
);

// Get daily summary
router.get(
  '/summary',
  [
    query('date').optional().isISO8601(),
    validateRequest
  ],
  getDailySummary
);

// Get lane shipment details
router.get(
  '/lane/:origin/:destination/:date',
  [
    param('origin').isString().isLength({ min: 2, max: 5 }),
    param('destination').isString().isLength({ min: 2, max: 5 }),
    param('date').isISO8601(),
    validateRequest
  ],
  getLaneShipmentDetails
);

// Sync from TMS (Admin/Dispatcher only)
router.post(
  '/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncFromTMS
);

// Upsert expected shipment (Admin/Dispatcher only)
router.put(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('forecastDate').isISO8601().withMessage('Forecast date is required'),
    body('originTerminalCode').notEmpty().withMessage('Origin terminal code is required'),
    body('destinationTerminalCode').notEmpty().withMessage('Destination terminal code is required'),
    body('expectedShipmentCount').optional().isInt({ min: 0 }),
    body('expectedPieces').optional().isInt({ min: 0 }),
    body('expectedWeight').optional().isInt({ min: 0 }),
    body('guaranteedCount').optional().isInt({ min: 0 }),
    body('standardCount').optional().isInt({ min: 0 }),
    body('expeditedCount').optional().isInt({ min: 0 }),
    body('hazmatCount').optional().isInt({ min: 0 }),
    body('dataSource').optional().isIn(['TMS', 'WMS', 'MANUAL']),
    body('confidenceLevel').optional().isIn(['HIGH', 'MEDIUM', 'LOW']),
    validateRequest
  ],
  upsertExpectedShipment
);

// Delete expected shipments (Admin only)
router.delete(
  '/',
  authorize(UserRole.ADMIN),
  [
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('originTerminalCode').optional().isString(),
    validateRequest
  ],
  deleteExpectedShipments
);

export default router;
