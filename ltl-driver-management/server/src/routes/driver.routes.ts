import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getDrivers, 
  getDriverById, 
  createDriver, 
  updateDriver, 
  deleteDriver,
  getActiveDriversByCarrier
} from '../controllers/driver.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all drivers with filtering
router.get(
  '/',
  [
    query('active').optional().isBoolean(),
    query('carrierId').optional().isInt({ min: 1 }),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 10000 })
  ],
  validateRequest,
  getDrivers
);

// Get active drivers by carrier (for booking form)
router.get(
  '/carrier/:carrierId',
  getActiveDriversByCarrier
);

// Get specific driver
router.get('/:id', getDriverById);

// Create new driver (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('carrierId').notEmpty().isInt({ min: 1 }),
    body('name').notEmpty().trim(),
    body('phoneNumber').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('licenseNumber').optional().trim(),
    body('number').optional().trim() // Driver number for dispatch
  ],
  validateRequest,
  createDriver
);

// Update driver (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').optional().notEmpty().trim(),
    body('phoneNumber').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('licenseNumber').optional().trim(),
    body('active').optional().isBoolean(),
    body('number').optional().trim(),
    body('carrierId').optional().isInt({ min: 1 })
  ],
  validateRequest,
  updateDriver
);

// Delete driver (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteDriver
);

export default router;