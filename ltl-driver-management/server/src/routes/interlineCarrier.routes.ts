import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getInterlineCarriers,
  getInterlineCarrierById,
  createInterlineCarrier,
  updateInterlineCarrier,
  deleteInterlineCarrier,
  getInterlineCarriersList,
  toggleCarrierStatus
} from '../controllers/interlineCarrier.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get list of active carriers for dropdowns (simple endpoint)
router.get('/list', getInterlineCarriersList);

// Get all interline carriers with filtering
router.get(
  '/',
  [
    query('search').optional().isString(),
    query('active').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validateRequest
  ],
  getInterlineCarriers
);

// Get interline carrier by ID
router.get(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    validateRequest
  ],
  getInterlineCarrierById
);

// Create new interline carrier (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('code').notEmpty().withMessage('Carrier code is required').isLength({ max: 10 }),
    body('name').notEmpty().withMessage('Carrier name is required').isLength({ max: 100 }),
    body('scacCode').optional({ nullable: true }).isLength({ min: 2, max: 4 }),
    body('contactName').optional({ nullable: true }).isLength({ max: 100 }),
    body('contactPhone').optional({ nullable: true }).isLength({ max: 20 }),
    body('contactEmail').optional({ nullable: true }).isEmail(),
    body('notes').optional({ nullable: true }),
    body('active').optional().isBoolean(),
    validateRequest
  ],
  createInterlineCarrier
);

// Update interline carrier (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    body('code').optional().isLength({ max: 10 }),
    body('name').optional().isLength({ max: 100 }),
    body('scacCode').optional({ nullable: true }).isLength({ min: 2, max: 4 }),
    body('contactName').optional({ nullable: true }).isLength({ max: 100 }),
    body('contactPhone').optional({ nullable: true }).isLength({ max: 20 }),
    body('contactEmail').optional({ nullable: true }).isEmail(),
    body('notes').optional({ nullable: true }),
    body('active').optional().isBoolean(),
    validateRequest
  ],
  updateInterlineCarrier
);

// Delete interline carrier (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    validateRequest
  ],
  deleteInterlineCarrier
);

// Toggle carrier active status (Admin/Dispatcher)
router.patch(
  '/:id/toggle-status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    validateRequest
  ],
  toggleCarrierStatus
);

export default router;
