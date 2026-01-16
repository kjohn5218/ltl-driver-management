import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getRateCards,
  getRateCardById,
  createRateCard,
  updateRateCard,
  deleteRateCard,
  getApplicableRate,
  getAccessorialRates,
  addAccessorialRate,
  updateAccessorialRate,
  deleteAccessorialRate,
  bulkUpdateAccessorialRates
} from '../controllers/rateCard.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get applicable rate (for calculating trip pay)
router.get(
  '/applicable',
  [
    query('driverId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('profileId').optional().isInt({ min: 1 }),
    query('originTerminalId').optional().isInt({ min: 1 }),
    query('destinationTerminalId').optional().isInt({ min: 1 })
  ],
  validateRequest,
  getApplicableRate
);

// Get all rate cards
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('type').optional().isIn(['DRIVER', 'CARRIER', 'LINEHAUL', 'OD_PAIR', 'DEFAULT']),
    query('active').optional().isBoolean(),
    query('driverId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('profileId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getRateCards
);

// Get rate card by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getRateCardById
);

// Create rate card (Admin/Payroll Admin only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('rateType').notEmpty().isIn(['DRIVER', 'CARRIER', 'LINEHAUL', 'OD_PAIR', 'DEFAULT']),
    body('entityId').optional().isInt({ min: 1 }),
    body('linehaulProfileId').optional().isInt({ min: 1 }),
    body('originTerminalId').optional().isInt({ min: 1 }),
    body('destinationTerminalId').optional().isInt({ min: 1 }),
    body('rateMethod').notEmpty().isIn(['PER_MILE', 'FLAT_RATE', 'HOURLY', 'PERCENTAGE']),
    body('rateAmount').notEmpty().isDecimal(),
    body('minimumAmount').optional().isDecimal(),
    body('maximumAmount').optional().isDecimal(),
    body('effectiveDate').notEmpty().isISO8601(),
    body('expirationDate').optional().isISO8601(),
    body('equipmentType').optional().trim(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('notes').optional().trim(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  createRateCard
);

// Update rate card (Admin/Payroll Admin only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    body('rateMethod').optional().isIn(['PER_MILE', 'FLAT_RATE', 'HOURLY', 'PERCENTAGE']),
    body('rateAmount').optional().isDecimal(),
    body('minimumAmount').optional().isDecimal(),
    body('maximumAmount').optional().isDecimal(),
    body('effectiveDate').optional().isISO8601(),
    body('expirationDate').optional().isISO8601(),
    body('equipmentType').optional().trim(),
    body('priority').optional().isInt({ min: 1, max: 10 }),
    body('notes').optional().trim(),
    body('active').optional().isBoolean()
  ],
  validateRequest,
  updateRateCard
);

// Delete rate card (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteRateCard
);

// ==================== ACCESSORIAL RATES ====================

// Get accessorial rates for a rate card
router.get(
  '/:rateCardId/accessorials',
  [param('rateCardId').isInt({ min: 1 })],
  validateRequest,
  getAccessorialRates
);

// Add accessorial rate (Admin/Payroll Admin only)
router.post(
  '/:rateCardId/accessorials',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('rateCardId').isInt({ min: 1 }),
    body('type').notEmpty().isIn([
      'LAYOVER',
      'DETENTION',
      'BREAKDOWN',
      'HELPER',
      'TRAINER',
      'HAZMAT',
      'TEAM_DRIVER',
      'STOP_CHARGE',
      'FUEL_SURCHARGE',
      'OTHER'
    ]),
    body('description').optional().trim(),
    body('rateAmount').notEmpty().isDecimal(),
    body('rateUnit').optional().trim(),
    body('minimumCharge').optional().isDecimal(),
    body('maximumCharge').optional().isDecimal()
  ],
  validateRequest,
  addAccessorialRate
);

// Bulk update accessorial rates (Admin/Payroll Admin only)
router.put(
  '/:rateCardId/accessorials',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('rateCardId').isInt({ min: 1 }),
    body('rates').isArray(),
    body('rates.*.type').notEmpty().isIn([
      'LAYOVER',
      'DETENTION',
      'BREAKDOWN',
      'HELPER',
      'TRAINER',
      'HAZMAT',
      'TEAM_DRIVER',
      'STOP_CHARGE',
      'FUEL_SURCHARGE',
      'OTHER'
    ]),
    body('rates.*.rateAmount').notEmpty().isDecimal()
  ],
  validateRequest,
  bulkUpdateAccessorialRates
);

// Update accessorial rate (Admin/Payroll Admin only)
router.put(
  '/:rateCardId/accessorials/:rateId',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('rateCardId').isInt({ min: 1 }),
    param('rateId').isInt({ min: 1 }),
    body('description').optional().trim(),
    body('rateAmount').optional().isDecimal(),
    body('rateUnit').optional().trim(),
    body('minimumCharge').optional().isDecimal(),
    body('maximumCharge').optional().isDecimal()
  ],
  validateRequest,
  updateAccessorialRate
);

// Delete accessorial rate (Admin/Payroll Admin only)
router.delete(
  '/:rateCardId/accessorials/:rateId',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('rateCardId').isInt({ min: 1 }),
    param('rateId').isInt({ min: 1 })
  ],
  validateRequest,
  deleteAccessorialRate
);

export default router;
