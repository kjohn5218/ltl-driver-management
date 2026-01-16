import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  // Pay Periods
  getPayPeriods,
  getPayPeriodById,
  createPayPeriod,
  updatePayPeriodStatus,
  getCurrentPayPeriod,
  // Trip Pay
  getTripPays,
  getTripPayById,
  calculateTripPay,
  updateTripPayStatus,
  bulkApproveTripPays,
  getDriverPaySummary,
  exportPayPeriod
} from '../controllers/payroll.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== PAY PERIODS ====================

// Get current/open pay period
router.get('/pay-periods/current', getCurrentPayPeriod);

// Get all pay periods
router.get(
  '/pay-periods',
  [
    query('status').optional().isIn(['OPEN', 'CLOSED', 'LOCKED', 'EXPORTED']),
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getPayPeriods
);

// Get pay period by ID
router.get(
  '/pay-periods/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getPayPeriodById
);

// Create pay period (Admin/Payroll Admin only)
router.post(
  '/pay-periods',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('periodStart').notEmpty().isISO8601(),
    body('periodEnd').notEmpty().isISO8601(),
    body('notes').optional().trim()
  ],
  validateRequest,
  createPayPeriod
);

// Update pay period status (Admin/Payroll Admin only)
router.patch(
  '/pay-periods/:id/status',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['OPEN', 'CLOSED', 'LOCKED', 'EXPORTED']),
    body('notes').optional().trim()
  ],
  validateRequest,
  updatePayPeriodStatus
);

// Export pay period (Admin/Payroll Admin only)
router.get(
  '/pay-periods/:id/export',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    query('format').optional().isIn(['json', 'csv'])
  ],
  validateRequest,
  exportPayPeriod
);

// ==================== TRIP PAY ====================

// Get trip pays for a pay period
router.get(
  '/pay-periods/:payPeriodId/trip-pays',
  [
    param('payPeriodId').isInt({ min: 1 }),
    query('driverId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('status').optional().isIn(['PENDING', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'DISPUTED']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getTripPays
);

// Get trip pay by ID
router.get(
  '/trip-pays/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTripPayById
);

// Calculate pay for a trip (Admin/Dispatcher/Payroll Admin/Payroll Clerk only)
router.post(
  '/trips/:tripId/calculate-pay',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.PAYROLL_ADMIN, UserRole.PAYROLL_CLERK),
  [param('tripId').isInt({ min: 1 })],
  validateRequest,
  calculateTripPay
);

// Update trip pay status (Admin/Payroll Admin/Payroll Clerk only)
router.patch(
  '/trip-pays/:id/status',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.PAYROLL_CLERK),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['PENDING', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'DISPUTED']),
    body('notes').optional().trim(),
    body('bonusPay').optional().isDecimal(),
    body('deductions').optional().isDecimal()
  ],
  validateRequest,
  updateTripPayStatus
);

// Bulk approve trip pays (Admin/Payroll Admin only)
router.post(
  '/trip-pays/bulk-approve',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    body('tripPayIds').isArray({ min: 1 }),
    body('tripPayIds.*').isInt({ min: 1 })
  ],
  validateRequest,
  bulkApproveTripPays
);

// Get driver pay summary
router.get(
  '/drivers/:driverId/pay-summary',
  [
    param('driverId').isInt({ min: 1 }),
    query('payPeriodId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  getDriverPaySummary
);

export default router;
