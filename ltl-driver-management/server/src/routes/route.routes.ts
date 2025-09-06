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
    body('originAddress').optional().trim(),
    body('originCity').optional().trim(),
    body('originState').optional().trim(),
    body('originZipCode').optional().trim(),
    body('originContact').optional().trim(),
    body('destinationAddress').optional().trim(),
    body('destinationCity').optional().trim(),
    body('destinationState').optional().trim(),
    body('destinationZipCode').optional().trim(),
    body('destinationContact').optional().trim(),
    body('distance').isFloat({ min: 0.1 }),
    body('standardRate').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      if (!isNaN(parseFloat(value)) && parseFloat(value) >= 0) return true;
      throw new Error('standardRate must be a valid number >= 0');
    }),
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
    body('originAddress').optional().trim(),
    body('originCity').optional().trim(),
    body('originState').optional().trim(),
    body('originZipCode').optional().trim(),
    body('originContact').optional().trim(),
    body('destinationAddress').optional().trim(),
    body('destinationCity').optional().trim(),
    body('destinationState').optional().trim(),
    body('destinationZipCode').optional().trim(),
    body('destinationContact').optional().trim(),
    body('distance').optional().isFloat({ min: 0.1 }),
    body('standardRate').optional().custom((value) => {
      if (value === '' || value === undefined || value === null) return true;
      if (!isNaN(parseFloat(value)) && parseFloat(value) >= 0) return true;
      throw new Error('standardRate must be a valid number >= 0');
    }),
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