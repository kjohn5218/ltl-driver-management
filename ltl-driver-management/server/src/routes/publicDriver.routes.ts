import { Router } from 'express';
import {
  verifyDriver,
  getDriverTrips,
  dispatchTrip,
  arriveTrip,
  getTripDetails,
  getAvailableLoadsheets,
  getAvailableEquipment,
  getLinehaulProfiles,
  createAndDispatchTrip,
  createCutPayRequest,
  getDriverCutPayRequests
} from '../controllers/publicDriver.controller';

/**
 * Public Driver Routes
 * These routes are accessible without SSO/user authentication.
 * Drivers authenticate using their driver number + phone last 4 digits.
 */
const router = Router();

// Verify driver identity (no auth required)
router.post('/verify', verifyDriver);

// Get driver's trips from past 7 days
router.get('/trips/:driverId', getDriverTrips);

// Get trip details
router.get('/trip/:tripId', getTripDetails);

// Get available loadsheets for dispatch
router.get('/loadsheets', getAvailableLoadsheets);

// Get available equipment (trucks, dollies, trailers)
router.get('/equipment', getAvailableEquipment);

// Get linehaul profiles
router.get('/profiles', getLinehaulProfiles);

// Create and dispatch a new trip
router.post('/dispatch', createAndDispatchTrip);

// Update trip status to IN_TRANSIT (for already created trips)
router.post('/trip/:tripId/dispatch', dispatchTrip);

// Arrive a trip (driver submits arrival details)
router.post('/trip/:tripId/arrive', arriveTrip);

// Create a cut pay request
router.post('/cut-pay', createCutPayRequest);

// Get driver's cut pay requests
router.get('/cut-pay/:driverId', getDriverCutPayRequests);

export default router;
