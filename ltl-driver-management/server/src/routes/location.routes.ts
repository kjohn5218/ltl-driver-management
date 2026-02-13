import { Router } from 'express';
import {
  getLocations,
  getLocationById,
  getLocationByCode,
  searchLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getTerminalLocations,
  lookupMileage,
  getLocationsList,
  getLocationEquipmentSummary,
  getLocationEquipmentRequirements,
  upsertLocationEquipmentRequirement,
  bulkUpdateLocationEquipmentRequirements,
  deleteLocationEquipmentRequirement,
  getLocationEquipmentAvailability
} from '../controllers/location.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/locations - Get all locations with pagination and filtering
router.get('/', getLocations);

// GET /api/locations/list - Simple list for dropdowns (active locations only)
router.get('/list', getLocationsList);

// GET /api/locations/search - Search locations for autocomplete
router.get('/search', searchLocations);

// GET /api/locations/terminals - Get locations that are terminals (for Okay to Load/Dispatch)
router.get('/terminals', getTerminalLocations);

// GET /api/locations/mileage - Lookup mileage between two locations (profile first, GPS fallback)
router.get('/mileage', lookupMileage);

// GET /api/locations/code/:code - Get location by code
router.get('/code/:code', getLocationByCode);

// GET /api/locations/:id - Get location by ID
router.get('/:id', getLocationById);

// POST /api/locations - Create new location
router.post('/', createLocation);

// PUT /api/locations/:id - Update location
router.put('/:id', updateLocation);

// DELETE /api/locations/:id - Delete location
router.delete('/:id', deleteLocation);

// ==================== EQUIPMENT FUNCTIONALITY (migrated from Terminal) ====================

// GET /api/locations/:id/equipment-summary - Get equipment status breakdown
router.get('/:id/equipment-summary', getLocationEquipmentSummary);

// GET /api/locations/:id/availability - Get equipment availability vs requirements
router.get('/:id/availability', getLocationEquipmentAvailability);

// GET /api/locations/:id/requirements - Get equipment requirements
router.get('/:id/requirements', getLocationEquipmentRequirements);

// POST /api/locations/:id/requirements - Create/update single requirement
router.post('/:id/requirements', upsertLocationEquipmentRequirement);

// PUT /api/locations/:id/requirements - Bulk update requirements
router.put('/:id/requirements', bulkUpdateLocationEquipmentRequirements);

// DELETE /api/locations/:id/requirements/:requirementId - Delete requirement
router.delete('/:id/requirements/:requirementId', deleteLocationEquipmentRequirement);

export default router;