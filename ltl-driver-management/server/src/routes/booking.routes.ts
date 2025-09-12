import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getBookings, 
  getBookingById, 
  createBooking, 
  updateBooking, 
  confirmBooking,
  completeBooking,
  cancelBooking,
  deleteBooking,
  sendRateConfirmation,
  getConfirmationByToken,
  submitSignedConfirmation,
  getSignedPDF,
  testEmailConfig
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Public endpoints for rate confirmation (no auth required)
// Get confirmation details by token
router.get(
  '/confirmation/:token',
  getConfirmationByToken
);

// Submit signed confirmation
router.post(
  '/confirmation/:token/sign',
  [
    body('signedBy').trim().notEmpty().withMessage('Signer name is required'),
    body('signature').optional().trim(),
    body('approved').isBoolean()
  ],
  validateRequest,
  submitSignedConfirmation
);

// All routes below this line require authentication
router.use(authenticate);

// Get all bookings with filtering
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    query('carrierId').optional().isInt(),
    query('routeId').optional().isInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('billable').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ],
  validateRequest,
  getBookings
);

// Get specific booking
router.get('/:id', getBookingById);

// Create new booking (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('carrierId').optional().custom((value) => {
      if (value === undefined || value === null) {
        return true; // Allow null/undefined
      }
      if (!Number.isInteger(Number(value))) {
        throw new Error('carrierId must be an integer when provided');
      }
      return true;
    }),
    body('routeId').isInt(),
    body('bookingDate').isISO8601(),
    body('rate').isDecimal({ decimal_digits: '0,2' }),
    body('notes').optional().trim(),
    body('billable').optional().isBoolean(),
    body('status').optional().isIn(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    body('bookingGroupId').optional().trim(),
    body('legNumber').optional().isInt({ min: 1 }),
    body('isParent').optional().isBoolean(),
    body('parentBookingId').optional().isInt(),
    body('rateType').optional().isIn(['MILE', 'MILE_FSC', 'FLAT_RATE']),
    body('baseRate').optional().isDecimal({ decimal_digits: '0,2' }),
    body('fscRate').optional().isDecimal({ decimal_digits: '0,2' })
  ],
  validateRequest,
  createBooking
);

// Update booking (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('bookingDate').optional().isISO8601(),
    body('rate').optional().isDecimal({ decimal_digits: '0,2' }),
    body('billable').optional().isBoolean(),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateBooking
);

// Confirm booking (Admin/Dispatcher only)
router.post(
  '/:id/confirm',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  confirmBooking
);

// Complete booking (Admin/Dispatcher only)
router.post(
  '/:id/complete',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  completeBooking
);

// Cancel booking (Admin/Dispatcher only)
router.post(
  '/:id/cancel',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('reason').optional().trim()
  ],
  validateRequest,
  cancelBooking
);

// Delete booking (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteBooking
);

// Send rate confirmation email (Admin/Dispatcher only)
router.post(
  '/:id/rate-confirmation/send',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  sendRateConfirmation
);

// Get signed PDF for booking (Admin/Dispatcher only)
router.get(
  '/:id/signed-pdf',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  getSignedPDF
);

// Test email configuration (Admin/Dispatcher only)
router.get(
  '/test-email-config',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  testEmailConfig
);

export default router;