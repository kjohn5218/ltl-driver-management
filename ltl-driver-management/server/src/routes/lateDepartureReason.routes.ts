import { Router } from 'express';
import { query, body, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import {
  getLateDepartureReasons,
  getLateDepartureReasonByTripId,
  createLateDepartureReason,
  updateLateDepartureReason,
  deleteLateDepartureReason,
  getLateDepartureReasonStats
} from '../controllers/lateDepartureReason.controller';

const router = Router();

// Valid late reason types
const VALID_REASONS = ['PRE_LOAD', 'DOCK_ISSUE', 'STAFFING', 'DRIVER_ISSUE', 'WEATHER', 'LATE_INBOUND', 'DISPATCH_ISSUE'];

// Get all late departure reasons (with optional filters)
router.get('/',
  [
    query('reason').optional().isIn(VALID_REASONS).withMessage('Invalid reason type'),
    query('willCauseServiceFailure').optional().isBoolean().withMessage('Must be boolean'),
    query('accountableTerminalId').optional().isInt().withMessage('Must be integer'),
    query('startDate').optional().isISO8601().withMessage('Must be valid date'),
    query('endDate').optional().isISO8601().withMessage('Must be valid date'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be 1-1000')
  ],
  validateRequest,
  getLateDepartureReasons
);

// Get statistics
router.get('/stats',
  [
    query('startDate').optional().isISO8601().withMessage('Must be valid date'),
    query('endDate').optional().isISO8601().withMessage('Must be valid date')
  ],
  validateRequest,
  getLateDepartureReasonStats
);

// Get late departure reason by trip ID
router.get('/trip/:tripId',
  [
    param('tripId').isInt().withMessage('Trip ID must be integer')
  ],
  validateRequest,
  getLateDepartureReasonByTripId
);

// Create new late departure reason
router.post('/',
  [
    body('tripId').isInt().withMessage('Trip ID is required'),
    body('reason').isIn(VALID_REASONS).withMessage('Valid reason is required'),
    body('willCauseServiceFailure').isBoolean().withMessage('willCauseServiceFailure is required'),
    body('accountableTerminalId').optional({ nullable: true }).isInt().withMessage('Must be integer'),
    body('accountableTerminalCode').optional({ nullable: true }).isString(),
    body('notes').optional({ nullable: true }).isString(),
    body('scheduledDepartTime').optional({ nullable: true }).isString(),
    body('actualDepartTime').optional({ nullable: true }).isString(),
    body('minutesLate').optional({ nullable: true }).isInt()
  ],
  validateRequest,
  createLateDepartureReason
);

// Update late departure reason
router.put('/:id',
  [
    param('id').isInt().withMessage('ID must be integer'),
    body('reason').optional().isIn(VALID_REASONS).withMessage('Invalid reason type'),
    body('willCauseServiceFailure').optional().isBoolean().withMessage('Must be boolean'),
    body('accountableTerminalId').optional({ nullable: true }).isInt().withMessage('Must be integer'),
    body('accountableTerminalCode').optional({ nullable: true }).isString(),
    body('notes').optional({ nullable: true }).isString()
  ],
  validateRequest,
  updateLateDepartureReason
);

// Delete late departure reason
router.delete('/:id',
  [
    param('id').isInt().withMessage('ID must be integer')
  ],
  validateRequest,
  deleteLateDepartureReason
);

export default router;
