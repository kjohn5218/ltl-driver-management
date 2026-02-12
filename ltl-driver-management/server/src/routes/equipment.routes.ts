import { Router } from 'express';
import { body, query, param } from 'express-validator';
import {
  // Trucks
  getTrucks,
  getTruckById,
  createTruck,
  updateTruck,
  deleteTruck,
  updateTruckStatus,
  updateTruckLocation,
  // Trailers
  getTrailers,
  getTrailerById,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  updateTrailerStatus,
  // Dollies
  getDollies,
  getDollyById,
  createDolly,
  updateDolly,
  deleteDolly,
  updateDollyStatus,
  // Lists
  getAvailableEquipment,
  // FormsApp Sync
  syncEquipment,
  syncTrucks,
  syncTrailers,
  syncDollies,
  getSyncStatus,
  // Motive GPS
  syncVehicleLocations,
  getVehicleLocations,
  getTruckLocation,
  getMotiveSyncStatus
} from '../controllers/equipment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== TRUCKS ====================

// Get all trucks
router.get(
  '/trucks',
  [
    query('search').optional().trim(),
    query('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    query('type').optional().isIn(['DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK']),
    query('terminalId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('available').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 2000 })
  ],
  validateRequest,
  getTrucks
);

// Get truck by ID
router.get(
  '/trucks/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTruckById
);

// Create truck (Admin/Dispatcher/Yard Manager only)
router.post(
  '/trucks',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    body('unitNumber').notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('assignedDriverId').optional().isInt({ min: 1 }),
    body('fuelType').optional().trim(),
    body('odometerReading').optional().isInt({ min: 0 }),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  ],
  validateRequest,
  createTruck
);

// Update truck (Admin/Dispatcher/Yard Manager only)
router.put(
  '/trucks/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('unitNumber').optional().notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['DAY_CAB', 'SLEEPER', 'STRAIGHT_TRUCK']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('assignedDriverId').optional().isInt({ min: 1 }),
    body('fuelType').optional().trim(),
    body('odometerReading').optional().isInt({ min: 0 }),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('currentLatitude').optional().isDecimal(),
    body('currentLongitude').optional().isDecimal()
  ],
  validateRequest,
  updateTruck
);

// Delete truck (Admin only)
router.delete(
  '/trucks/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteTruck
);

// Update truck status (Admin/Dispatcher/Yard Manager only)
router.patch(
  '/trucks/:id/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateTruckStatus
);

// Update truck location
router.patch(
  '/trucks/:id/location',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('latitude').notEmpty().isDecimal(),
    body('longitude').notEmpty().isDecimal()
  ],
  validateRequest,
  updateTruckLocation
);

// ==================== TRAILERS ====================

// Get all trailers
router.get(
  '/trailers',
  [
    query('search').optional().trim(),
    query('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    query('type').optional().isIn(['DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL']),
    query('terminalId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('available').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 2000 })
  ],
  validateRequest,
  getTrailers
);

// Get trailer by ID
router.get(
  '/trailers/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getTrailerById
);

// Create trailer (Admin/Dispatcher/Yard Manager only)
router.post(
  '/trailers',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    body('unitNumber').notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('length').optional().isInt({ min: 1 }),
    body('capacity').optional().isInt({ min: 1 }),
    body('doorType').optional().trim(),
    body('hasLiftGate').optional().isBoolean(),
    body('hasETrack').optional().isBoolean(),
    body('temperatureControlled').optional().isBoolean(),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  ],
  validateRequest,
  createTrailer
);

// Update trailer (Admin/Dispatcher/Yard Manager only)
router.put(
  '/trailers/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('unitNumber').optional().notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['DRY_VAN_53', 'DRY_VAN_28', 'PUP_TRAILER', 'REEFER_53', 'REEFER_28', 'FLATBED', 'STEP_DECK', 'TANKER', 'INTERMODAL']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('length').optional().isInt({ min: 1 }),
    body('capacity').optional().isInt({ min: 1 }),
    body('doorType').optional().trim(),
    body('hasLiftGate').optional().isBoolean(),
    body('hasETrack').optional().isBoolean(),
    body('temperatureControlled').optional().isBoolean(),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('currentLatitude').optional().isDecimal(),
    body('currentLongitude').optional().isDecimal()
  ],
  validateRequest,
  updateTrailer
);

