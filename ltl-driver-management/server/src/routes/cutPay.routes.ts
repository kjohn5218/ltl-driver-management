import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getCutPayRequests,
  getCutPayRequestById,
  createCutPayRequest,
  approveCutPayRequest,
  rejectCutPayRequest,
  markCutPayAsPaid,
  getCutPayStats
} from '../controllers/cutPay.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get cut pay statistics (Admin/Payroll Admin/Dispatcher)
router.get(
  '/stats',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.DISPATCHER),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  getCutPayStats
);

// Get all cut pay requests
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.DISPATCHER),
  [
    query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED', 'PAID']),
    query('driverId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getCutPayRequests
);

// Get cut pay request by ID
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.DISPATCHER),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getCutPayRequestById
);

// Create cut pay request (Dispatcher can create)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN, UserRole.DISPATCHER),
  [
    body('driverId').notEmpty().isInt({ min: 1 }),
    body('tripId').optional().isInt({ min: 1 }),
    body('trailerConfig').optional().isIn(['SINGLE', 'DOUBLE', 'TRIPLE']),
    body('cutPayType').optional().isIn(['HOURS', 'MILES']),
    body('hoursRequested').optional().isDecimal({ decimal_digits: '0,2' }),
    body('milesRequested').optional().isDecimal({ decimal_digits: '0,1' }),
    body('reason').optional().trim(),
    body('notes').optional().trim()
  ],
  validateRequest,
  createCutPayRequest
);

// Approve cut pay request (Admin/Payroll Admin only)
router.put(
  '/:id/approve',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim(),
    body('rateOverride').optional().isDecimal()
  ],
  validateRequest,
  approveCutPayRequest
);

// Reject cut pay request (Admin/Payroll Admin only)
router.put(
  '/:id/reject',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  rejectCutPayRequest
);

// Mark cut pay as paid (Admin/Payroll Admin only)
router.put(
  '/:id/paid',
  authorize(UserRole.ADMIN, UserRole.PAYROLL_ADMIN),
  [
    param('id').isInt({ min: 1 }),
    body('externalPayrollId').optional().trim(),
    body('notes').optional().trim()
  ],
  validateRequest,
  markCutPayAsPaid
);

export default router;
