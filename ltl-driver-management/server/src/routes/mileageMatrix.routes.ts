import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getMileageEntries,
  getMileageById,
  lookupMileage,
  createMileageEntry,
  bulkCreateOrUpdate,
  updateMileageEntry,
  deleteMileageEntry,
  getTerminalCodes,
  autoPopulateFromLocations
} from '../controllers/mileageMatrix.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/mileage-matrix - Get all entries with pagination and filtering
router.get('/', getMileageEntries);

// GET /api/mileage-matrix/lookup - Lookup mileage for a specific route
router.get(
  '/lookup',
  [
    query('origin').isString().notEmpty().withMessage('Origin is required'),
    query('destination').isString().notEmpty().withMessage('Destination is required')
  ],
  validateRequest,
  lookupMileage
);

// GET /api/mileage-matrix/terminal-codes - Get all unique terminal codes
router.get('/terminal-codes', getTerminalCodes);

// GET /api/mileage-matrix/:id - Get single entry by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid ID is required')],
  validateRequest,
  getMileageById
);

// POST /api/mileage-matrix - Create new entry (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('originCode').isString().notEmpty().withMessage('Origin code is required'),
    body('destinationCode').isString().notEmpty().withMessage('Destination code is required'),
    body('miles').isFloat({ min: 0 }).withMessage('Miles must be a positive number'),
    body('notes').optional().isString()
  ],
  validateRequest,
  createMileageEntry
);

// POST /api/mileage-matrix/bulk - Bulk create/update entries (Admin/Dispatcher only)
router.post(
  '/bulk',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('entries').isArray({ min: 1 }).withMessage('Entries array is required'),
    body('entries.*.originCode').isString().notEmpty().withMessage('Origin code is required'),
    body('entries.*.destinationCode').isString().notEmpty().withMessage('Destination code is required'),
    body('entries.*.miles').isFloat({ min: 0 }).withMessage('Miles must be a positive number')
  ],
  validateRequest,
  bulkCreateOrUpdate
);

// POST /api/mileage-matrix/auto-populate - Auto-populate from location GPS coordinates (Admin/Dispatcher only)
router.post(
  '/auto-populate',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('roadFactor').optional().isFloat({ min: 1.0, max: 2.0 }).withMessage('Road factor must be between 1.0 and 2.0'),
    body('overwriteExisting').optional().isBoolean()
  ],
  validateRequest,
  autoPopulateFromLocations
);

// PUT /api/mileage-matrix/:id - Update entry (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }).withMessage('Valid ID is required'),
    body('originCode').optional().isString().notEmpty(),
    body('destinationCode').optional().isString().notEmpty(),
    body('miles').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  updateMileageEntry
);

// DELETE /api/mileage-matrix/:id - Delete entry (Admin/Dispatcher only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [param('id').isInt({ min: 1 }).withMessage('Valid ID is required')],
  validateRequest,
  deleteMileageEntry
);

export default router;
