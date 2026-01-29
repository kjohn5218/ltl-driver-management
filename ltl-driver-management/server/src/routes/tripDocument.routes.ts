/**
 * Trip Document Routes
 *
 * API endpoints for trip document operations.
 */

import { Router } from 'express';
import { param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getTripDocuments,
  getDocumentById,
  downloadDocument,
  downloadHazmatBOL,
  generateDocuments,
  regenerateDocument,
  getDocumentPreview,
} from '../controllers/tripDocument.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/trip-documents/trip/:tripId
 * Get all documents for a trip
 */
router.get(
  '/trip/:tripId',
  [param('tripId').isInt({ min: 1 }).withMessage('Valid trip ID is required')],
  validateRequest,
  getTripDocuments
);

/**
 * GET /api/trip-documents/:id
 * Get document by ID
 */
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Valid document ID is required')],
  validateRequest,
  getDocumentById
);

/**
 * GET /api/trip-documents/:id/download
 * Download document as PDF
 */
router.get(
  '/:id/download',
  [param('id').isInt({ min: 1 }).withMessage('Valid document ID is required')],
  validateRequest,
  downloadDocument
);

/**
 * GET /api/trip-documents/:id/preview
 * Get document preview data
 */
router.get(
  '/:id/preview',
  [param('id').isInt({ min: 1 }).withMessage('Valid document ID is required')],
  validateRequest,
  getDocumentPreview
);

/**
 * GET /api/trip-documents/trip/:tripId/hazmat-bol/:proNumber
 * Download Hazmat BOL for a specific shipment
 */
router.get(
  '/trip/:tripId/hazmat-bol/:proNumber',
  [
    param('tripId').isInt({ min: 1 }).withMessage('Valid trip ID is required'),
    param('proNumber').notEmpty().withMessage('Pro number is required'),
  ],
  validateRequest,
  downloadHazmatBOL
);

/**
 * POST /api/trip-documents/trip/:tripId/generate
 * Generate documents for a trip (manual trigger)
 */
router.post(
  '/trip/:tripId/generate',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [param('tripId').isInt({ min: 1 }).withMessage('Valid trip ID is required')],
  validateRequest,
  generateDocuments
);

/**
 * POST /api/trip-documents/:id/regenerate
 * Regenerate a specific document
 */
router.post(
  '/:id/regenerate',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [param('id').isInt({ min: 1 }).withMessage('Valid document ID is required')],
  validateRequest,
  regenerateDocument
);

export default router;
