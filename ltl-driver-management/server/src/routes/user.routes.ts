import { Router, Request, Response, NextFunction } from 'express';
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

// Middleware to restrict MANAGER to only DISPATCHER role operations
const restrictManagerToDispatcherRole = (req: Request, res: Response, next: NextFunction) => {
  const currentUser = (req as any).user;

  if (currentUser?.role === 'MANAGER') {
    // For create/update, MANAGER can only set role to DISPATCHER
    if (req.body.role && req.body.role !== 'DISPATCHER') {
      return res.status(403).json({ message: 'Managers can only create or modify Dispatcher accounts' });
    }
    // Force role to DISPATCHER for MANAGER creating users
    if (req.method === 'POST') {
      req.body.role = 'DISPATCHER';
    }
  }
  next();
};

// Get all users (Admin and Manager)
router.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  [
    query('role').optional().isIn(['ADMIN', 'DISPATCHER', 'CARRIER', 'MANAGER']),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getUsers
);

// Get specific user (Admin and Manager)
router.get(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  getUserById
);

// Create new user (Admin and Manager - Manager restricted to DISPATCHER role only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  restrictManagerToDispatcherRole,
  [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'DISPATCHER', 'MANAGER']).withMessage('Role must be ADMIN, MANAGER, or DISPATCHER')
  ],
  validateRequest,
  createUser
);

// Update user (Admin and Manager - Manager restricted to DISPATCHER accounts only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  restrictManagerToDispatcherRole,
  [
    body('name').optional().notEmpty().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'DISPATCHER', 'MANAGER']).withMessage('Role must be ADMIN, MANAGER, or DISPATCHER')
  ],
  validateRequest,
  updateUser
);

// Delete user (Admin and Manager - Manager restricted to DISPATCHER accounts only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  deleteUser
);

export default router;