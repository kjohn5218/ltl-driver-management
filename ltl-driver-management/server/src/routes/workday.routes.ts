import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getWorkdayPaycodes,
  getPaycodeMapping,
  getDriverRateInfo,
  syncDriverRates,
  workdayWebhook,
  getWorkdaySyncStatus,
  updateDriverWorkdayId
} from '../controllers/workday.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { authenticateApiKey } from '../middleware/apiKey.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// ==================== AUTHENTICATED ROUTES ====================
// These routes require user authentication

// Get all Workday paycodes
router.get(
  '/paycodes',
  authenticate,
  [
    query('payType').optional().trim(),
    query('trailerConfig').optional().isIn(['SINGLE', 'DOUBLE', 'TRIPLE']),
    query('isCutPay').optional().isBoolean(),
    query('active').optional().isBoolean()
  ],
  validateRequest,
  getWorkdayPaycodes
);

// Get paycode mapping
router.get(
  '/paycodes/mapping',
  authenticate,
  [
    query('payType').optional().trim(),
    query('trailerConfig').optional().isIn(['SINGLE', 'DOUBLE', 'TRIPLE']),
    query('isCutPay').optional().isBoolean()
  ],
  validateRequest,
  getPaycodeMapping
);

// Get Workday sync status
router.get(
  '/sync-status',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  getWorkdaySyncStatus
);

// Get driver rate info from Workday
router.get(
  '/driver/:driverId/rates',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.DISPATCHER),
  [param('driverId').isInt({ min: 1 })],
  validateRequest,
  getDriverRateInfo
);

// Update driver Workday Employee ID
router.put(
  '/driver/:driverId/workday-id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('driverId').isInt({ min: 1 }),
    body('workdayEmployeeId').optional().trim()
  ],
  validateRequest,
  updateDriverWorkdayId
);

// Sync driver rates from Workday (Admin/Payroll Admin only)
router.post(
  '/sync',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('driverIds').optional().isArray()
  ],
  validateRequest,
  syncDriverRates
);

// ==================== EXTERNAL API ROUTES ====================
// These routes use API key authentication for external systems

export const externalWorkdayRouter = Router();

// Workday webhook endpoint (uses API key authentication)
externalWorkdayRouter.post(
  '/webhook',
  authenticateApiKey,
  [
    body('eventType').notEmpty().trim(),
    body('data').isObject()
  ],
  validateRequest,
  workdayWebhook
);

export default router;
