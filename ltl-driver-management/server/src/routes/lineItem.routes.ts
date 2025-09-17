import { Router } from 'express';
import { body } from 'express-validator';
import { 
  getBookingLineItems, 
  addBookingLineItem, 
  updateBookingLineItem, 
  deleteBookingLineItem,
  uploadLineItemReceipt,
  getLineItemReceipt,
  getBookingTotal
} from '../controllers/lineItem.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all line items for a booking
router.get('/bookings/:bookingId/line-items', getBookingLineItems);

// Get booking total with line items
router.get('/bookings/:bookingId/total', getBookingTotal);

// Add a new line item to a booking
router.post(
  '/bookings/:bookingId/line-items',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('category').isString().isLength({ min: 1, max: 50 }),
    body('description').isString().isLength({ min: 1, max: 255 }),
    body('amount').isDecimal().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('unitPrice').optional().isDecimal().isFloat({ min: 0 })
  ],
  validateRequest,
  addBookingLineItem
);

// Update a line item
router.put(
  '/bookings/:bookingId/line-items/:lineItemId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('category').optional().isString().isLength({ min: 1, max: 50 }),
    body('description').optional().isString().isLength({ min: 1, max: 255 }),
    body('amount').optional().isDecimal().isFloat({ min: 0 }),
    body('quantity').optional().isInt({ min: 1 }),
    body('unitPrice').optional().isDecimal().isFloat({ min: 0 })
  ],
  validateRequest,
  updateBookingLineItem
);

// Delete a line item
router.delete(
  '/bookings/:bookingId/line-items/:lineItemId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  deleteBookingLineItem
);

// Upload receipt for a line item
router.post(
  '/bookings/:bookingId/line-items/:lineItemId/receipt',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  uploadLineItemReceipt
);

// Get receipt for a line item
router.get('/bookings/:bookingId/line-items/:lineItemId/receipt', getLineItemReceipt);

export default router;