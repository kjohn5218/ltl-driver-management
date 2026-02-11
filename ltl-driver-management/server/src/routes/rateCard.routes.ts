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
  bulkUpdateAccessorialRates,
  importRateCards,
  importRateCardsExternal,
  getDriversWithRates,
  getCarriersWithRates,
  getProfilesWithRates,
  getDefaultRates,
  updateDefaultRates
} from '../controllers/rateCard.controller';

// All accessorial types including new ones
const ALL_ACCESSORIAL_TYPES = [
  'LAYOVER',
  'DETENTION',
  'BREAKDOWN',
  'HELPER',
  'TRAINER',
  'HAZMAT',
  'TEAM_DRIVER',
  'STOP_CHARGE',
  'FUEL_SURCHARGE',
  'DROP_HOOK',
  'DROP_HOOK_SINGLE',
  'DROP_HOOK_DOUBLE_TRIPLE',
  'CHAIN_UP',
  'WAIT_TIME',
  'SINGLE_TRAILER',
  'DOUBLE_TRAILER',
  'TRIPLE_TRAILER',
  'CUT_PAY',
  'CUT_PAY_SINGLE_MILES',
  'CUT_PAY_DOUBLE_MILES',
  'CUT_PAY_TRIPLE_MILES',
  'OTHER'
];
import { authenticateApiKey } from '../middleware/apiKey.middleware';
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

// Import rate cards from file upload (Admin/Payroll Admin only) - MUST be before /:id
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('rateCards').isArray({ min: 1 }).withMessage('rateCards array is required'),
    body('rateCards.*.rateType').notEmpty().isIn(['DRIVER', 'CARRIER', 'LINEHAUL', 'OD_PAIR', 'DEFAULT']),
    body('rateCards.*.rateMethod').notEmpty().isIn(['PER_MILE', 'FLAT_RATE', 'HOURLY', 'PERCENTAGE']),
    body('rateCards.*.rateAmount').notEmpty().isDecimal(),
    body('rateCards.*.effectiveDate').notEmpty().isISO8601()
  ],
  validateRequest,
  importRateCards
);

// Get drivers with their rate cards - MUST be before /:id
router.get(
  '/drivers-with-rates',
  [
    query('search').optional().trim(),
    query('carrierId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getDriversWithRates
);

// Get carriers with their rate cards - MUST be before /:id
router.get(
  '/carriers-with-rates',
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getCarriersWithRates
);

// Get linehaul profiles with their rate cards - MUST be before /:id
router.get(
  '/profiles-with-rates',
  [
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getProfilesWithRates
);

// Get default rates - MUST be before /:id
router.get(
  '/defaults',
  getDefaultRates
);

// Update default rates (Admin/Payroll Admin only) - MUST be before /:id
router.put(
  '/defaults',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('baseRate').optional().isDecimal(),
    body('rateMethod').optional().isIn(['PER_MILE', 'FLAT_RATE', 'HOURLY', 'PERCENTAGE']),
    body('minimumAmount').optional().isDecimal(),
    body('maximumAmount').optional().isDecimal(),
    body('effectiveDate').optional().isISO8601(),
    body('expirationDate').optional().isISO8601(),
    body('notes').optional().trim(),
    body('dropHook').optional().isObject(),
    body('dropHookSingle').optional().isObject(),
    body('dropHookDoubleTriple').optional().isObject(),
    body('chainUp').optional().isObject(),
    body('fuelSurcharge').optional().isObject(),
    body('waitTime').optional().isObject(),
    body('singleTrailer').optional().isObject(),
    body('doubleTrailer').optional().isObject(),
    body('tripleTrailer').optional().isObject(),
    body('cutPay').optional().isObject(),
    body('cutPaySingleMiles').optional().isObject(),
    body('cutPayDoubleMiles').optional().isObject(),
    body('cutPayTripleMiles').optional().isObject()
  ],
  validateRequest,
  updateDefaultRates
);

// Get rate card by ID - parameterized route must come after specific routes
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
    body('active').optional().isBoolean(),
    // Flattened pay rule fields
    body('prioritize').optional().isBoolean(),
    body('autoArrive').optional().isBoolean(),
    body('perTrip').optional().isDecimal(),
    body('perCutTrip').optional().isDecimal(),
    body('cutMiles').optional().isDecimal(),
    body('cutMilesType').optional().trim(),
    body('perSingleMile').optional().isDecimal(),
    body('perDoubleMile').optional().isDecimal(),
    body('perTripleMile').optional().isDecimal(),
    body('perWorkHour').optional().isDecimal(),
    body('perStopHour').optional().isDecimal(),
    body('perSingleDH').optional().isDecimal(),
    body('perDoubleDH').optional().isDecimal(),
    body('perTripleDH').optional().isDecimal(),
    body('perChainUp').optional().isDecimal(),
    body('fuelSurcharge').optional().isDecimal()
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
    body('active').optional().isBoolean(),
    // Flattened pay rule fields
    body('prioritize').optional().isBoolean(),
    body('autoArrive').optional().isBoolean(),
    body('perTrip').optional().isDecimal(),
    body('perCutTrip').optional().isDecimal(),
    body('cutMiles').optional().isDecimal(),
    body('cutMilesType').optional().trim(),
    body('perSingleMile').optional().isDecimal(),
    body('perDoubleMile').optional().isDecimal(),
    body('perTripleMile').optional().isDecimal(),
    body('perWorkHour').optional().isDecimal(),
    body('perStopHour').optional().isDecimal(),
    body('perSingleDH').optional().isDecimal(),
    body('perDoubleDH').optional().isDecimal(),
    body('perTripleDH').optional().isDecimal(),
    body('perChainUp').optional().isDecimal(),
    body('fuelSurcharge').optional().isDecimal()
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
    body('type').notEmpty().isIn(ALL_ACCESSORIAL_TYPES),
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
    body('rates.*.type').notEmpty().isIn(ALL_ACCESSORIAL_TYPES),
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

// ==================== EXTERNAL API ROUTES ====================
// These routes use API key authentication instead of user authentication

export const externalRateCardRouter = Router();

// External import endpoint for payroll system integration
externalRateCardRouter.post(
  '/import',
  authenticateApiKey,
  [
    body('rateCards').optional().isArray(),
    body('accessorialRates').optional().isArray()
  ],
  validateRequest,
  importRateCardsExternal
);
