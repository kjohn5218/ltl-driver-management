import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  getTrips,
  getTripById,
  getTripByNumber,
  createTrip,
  updateTrip,
  updateTripStatus,
  deleteTrip,
  assignDriver,
  assignEquipment,
  getDispatchBoard,
  getDriverTrips,
  dispatchTrip,
  getTripEta,
  getTripEtaBatch,
  getVehicleLocation,
  arriveTrip,
  getDriverTripReport,
  getTripEquipmentIssues,
  checkDriverArrivalCount,
  saveMoraleRating,
  getMoraleReport
} from '../controllers/linehaulTrip.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get dispatch board
router.get(
  '/dispatch-board',
  [
    query('date').optional().isISO8601(),
    query('days').optional().isInt({ min: 1, max: 7 })
  ],
  validateRequest,
  getDispatchBoard
);

// Get all trips with filtering
router.get(
  '/',
  [
    query('search').optional().trim(),
    query('status').optional().isIn(['PLANNED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING', 'COMPLETED', 'CANCELLED']),
    query('profileId').optional().isInt({ min: 1 }),
    query('driverId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('originTerminalId').optional().isInt({ min: 1 }),
    query('destinationTerminalId').optional().isInt({ min: 1 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getTrips
);

// Get trip by trip number (must come before /:id)
router.get(
  '/number/:tripNumber',
  [param('tripNumber').notEmpty().trim()],
  validateRequest,
  getTripByNumber
);

// Get driver's trips
router.get(
  '/driver/:driverId',
  [
    param('driverId').isInt({ min: 1 }),
    query('status').optional().isIn(['PLANNED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING', 'COMPLETED', 'CANCELLED']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  getDriverTrips
);

// Get ETA for multiple trips (batch)
router.post(
  '/eta/batch',
  [
    body('tripIds').isArray({ min: 1 }).withMessage('tripIds must be a non-empty array'),
    body('tripIds.*').isInt({ min: 1 })
  ],
  validateRequest,
  getTripEtaBatch
);

// Get ETA for a single trip
router.get(
  '/:id/eta',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTripEta
);

// Get vehicle location from GoMotive API
router.get(
  '/vehicle-location/:vehicleId',
  [param('vehicleId').notEmpty().trim()],
  validateRequest,
  getVehicleLocation
);

// Get trip by ID
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTripById
);

// Create new trip (Admin/Dispatcher only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    body('linehaulProfileId').notEmpty().isInt({ min: 1 }),
    body('dispatchDate').notEmpty().isISO8601(),
    body('plannedDeparture').optional().isISO8601(),
    body('plannedArrival').optional().isISO8601(),
    body('driverId').optional().isInt({ min: 1 }),
    body('teamDriverId').optional().isInt({ min: 1 }),
    body('truckId').optional().isInt({ min: 1 }),
    body('trailerId').optional().isInt({ min: 1 }),
    body('trailer2Id').optional().isInt({ min: 1 }),
    body('dollyId').optional().isInt({ min: 1 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  createTrip
);

// Update trip (Admin/Dispatcher only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('scheduledDeparture').optional().isISO8601(),
    body('scheduledArrival').optional().isISO8601(),
    body('primaryDriverId').optional().isInt({ min: 1 }),
    body('teamDriverId').optional().isInt({ min: 1 }),
    body('truckId').optional().isInt({ min: 1 }),
    body('primaryTrailerId').optional().isInt({ min: 1 }),
    body('secondaryTrailerId').optional().isInt({ min: 1 }),
    body('dollyId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateTrip
);

// Update trip status (Admin/Dispatcher only)
router.patch(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['PLANNED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING', 'COMPLETED', 'CANCELLED']),
    body('actualDeparture').optional().isISO8601(),
    body('actualArrival').optional().isISO8601(),
    body('actualMiles').optional().isDecimal(),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateTripStatus
);

// Dispatch trip (Admin/Dispatcher only) - quick action to dispatch
router.patch(
  '/:id/dispatch',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  dispatchTrip
);

// Arrive trip - submit arrival details and driver report
router.post(
  '/:id/arrive',
  [
    param('id').isInt({ min: 1 }),
    body('actualArrival').optional().isISO8601(),
    body('dropCount').optional().isInt({ min: 0 }),
    body('hookCount').optional().isInt({ min: 0 }),
    body('chainUpCycles').optional().isInt({ min: 0 }),
    body('waitTimeStart').optional().isISO8601(),
    body('waitTimeEnd').optional().isISO8601(),
    body('waitTimeReason').optional().isIn(['LATE_MEET_DRIVER', 'DOCK_DELAY', 'BREAKDOWN']),
    body('notes').optional().trim(),
    body('equipmentIssue').optional().isObject(),
    body('equipmentIssue.equipmentType').optional().isIn(['TRAILER', 'DOLLY']),
    body('equipmentIssue.equipmentNumber').optional().trim(),
    body('equipmentIssue.description').optional().trim()
  ],
  validateRequest,
  arriveTrip
);

// Get driver trip report for a trip
router.get(
  '/:id/driver-report',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getDriverTripReport
);

// Get equipment issues for a trip
router.get(
  '/:id/equipment-issues',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTripEquipmentIssues
);

// Assign driver to trip (Admin/Dispatcher only)
router.patch(
  '/:id/assign-driver',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('primaryDriverId').optional().isInt({ min: 1 }),
    body('teamDriverId').optional().isInt({ min: 1 })
  ],
  validateRequest,
  assignDriver
);

// Assign equipment to trip (Admin/Dispatcher only)
router.patch(
  '/:id/assign-equipment',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('id').isInt({ min: 1 }),
    body('truckId').optional().isInt({ min: 1 }),
    body('primaryTrailerId').optional().isInt({ min: 1 }),
    body('secondaryTrailerId').optional().isInt({ min: 1 }),
    body('dollyId').optional().isInt({ min: 1 })
  ],
  validateRequest,
  assignEquipment
);

// Delete trip (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteTrip
);

// Check driver arrival count in last 24 hours
router.get(
  '/driver/:driverId/arrival-count',
  [param('driverId').isInt({ min: 1 })],
  validateRequest,
  checkDriverArrivalCount
);

// Save morale rating
router.post(
  '/morale-rating',
  [
    body('tripId').isInt({ min: 1 }),
    body('driverId').isInt({ min: 1 }),
    body('rating').isInt({ min: 1, max: 5 })
  ],
  validateRequest,
  saveMoraleRating
);

// Get morale report
router.get(
  '/reports/morale',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('driverId').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
  ],
  validateRequest,
  getMoraleReport
);

export default router;
