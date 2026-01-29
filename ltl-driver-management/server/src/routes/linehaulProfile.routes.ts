import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getLinehaulProfiles,
  getLinehaulProfileById,
  getLinehaulProfileByCode,
  createLinehaulProfile,
  updateLinehaulProfile,
  deleteLinehaulProfile,
  getLinehaulProfilesList,
  getProfilesByTerminal,
  toggleProfileStatus,
  duplicateProfile,
  getOkayToLoadTerminals,
  updateOkayToLoadTerminals,
  getOkayToDispatchTerminals,
  updateOkayToDispatchTerminals
} from '../controllers/linehaulProfile.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get simple list of profiles for dropdowns
router.get('/list', getLinehaulProfilesList);

// Get all profiles with filtering
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('active').optional().isBoolean(),
    query('originTerminalId').optional().isInt({ min: 1 }),
    query('destinationTerminalId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getLinehaulProfiles
);

// Get profile by code (must come before /:id)
router.get(
  '/code/:code',
  [param('code').notEmpty().trim().toUpperCase()],
  validateRequest,
  getLinehaulProfileByCode
);

// Get profiles by terminal
router.get(
  '/terminal/:terminalId',
  [
    param('terminalId').isInt({ min: 1 }),
    query('direction').optional().isIn(['origin', 'destination', 'both'])
  ],
  validateRequest,
  getProfilesByTerminal
);

// Get profile by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getLinehaulProfileById
);

// Create new profile (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('code').notEmpty().trim().isLength({ min: 2, max: 20 }),
    body('name').notEmpty().trim(),
    body('originTerminalId').notEmpty().isInt({ min: 1 }),
    body('destinationTerminalId').notEmpty().isInt({ min: 1 }),
    body('scheduledDeparture').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('scheduledArrival').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('estimatedMiles').optional().isDecimal(),
    body('estimatedDriveTime').optional().isInt({ min: 0 }),
    body('requiredTruckType').optional().isIn(['DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK']),
    body('requiredTrailerType').optional().isIn(['DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL']),
    body('trailerCount').optional().isInt({ min: 1, max: 3 }),
    body('requiresDolly').optional().isBoolean(),
    body('frequencyDays').optional().trim(),
    body('notes').optional().trim(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  createLinehaulProfile
);

// Update profile (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('code').optional().trim().isLength({ min: 2, max: 20 }),
    body('name').optional().notEmpty().trim(),
    body('originTerminalId').optional().isInt({ min: 1 }),
    body('destinationTerminalId').optional().isInt({ min: 1 }),
    body('scheduledDeparture').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('scheduledArrival').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('estimatedMiles').optional().isDecimal(),
    body('estimatedDriveTime').optional().isInt({ min: 0 }),
    body('requiredTruckType').optional().isIn(['DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK']),
    body('requiredTrailerType').optional().isIn(['DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL']),
    body('trailerCount').optional().isInt({ min: 1, max: 3 }),
    body('requiresDolly').optional().isBoolean(),
    body('frequencyDays').optional().trim(),
    body('notes').optional().trim(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  updateLinehaulProfile
);

// Delete profile (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteLinehaulProfile
);

// Toggle profile active status (Admin/Dispatcher only)
router.patch(
  '/:id/toggle-status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  toggleProfileStatus
);

// Duplicate profile (Admin/Dispatcher only)
router.post(
  '/:id/duplicate',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('newCode').notEmpty().trim().isLength({ min: 2, max: 20 }),
    body('newName').optional().trim()
  ],
  validateRequest,
  duplicateProfile
);

// Get okay-to-load terminals for a profile
router.get(
  '/:id/okay-to-load',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getOkayToLoadTerminals
);

// Update okay-to-load terminals for a profile (Admin/Dispatcher only)
router.put(
  '/:id/okay-to-load',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('terminalIds').isArray(),
    body('terminalIds.*').isInt({ min: 1 })
  ],
  validateRequest,
  updateOkayToLoadTerminals
);

// Get okay-to-dispatch terminals for a profile
router.get(
  '/:id/okay-to-dispatch',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getOkayToDispatchTerminals
);

// Update okay-to-dispatch terminals for a profile (Admin/Dispatcher only)
router.put(
  '/:id/okay-to-dispatch',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('terminalIds').isArray(),
    body('terminalIds.*').isInt({ min: 1 })
  ],
  validateRequest,
  updateOkayToDispatchTerminals
);

export default router;
