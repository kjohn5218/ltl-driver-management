import { Router } from 'express';
import { query } from 'express-validator';
import { 
  getDashboardMetrics,
  getCarrierPerformance,
  getRouteAnalytics,
  exportData
} from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get dashboard metrics
router.get(
  '/dashboard',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  getDashboardMetrics
);

// Get carrier performance report
router.get(
  '/carriers',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    query('carrierId').optional().isInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  getCarrierPerformance
);

// Get route analytics
router.get(
  '/routes',
  [
    query('routeId').optional().isInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  getRouteAnalytics
);

// Export data (Admin only)
router.post(
  '/export',
  authorize(UserRole.ADMIN),
  [
    query('type').isIn(['carriers', 'routes', 'bookings', 'invoices']),
    query('format').isIn(['csv', 'json']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  exportData
);

export default router;