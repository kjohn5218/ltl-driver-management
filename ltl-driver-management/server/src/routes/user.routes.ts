import { Router } from 'express';
import { body, query } from 'express-validator';
import { 
  getUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all users (Admin only)
router.get(
  '/',
  authorize(UserRole.ADMIN),
  [
    query('role').optional().isIn(['ADMIN', 'USER', 'DISPATCHER', 'CARRIER']),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getUsers
);

// Get specific user (Admin only)
router.get(
  '/:id',
  authorize(UserRole.ADMIN),
  getUserById
);

// Create new user (Admin only)
router.post(
  '/',
  authorize(UserRole.ADMIN),
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'USER']).withMessage('Role must be ADMIN or USER')
  ],
  validateRequest,
  createUser
);

// Update user (Admin only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN),
  [
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'USER']).withMessage('Role must be ADMIN or USER')
  ],
  validateRequest,
  updateUser
);

// Delete user (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  deleteUser
);

export default router;