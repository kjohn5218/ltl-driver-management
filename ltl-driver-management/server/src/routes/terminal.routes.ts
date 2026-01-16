import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getTerminals,
  getTerminalById,
  getTerminalByCode,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  getTerminalEquipmentSummary,
  getTerminalsList,
  getTerminalEquipmentRequirements,
  upsertTerminalEquipmentRequirement,
  bulkUpdateTerminalEquipmentRequirements,
  deleteTerminalEquipmentRequirement,
  getTerminalEquipmentAvailability
} from '../controllers/terminal.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get simple list of terminals for dropdowns
router.get('/list', getTerminalsList);

// Get all terminals with filtering and pagination
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('active').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getTerminals
);

// Get terminal by code (must come before /:id)
router.get(
  '/code/:code',
  [
    param('code').notEmpty().trim().toUpperCase()
  ],
  validateRequest,
  getTerminalByCode
);

// Get terminal by ID
router.get(
  '/:id',
  [
    param('id').isInt({ min: 1 })
  ],
  validateRequest,
  getTerminalById
);

// Get terminal equipment summary
router.get(
  '/:id/equipment-summary',
  [
    param('id').isInt({ min: 1 })
  ],
  validateRequest,
  getTerminalEquipmentSummary
);

// Create new terminal (Admin/Dispatcher/Yard Manager only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    body('code').notEmpty().trim().isLength({ min: 2, max: 10 }).toUpperCase(),
    body('name').notEmpty().trim(),
    body('address').optional().trim(),
    body('city').notEmpty().trim(),
    body('state').notEmpty().trim().isLength({ min: 2, max: 2 }).toUpperCase(),
    body('zipCode').optional().trim(),
    body('country').optional().trim(),
    body('latitude').optional().isDecimal(),
    body('longitude').optional().isDecimal(),
    body('timezone').optional().trim(),
    body('contactName').optional().trim(),
    body('contactPhone').optional().trim(),
    body('contactEmail').optional().isEmail().normalizeEmail(),
    body('operatingHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('operatingHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  createTerminal
);

// Update terminal (Admin/Dispatcher/Yard Manager only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('code').optional().trim().isLength({ min: 2, max: 10 }).toUpperCase(),
    body('name').optional().notEmpty().trim(),
    body('address').optional().trim(),
    body('city').optional().notEmpty().trim(),
    body('state').optional().trim().isLength({ min: 2, max: 2 }).toUpperCase(),
    body('zipCode').optional().trim(),
    body('country').optional().trim(),
    body('latitude').optional().isDecimal(),
    body('longitude').optional().isDecimal(),
    body('timezone').optional().trim(),
    body('contactName').optional().trim(),
    body('contactPhone').optional().trim(),
    body('contactEmail').optional().isEmail().normalizeEmail(),
    body('operatingHoursStart').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('operatingHoursEnd').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  updateTerminal
);

// Delete terminal (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  [
    param('id').isInt({ min: 1 })
  ],
  validateRequest,
  deleteTerminal
);

// ==================== EQUIPMENT REQUIREMENTS ====================

// Get terminal equipment requirements
router.get(
  '/:id/requirements',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTerminalEquipmentRequirements
);

// Get terminal equipment availability vs requirements
router.get(
  '/:id/availability',
  [
    param('id').isInt({ min: 1 }),
    query('date').optional().isISO8601()
  ],
  validateRequest,
  getTerminalEquipmentAvailability
);

// Create or update single equipment requirement
router.post(
  '/:id/requirements',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('dayOfWeek').isInt({ min: 0, max: 6 }),
    body('trucksRequired').optional().isInt({ min: 0 }),
    body('trailersRequired').optional().isInt({ min: 0 }),
    body('dolliesRequired').optional().isInt({ min: 0 }),
    body('driversRequired').optional().isInt({ min: 0 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  upsertTerminalEquipmentRequirement
);

// Bulk update equipment requirements
router.put(
  '/:id/requirements',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('requirements').isArray(),
    body('requirements.*.dayOfWeek').isInt({ min: 0, max: 6 }),
    body('requirements.*.trucksRequired').optional().isInt({ min: 0 }),
    body('requirements.*.trailersRequired').optional().isInt({ min: 0 }),
    body('requirements.*.dolliesRequired').optional().isInt({ min: 0 }),
    body('requirements.*.driversRequired').optional().isInt({ min: 0 }),
    body('requirements.*.notes').optional().trim()
  ],
  validateRequest,
  bulkUpdateTerminalEquipmentRequirements
);

// Delete equipment requirement
router.delete(
  '/:id/requirements/:requirementId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    param('requirementId').isInt({ min: 1 })
  ],
  validateRequest,
  deleteTerminalEquipmentRequirement
);

export default router;
