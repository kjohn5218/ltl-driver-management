import { Router } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validation.middleware';
import { bulkDisposition, singleDisposition } from '../controllers/tmsDisposition.controller';

const router = Router();

// Valid late reason types
const VALID_REASONS = ['PRE_LOAD', 'DOCK_ISSUE', 'STAFFING', 'DRIVER_ISSUE', 'WEATHER', 'LATE_INBOUND', 'DISPATCH_ISSUE'];

/**
 * Bulk disposition for multiple loadsheets
 * POST /api/tms-disposition/bulk
 */
router.post('/bulk',
  [
    body('loadsheetIds').isArray({ min: 1 }).withMessage('At least one loadsheet ID is required'),
    body('loadsheetIds.*').isInt().withMessage('Loadsheet IDs must be integers'),
    body('lateReason').isIn(VALID_REASONS).withMessage('Valid late reason is required'),
    body('willCauseServiceFailure').isBoolean().withMessage('willCauseServiceFailure is required'),
    body('accountableTerminalId').optional({ nullable: true }).isInt().withMessage('Must be integer'),
    body('accountableTerminalCode').optional({ nullable: true }).isString(),
    body('notes').optional({ nullable: true }).isString(),
    body('newScheduledDepartDate').isString().notEmpty().withMessage('New scheduled departure date is required')
  ],
  validateRequest,
  bulkDisposition
);

/**
 * Single disposition for a trip (used by LateReasonModal)
 * POST /api/tms-disposition/single/:tripId
 */
router.post('/single/:tripId',
  [
    param('tripId').isInt().withMessage('Trip ID must be integer'),
    body('lateReason').isIn(VALID_REASONS).withMessage('Valid late reason is required'),
    body('willCauseServiceFailure').isBoolean().withMessage('willCauseServiceFailure is required'),
    body('accountableTerminalId').optional({ nullable: true }).isInt().withMessage('Must be integer'),
    body('accountableTerminalCode').optional({ nullable: true }).isString(),
    body('notes').optional({ nullable: true }).isString(),
    body('newScheduledDepartDate').isString().notEmpty().withMessage('New scheduled departure date is required'),
    body('scheduledDepartTime').optional({ nullable: true }).isString(),
    body('actualDepartTime').optional({ nullable: true }).isString(),
    body('minutesLate').optional({ nullable: true }).isInt()
  ],
  validateRequest,
  singleDisposition
);

export default router;
