import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  sendInvoicesToAP,
  deleteInvoice,
  getInvoiceSummary,
  downloadInvoicePDF
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
    query('status').optional().isIn(['PENDING', 'SENT_TO_AP', 'PAID', 'OVERDUE', 'CANCELLED']),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('carrierId').optional().isInt(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 })
  ],
  validateRequest,
  listInvoices
);

// Get invoice summary/report
router.get(
  '/summary',
  [
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('carrierId').optional().isInt()
  ],
  validateRequest,
  getInvoiceSummary
);

// Get specific invoice
router.get('/:id', getInvoice);

// Download invoice as PDF
router.get('/:id/pdf', downloadInvoicePDF);

// Generate invoice for completed booking (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('bookingId').isInt()
  ],
  validateRequest,
  createInvoice
);

// Update invoice status (Admin/Dispatcher only)
router.put(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('status').isIn(['PENDING', 'SENT_TO_AP', 'PAID', 'OVERDUE', 'CANCELLED'])
  ],
  validateRequest,
  updateInvoiceStatus
);

// Send invoices to AP (Admin/Dispatcher only)
router.post(
  '/send-to-ap',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('invoiceIds').isArray().notEmpty(),
    body('invoiceIds.*').isInt(),
    body('includeDocuments').optional().isBoolean()
  ],
  validateRequest,
  sendInvoicesToAP
);

// Delete invoice (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteInvoice
);

export default router;