/**
 * SMS Routes
 *
 * API routes for SMS messaging operations
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import {
  getSMSStatus,
  sendTestSMS,
  sendTripAssignmentSMS,
  sendBookingConfirmationSMS,
  sendDelayNotificationSMS,
  sendCustomSMS,
  sendBulkSMS,
} from '../controllers/sms.controller';

const router = Router();

/**
 * Get SMS service status
 * GET /api/sms/status
 */
router.get('/status', getSMSStatus);

/**
 * Send a test SMS
 * POST /api/sms/test
 */
router.post(
  '/test',
  [
    body('phoneNumber').isString().notEmpty().withMessage('Phone number is required'),
    body('message').optional().isString().isLength({ max: 1600 }),
  ],
  validateRequest,
  sendTestSMS
);

/**
 * Send trip assignment SMS
 * POST /api/sms/trip-assignment
 */
router.post(
  '/trip-assignment',
  [
    body('tripId').isInt().withMessage('Trip ID is required'),
    body('driverId').optional().isInt(),
    body('phoneNumber').optional().isString(),
  ],
  validateRequest,
  sendTripAssignmentSMS
);

/**
 * Send booking confirmation SMS
 * POST /api/sms/booking-confirmation
 */
router.post(
  '/booking-confirmation',
  [
    body('bookingId').isInt().withMessage('Booking ID is required'),
    body('phoneNumber').optional().isString(),
  ],
  validateRequest,
  sendBookingConfirmationSMS
);

/**
 * Send delay notification SMS
 * POST /api/sms/delay-notification
 */
router.post(
  '/delay-notification',
  [
    body('tripId').isInt().withMessage('Trip ID is required'),
    body('reason').isString().notEmpty().withMessage('Reason is required'),
    body('phoneNumber').optional().isString(),
    body('newDepartureTime').optional().isString(),
  ],
  validateRequest,
  sendDelayNotificationSMS
);

/**
 * Send custom SMS
 * POST /api/sms/send
 */
router.post(
  '/send',
  [
    body('phoneNumber').isString().notEmpty().withMessage('Phone number is required'),
    body('message').isString().notEmpty().isLength({ max: 1600 }).withMessage('Message is required (max 1600 chars)'),
    body('type').optional().isString(),
    body('referenceId').optional(),
  ],
  validateRequest,
  sendCustomSMS
);

/**
 * Send bulk SMS
 * POST /api/sms/bulk
 */
router.post(
  '/bulk',
  [
    body('phoneNumbers')
      .isArray({ min: 1, max: 100 })
      .withMessage('Phone numbers array required (1-100 recipients)'),
    body('phoneNumbers.*').isString().withMessage('Each phone number must be a string'),
    body('message').isString().notEmpty().isLength({ max: 1600 }).withMessage('Message is required (max 1600 chars)'),
    body('type').optional().isString(),
  ],
  validateRequest,
  sendBulkSMS
);

export default router;