// Delete trailer (Admin only)
router.delete(
  '/trailers/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteTrailer
);

// Update trailer status (Admin/Dispatcher/Yard Manager only)
router.patch(
  '/trailers/:id/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateTrailerStatus
);

// ==================== DOLLIES ====================

// Get all dollies
router.get(
  '/dollies',
  [
    query('search').optional().trim(),
    query('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    query('type').optional().isIn(['A_DOLLY', 'B_DOLLY']),
    query('terminalId').optional().isInt({ min: 1 }),
    query('carrierId').optional().isInt({ min: 1 }),
    query('available').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 2000 })
  ],
  validateRequest,
  getDollies
);

// Get dolly by ID
router.get(
  '/dollies/:id',
  [param('id').isInt({ min: 1 })],
  validateRequest,
  getDollyById
);

// Create dolly (Admin/Dispatcher/Yard Manager only)
router.post(
  '/dollies',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    body('unitNumber').notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['A_DOLLY', 'B_DOLLY']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE'])
  ],
  validateRequest,
  createDolly
);

// Update dolly (Admin/Dispatcher/Yard Manager only)
router.put(
  '/dollies/:id',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('unitNumber').optional().notEmpty().trim(),
    body('vin').optional().trim().isLength({ min: 17, max: 17 }),
    body('type').optional().isIn(['A_DOLLY', 'B_DOLLY']),
    body('make').optional().trim(),
    body('model').optional().trim(),
    body('year').optional().isInt({ min: 1900, max: 2100 }),
    body('licensePlate').optional().trim(),
    body('licensePlateState').optional().trim().isLength({ min: 2, max: 2 }),
    body('currentTerminalId').optional().isInt({ min: 1 }),
    body('carrierId').optional().isInt({ min: 1 }),
    body('lastMaintenanceDate').optional().isISO8601(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('insuranceExpiration').optional().isISO8601(),
    body('registrationExpiration').optional().isISO8601(),
    body('status').optional().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('currentLatitude').optional().isDecimal(),
    body('currentLongitude').optional().isDecimal()
  ],
  validateRequest,
  updateDolly
);

// Delete dolly (Admin only)
router.delete(
  '/dollies/:id',
  authorize(UserRole.ADMIN),
  [param('id').isInt({ min: 1 })],
  validateRequest,
  deleteDolly
);

// Update dolly status (Admin/Dispatcher/Yard Manager only)
router.patch(
  '/dollies/:id/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  [
    param('id').isInt({ min: 1 }),
    body('status').notEmpty().isIn(['AVAILABLE', 'DISPATCHED', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE']),
    body('notes').optional().trim()
  ],
  validateRequest,
  updateDollyStatus
);

// ==================== TERMINAL EQUIPMENT ====================

// Get available equipment at a terminal
router.get(
  '/terminal/:terminalId/available',
  [param('terminalId').isInt({ min: 1 })],
  validateRequest,
  getAvailableEquipment
);

// ==================== FORMSAPP SYNC ====================

// Sync all equipment from FormsApp (Admin only)
router.post(
  '/sync',
  authorize(UserRole.ADMIN),
  syncEquipment
);

// Sync trucks only from FormsApp (Admin/Dispatcher)
router.post(
  '/trucks/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncTrucks
);

// Sync trailers only from FormsApp (Admin/Dispatcher)
router.post(
  '/trailers/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncTrailers
);

// Sync dollies only from FormsApp (Admin/Dispatcher)
router.post(
  '/dollies/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncDollies
);

// Get sync status
router.get(
  '/sync/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  getSyncStatus
);

// ==================== MOTIVE GPS TRACKING ====================

// Sync vehicle locations from Motive (updates truck lat/lon)
router.post(
  '/locations/sync',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  syncVehicleLocations
);

// Get all current vehicle locations (for map display)
router.get(
  '/locations',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.YARD_MANAGER),
  getVehicleLocations
);

// Get location for a specific truck
router.get(
  '/trucks/:unitNumber/location',
  getTruckLocation
);

// Get Motive sync status
router.get(
  '/locations/sync/status',
  authorize(UserRole.ADMIN, UserRole.DISPATCHER),
  getMotiveSyncStatus
);

export default router;
