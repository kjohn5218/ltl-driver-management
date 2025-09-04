import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getCarriers, 
  getCarrierById, 
  createCarrier, 
  updateCarrier, 
  deleteCarrier,
  searchCarriers,
  uploadDocument
} from '../controllers/carrier.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { upload } from '../middleware/upload.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all carriers with filtering
router.get(
  '/',
  [
    query('status').optional().isIn(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'NOT_ONBOARDED', 'ONBOARDED']),
    query('onboardingComplete').optional().isBoolean(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 5000 })
  ],
  validateRequest,
  getCarriers
);

// Search carriers
router.get(
  '/search',
  [
    query('q').notEmpty().trim()
  ],
  validateRequest,
  searchCarriers
);

// Get specific carrier
router.get('/:id', getCarrierById);

// Create new carrier (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').notEmpty().trim(),
    body('contactPerson').optional().trim(),
    body('phone').optional().isMobilePhone('any'),
    body('email').optional().isEmail().normalizeEmail(),
    body('mcNumber').optional().trim(),
    body('dotNumber').optional().trim(),
    body('insuranceExpiration').optional().isISO8601(),
    body('ratePerMile').optional().isDecimal()
  ],
  validateRequest,
  createCarrier
);

// Update carrier (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').optional().notEmpty().trim(),
    body('contactPerson').optional().trim(),
    body('phone').optional().isMobilePhone('any'),
    body('email').optional().isEmail().normalizeEmail(),
    body('mcNumber').optional().trim(),
    body('dotNumber').optional().trim(),
    body('insuranceExpiration').optional().isISO8601(),
    body('status').optional().isIn(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']),
    body('rating').optional().isDecimal({ decimal_digits: '0,1' }),
    body('ratePerMile').optional().isDecimal(),
    body('onboardingComplete').optional().isBoolean()
  ],
  validateRequest,
  updateCarrier
);

// Delete carrier (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteCarrier
);

// Upload carrier documents (Admin/Dispatcher only)
router.post(
  '/:id/documents',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  upload.single('document'),
  [
    body('documentType').notEmpty().trim()
  ],
  validateRequest,
  uploadDocument
);

export default router;