import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  // Shipments
  getTripShipments,
  addTripShipment,
  updateTripShipment,
  deleteTripShipment,
  bulkAddTripShipments,
  reorderTripShipments,
  getTripLoadManifest,
  // Delays
  getTripDelays,
  reportTripDelay,
  updateTripDelay,
  resolveTripDelay,
  deleteTripDelay,
  getDelayStatistics
} from '../controllers/tripOperations.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== DELAY STATISTICS (must come before :tripId routes) ====================

// Get delay statistics
router.get(
  '/delays/statistics',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('carrierId').optional().isInt({ min: 1 }),
    query('profileId').optional().isInt({ min: 1 })
  ],
  validateRequest,
  getDelayStatistics
);

// ==================== TRIP SHIPMENTS ====================

// Get all shipments for a trip
router.get(
  '/:tripId/shipments',
  [param('tripId').isInt({ min: 1 })],
  validateRequest,
  getTripShipments
);

// Get load manifest for a trip
router.get(
  '/:tripId/manifest',
  [param('tripId').isInt({ min: 1 })],
  validateRequest,
  getTripLoadManifest
);

// Add shipment to trip (Admin/Dispatcher only)
router.post(
  '/:tripId/shipments',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    body('proNumber').optional().trim(),
    body('bookingId').optional().isInt({ min: 1 }),
    body('originCity').optional().trim(),
    body('originState').optional().trim().isLength({ max: 2 }),
    body('destinationCity').optional().trim(),
    body('destinationState').optional().trim().isLength({ max: 2 }),
    body('pieces').optional().isInt({ min: 0 }),
    body('weight').optional().isDecimal(),
    body('description').optional().trim(),
    body('hazmat').optional().isBoolean(),
    body('sequence').optional().isInt({ min: 1 })
  ],
  validateRequest,
  addTripShipment
);

// Bulk add shipments to trip (Admin/Dispatcher only)
router.post(
  '/:tripId/shipments/bulk',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    body('shipments').isArray({ min: 1 }),
    body('shipments.*.proNumber').optional().trim(),
    body('shipments.*.bookingId').optional().isInt({ min: 1 }),
    body('shipments.*.pieces').optional().isInt({ min: 0 }),
    body('shipments.*.weight').optional().isDecimal(),
    body('shipments.*.hazmat').optional().isBoolean()
  ],
  validateRequest,
  bulkAddTripShipments
);

// Reorder shipments (Admin/Dispatcher only)
router.put(
  '/:tripId/shipments/reorder',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    body('shipmentIds').isArray({ min: 1 }),
    body('shipmentIds.*').isInt({ min: 1 })
  ],
  validateRequest,
  reorderTripShipments
);

// Update shipment (Admin/Dispatcher only)
router.put(
  '/:tripId/shipments/:shipmentId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    param('shipmentId').isInt({ min: 1 }),
    body('proNumber').optional().trim(),
    body('bookingId').optional().isInt({ min: 1 }),
    body('originCity').optional().trim(),
    body('originState').optional().trim().isLength({ max: 2 }),
    body('destinationCity').optional().trim(),
    body('destinationState').optional().trim().isLength({ max: 2 }),
    body('pieces').optional().isInt({ min: 0 }),
    body('weight').optional().isDecimal(),
    body('description').optional().trim(),
    body('hazmat').optional().isBoolean(),
    body('sequence').optional().isInt({ min: 1 })
  ],
  validateRequest,
  updateTripShipment
);

// Delete shipment (Admin/Dispatcher only)
router.delete(
  '/:tripId/shipments/:shipmentId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    param('shipmentId').isInt({ min: 1 })
  ],
  validateRequest,
  deleteTripShipment
);

// ==================== TRIP DELAYS ====================

// Get all delays for a trip
router.get(
  '/:tripId/delays',
  [param('tripId').isInt({ min: 1 })],
  validateRequest,
  getTripDelays
);

// Report delay for a trip (Admin/Dispatcher only)
router.post(
  '/:tripId/delays',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    body('delayCode').notEmpty().isIn([
      'EQUIPMENT_BREAKDOWN',
      'DRIVER_UNAVAILABILITY',
      'WEATHER_CONDITIONS',
      'TRAFFIC_ROAD_CONDITIONS',
      'SHIPPER_DELAY',
      'RECEIVER_DELAY',
      'DETENTION',
      'OTHER'
    ]),
    body('description').optional().trim(),
    body('estimatedDelayMinutes').optional().isInt({ min: 0 }),
    body('location').optional().trim(),
    body('latitude').optional().isDecimal(),
    body('longitude').optional().isDecimal()
  ],
  validateRequest,
  reportTripDelay
);

// Update delay (Admin/Dispatcher only)
router.put(
  '/:tripId/delays/:delayId',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    param('delayId').isInt({ min: 1 }),
    body('delayCode').optional().isIn([
      'EQUIPMENT_BREAKDOWN',
      'DRIVER_UNAVAILABILITY',
      'WEATHER_CONDITIONS',
      'TRAFFIC_ROAD_CONDITIONS',
      'SHIPPER_DELAY',
      'RECEIVER_DELAY',
      'DETENTION',
      'OTHER'
    ]),
    body('description').optional().trim(),
    body('estimatedDelayMinutes').optional().isInt({ min: 0 }),
    body('actualDelayMinutes').optional().isInt({ min: 0 }),
    body('location').optional().trim(),
    body('resolved').optional().isBoolean(),
    body('resolvedAt').optional().isISO8601()
  ],
  validateRequest,
  updateTripDelay
);

// Resolve delay (Admin/Dispatcher only)
router.patch(
  '/:tripId/delays/:delayId/resolve',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  [
    param('tripId').isInt({ min: 1 }),
    param('delayId').isInt({ min: 1 }),
    body('actualDelayMinutes').optional().isInt({ min: 0 }),
    body('notes').optional().trim()
  ],
  validateRequest,
  resolveTripDelay
);

// Delete delay (Admin only)
router.delete(
  '/:tripId/delays/:delayId',
  authorize(UserRole.ADMIN),
  [
    param('tripId').isInt({ min: 1 }),
    param('delayId').isInt({ min: 1 })
  ],
  validateRequest,
  deleteTripDelay
);

export default router;
