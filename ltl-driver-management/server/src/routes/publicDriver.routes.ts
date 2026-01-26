import { Router } from 'express';
import {
  verifyDriver,
  getDriverActiveTrips,
  dispatchTrip,
  arriveTrip,
  getTripDetails
} from '../controllers/publicDriver.controller';

/**
 * Public Driver Routes
 * These routes are accessible without SSO/user authentication.
 * Drivers authenticate using their driver number + phone last 4 digits.
 */
const router = Router();

// Verify driver identity (no auth required)
router.post('/verify', verifyDriver);

// Get driver's active trips (for dispatch/arrive)
router.get('/trips/:driverId', getDriverActiveTrips);

// Get trip details
router.get('/trip/:tripId', getTripDetails);

// Dispatch a trip (driver confirms departure)
router.post('/trip/:tripId/dispatch', dispatchTrip);

// Arrive a trip (driver submits arrival details)
router.post('/trip/:tripId/arrive', arriveTrip);

export default router;
