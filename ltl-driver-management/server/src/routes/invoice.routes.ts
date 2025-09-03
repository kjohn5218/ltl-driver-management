import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getInvoices, 
  getInvoiceById, 
  generateInvoice, 
  markInvoiceAsPaid,
  downloadInvoice
} from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all invoices with filtering
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getInvoices
);

// Get specific invoice
router.get('/:id', getInvoiceById);

// Download invoice as PDF
router.get('/:id/download', downloadInvoice);

// Generate invoice for completed booking (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('bookingId').isInt()
  ],
  validateRequest,
  generateInvoice
);

// Mark invoice as paid (Admin only)
router.put(
  '/:id/pay',
  authorize(UserRole.ADMIN),
  [
    body('paidAt').optional().isISO8601()
  ],
  validateRequest,
  markInvoiceAsPaid
);

export default router;