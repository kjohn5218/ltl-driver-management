import { Router } from 'express';
import { body } from 'express-validator';
import { getSystemSettings, updateFuelSurchargeRate, updateFuelSurchargeExternal } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Get system settings (public endpoint for fuel surcharge rate)
router.get('/', getSystemSettings);

// External API endpoint for receiving fuel surcharge from outside source
// This endpoint uses API key authentication instead of user authentication
router.post(
  '/fuel-surcharge/external',
  [
    body('fuelSurchargeRate').isDecimal({ decimal_digits: '0,2' }).isFloat({ min: 0, max: 100 }),
    body('externalId').optional().isString(),
    body('source').optional().isString()
  ],
  validateRequest,
  updateFuelSurchargeExternal
);

// All other routes require authentication
router.use(authenticate);

// Update fuel surcharge rate manually (Admin/Dispatcher only)
router.put(
  '/fuel-surcharge',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('fuelSurchargeRate').isDecimal({ decimal_digits: '0,2' }).isFloat({ min: 0, max: 100 })
  ],
  validateRequest,
  updateFuelSurchargeRate
);

export default router;