import { Router } from 'express';
import { body } from 'express-validator';
import { syncDriver, syncDriversBatch } from '../controllers/hrIntegration.controller';
import { authenticateApiKey } from '../middleware/apiKey.middleware';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// All HR integration routes require API key authentication
router.use(authenticateApiKey);

/**
 * POST /api/hr/drivers
 * Sync a single driver from HR system (upsert)
 */
router.post(
  '/drivers',
  [
    body('externalDriverId').notEmpty().trim().withMessage('externalDriverId is required'),
    body('carrierId').notEmpty().isInt({ min: 1 }).withMessage('Valid carrierId is required'),
    body('name').notEmpty().trim().withMessage('name is required'),
    body('phoneNumber').optional().trim(),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('number').optional().trim(),
    body('licenseNumber').optional().trim(),
    body('licenseClass').optional().trim().isIn(['A', 'B', 'C']).withMessage('licenseClass must be A, B, or C'),
    body('licenseState').optional().trim().isLength({ min: 2, max: 2 }).withMessage('licenseState must be 2 characters'),
    body('licenseExpiration').optional().isISO8601().withMessage('licenseExpiration must be ISO8601 date'),
    body('medicalCardExpiration').optional().isISO8601().withMessage('medicalCardExpiration must be ISO8601 date'),
    body('dateOfHire').optional().isISO8601().withMessage('dateOfHire must be ISO8601 date'),
    body('dateOfBirth').optional().isISO8601().withMessage('dateOfBirth must be ISO8601 date'),
    body('endorsements').optional().trim(),
    body('active').optional().isBoolean().withMessage('active must be a boolean')
  ],
  validateRequest,
  syncDriver
);

/**
 * POST /api/hr/drivers/batch
 * Sync multiple drivers from HR system (upsert)
 */
router.post(
  '/drivers/batch',
  [
    body('drivers').isArray({ min: 1, max: 500 }).withMessage('drivers must be an array with 1-500 items'),
    body('drivers.*.externalDriverId').notEmpty().trim().withMessage('externalDriverId is required for each driver'),
    body('drivers.*.carrierId').notEmpty().isInt({ min: 1 }).withMessage('Valid carrierId is required for each driver'),
    body('drivers.*.name').notEmpty().trim().withMessage('name is required for each driver'),
    body('drivers.*.phoneNumber').optional().trim(),
    body('drivers.*.email').optional().isEmail().normalizeEmail(),
    body('drivers.*.number').optional().trim(),
    body('drivers.*.licenseNumber').optional().trim(),
    body('drivers.*.licenseClass').optional().trim().isIn(['A', 'B', 'C']),
    body('drivers.*.licenseState').optional().trim().isLength({ min: 2, max: 2 }),
    body('drivers.*.licenseExpiration').optional().isISO8601(),
    body('drivers.*.medicalCardExpiration').optional().isISO8601(),
    body('drivers.*.dateOfHire').optional().isISO8601(),
    body('drivers.*.dateOfBirth').optional().isISO8601(),
    body('drivers.*.endorsements').optional().trim(),
    body('drivers.*.active').optional().isBoolean()
  ],
  validateRequest,
  syncDriversBatch
);

export default router;
