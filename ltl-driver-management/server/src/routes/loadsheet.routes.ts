import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getLoadsheets,
  getLoadsheetById,
  getLoadsheetByManifest,
  createLoadsheet,
  updateLoadsheet,
  closeLoadsheet,
  downloadLoadsheet,
  deleteLoadsheet,
  checkDuplicateLoadsheets,
  getLoadsheetShipments
} from '../controllers/loadsheet.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/loadsheets - List all loadsheets with filtering
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('status').optional().isIn(['DRAFT', 'OPEN', 'LOADING', 'CLOSED', 'DISPATCHED', 'UNLOADED', 'TERMINATED']),
    query('linehaulTripId').optional().isInt({ min: 1 }),
    query('originTerminalId').optional().isInt({ min: 1 }),
    query('originTerminalCode').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getLoadsheets
);

// GET /api/loadsheets/manifest/:manifestNumber - Get by manifest number
// This route must come before /:id to avoid conflicts
router.get(
  '/manifest/:manifestNumber',
  [param('manifestNumber').notEmpty().trim()],
  validateRequest,
  getLoadsheetByManifest
);

// GET /api/loadsheets/:id - Get single loadsheet
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getLoadsheetById
);

// GET /api/loadsheets/:id/download - Download as PDF
router.get(
  '/:id/download',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  downloadLoadsheet
);

// GET /api/loadsheets/:id/shipments - Get shipments loaded to a loadsheet
router.get(
  '/:id/shipments',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getLoadsheetShipments
);

// POST /api/loadsheets/check-duplicates - Check for existing loadsheets with same trailer/location
router.post(
  '/check-duplicates',
  [
    body('trailerNumber').notEmpty().trim().withMessage('Trailer number is required'),
    body('originTerminalCode').notEmpty().trim().withMessage('Origin terminal code is required')
  ],
  validateRequest,
  checkDuplicateLoadsheets
);

// POST /api/loadsheets - Create new loadsheet
router.post(
  '/',
  [
    body('trailerNumber').notEmpty().trim().withMessage('Trailer number is required'),
    body('linehaulName').notEmpty().trim().withMessage('Linehaul name is required'),
    body('originTerminalId').optional().isInt({ min: 1 }),
    body('linehaulTripId').optional().isInt({ min: 1 }),
    body('suggestedTrailerLength').optional().isInt({ min: 1 }),
    body('pintleHookRequired').optional().isBoolean(),
    body('targetDispatchTime').optional().trim(),
    body('scheduledDepartDate').optional().trim(),
    body('loadType').optional().isIn(['PURE', 'MIX'])
  ],
  validateRequest,
  createLoadsheet
);

// PUT /api/loadsheets/:id - Update loadsheet
router.put(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  updateLoadsheet
);

// PATCH /api/loadsheets/:id/close - Close loadsheet
router.patch(
  '/:id/close',
  [
    param('id').isInt({ min: 1 }),
    body('sealNumber').optional().trim()
  ],
  validateRequest,
  closeLoadsheet
);

// DELETE /api/loadsheets/:id - Delete loadsheet (draft only)
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteLoadsheet
);

export default router;
