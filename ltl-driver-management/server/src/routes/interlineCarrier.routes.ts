import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateToken, requireRole } from '../middleware/auth';
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
router.use(authenticateToken);

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
  requireRole(['ADMIN', 'DISPATCHER']),
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
  requireRole(['ADMIN', 'DISPATCHER']),
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
  requireRole(['ADMIN']),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    validateRequest
  ],
  deleteInterlineCarrier
);

// Toggle carrier active status (Admin/Dispatcher)
router.patch(
  '/:id/toggle-status',
  requireRole(['ADMIN', 'DISPATCHER']),
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid carrier ID'),
    validateRequest
  ],
  toggleCarrierStatus
);

export default router;
