import { Router } from 'express';
import {
  getLocations,
  getLocationById,
  getLocationByCode,
  searchLocations,
  createLocation,
  updateLocation,
  deleteLocation
} from '../controllers/location.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/locations - Get all locations with pagination and filtering
router.get('/', getLocations);

// GET /api/locations/search - Search locations for autocomplete
router.get('/search', searchLocations);

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

export default router;