import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getRoutes, 
  getRouteById, 
  createRoute, 
  updateRoute, 
  deleteRoute,
  getRouteCarriers
} from '../controllers/route.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all routes with filtering
router.get(
  '/',
  [
    query('origin').optional().trim(),
    query('destination').optional().trim(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 2000 })
  ],
  validateRequest,
  getRoutes
);

// Get specific route
router.get('/:id', getRouteById);

// Get carriers for a specific route
router.get('/:id/carriers', getRouteCarriers);

// Create new route (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').notEmpty().trim(),
    body('origin').notEmpty().trim(),
    body('destination').notEmpty().trim(),
    body('distance').isInt({ min: 1 }),
    body('standardRate').isDecimal({ decimal_digits: '0,2' }),
    body('frequency').optional().trim(),
    body('departureTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('arrivalTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  ],
  validateRequest,
  createRoute
);

// Update route (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('name').optional().notEmpty().trim(),
    body('origin').optional().notEmpty().trim(),
    body('destination').optional().notEmpty().trim(),
    body('distance').optional().isInt({ min: 1 }),
    body('standardRate').optional().isDecimal({ decimal_digits: '0,2' }),
    body('frequency').optional().trim(),
    body('departureTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('arrivalTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  ],
  validateRequest,
  updateRoute
);

// Delete route (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteRoute
);

export default router;