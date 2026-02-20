import { Router } from 'express';
import { query } from 'express-validator';
import { getKPIDashboard, getCostPerMile, getCCFSContractMonthly, getEnhancedLoadFactor } from '../controllers/advancedReport.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get KPI Dashboard metrics
router.get(
  '/kpi-dashboard',
  [
    query('week').optional().isString(),
    query('year').optional().isInt(),
  ],
  validateRequest,
  getKPIDashboard
);

// Get Cost Per Mile analysis
router.get(
  '/cost-per-mile',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validateRequest,
  getCostPerMile
);

// Get CCFS vs Contract monthly comparison
router.get(
  '/ccfs-vs-contract-monthly',
  [
    query('months').optional().isInt({ min: 1, max: 24 }),
  ],
  validateRequest,
  getCCFSContractMonthly
);

// Get Enhanced Load Factor analysis
router.get(
  '/load-factor-enhanced',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validateRequest,
  getEnhancedLoadFactor
);

export default router;
