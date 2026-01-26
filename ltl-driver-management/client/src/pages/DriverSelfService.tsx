import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Clock, CheckCircle, AlertCircle, ChevronRight, ArrowLeft, Star, LogOut, Play, Flag } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// API base URL - use relative path for same-origin requests
const API_BASE = '/api/public/driver';

// Types
interface Driver {
  id: number;
  name: string;
  number: string;
  status: string;
  verified: boolean;
}

interface Terminal {
  code: string;
  name: string;
  city?: string;
  state?: string;
}

interface LinehaulProfile {
  id: number;
  profileCode: string;
  name: string;
  transitTimeMinutes?: number;
  originTerminal?: Terminal;
  destinationTerminal?: Terminal;
}

interface Loadsheet {
  id: number;
  manifestNumber: string;
  linehaulName?: string;
  originTerminalCode?: string;
  destinationTerminalCode?: string;
  sealNumber?: string;
  pieces?: number;
  weight?: number;
}

interface Trip {
  id: number;
  tripNumber: string;
  status: string;
  dispatchDate: string;
  plannedDeparture?: string;
  actualDeparture?: string;
  plannedArrival?: string;
  linehaulProfile?: LinehaulProfile;
  truck?: { id: number; unitNumber: string };
  trailer?: { id: number; unitNumber: string };
  trailer2?: { id: number; unitNumber: string };
  dolly?: { id: number; unitNumber: string };
  dolly2?: { id: number; unitNumber: string };
  loadsheets?: Loadsheet[];
}

// Wait time reason options
const WAIT_TIME_REASONS = [
  { value: 'LATE_MEET_DRIVER', label: 'Late meet driver' },
  { value: 'DOCK_DELAY', label: 'Dock delay' },
  { value: 'BREAKDOWN', label: 'Breakdown' }
];

// Equipment issue types
const EQUIPMENT_ISSUE_TYPES = [
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'DOLLY', label: 'Dolly' }
];

export const DriverSelfService: React.FC = () => {
  // State management
  const [step, setStep] = useState<'verify' | 'trips' | 'dispatch' | 'arrive'>('verify');
  const [isLoading, setIsLoading] = useState(false);

  // Driver verification state
  const [driverNumber, setDriverNumber] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [driver, setDriver] = useState<Driver | null>(null);

  // Trips state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Arrival form state
  const [dropAndHook, setDropAndHook] = useState('');
  const [chainUpCycles, setChainUpCycles] = useState('');
  const [hasWaitTime, setHasWaitTime] = useState(false);
  const [waitTimeStart, setWaitTimeStart] = useState('');
  const [waitTimeEnd, setWaitTimeEnd] = useState('');
  const [waitTimeReason, setWaitTimeReason] = useState('');
  const [notes, setNotes] = useState('');
  const [hasEquipmentIssue, setHasEquipmentIssue] = useState(false);
  const [equipmentIssueType, setEquipmentIssueType] = useState('');
  const [equipmentIssueNumber, setEquipmentIssueNumber] = useState('');
  const [equipmentIssueDescription, setEquipmentIssueDescription] = useState('');
  const [moraleRating, setMoraleRating] = useState<number>(0);

  // Verify driver
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverNumber, phoneLast4 })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Verification failed');
      }

      const data = await response.json();
      setDriver(data);
      await loadTrips(data.id);
      setStep('trips');
      toast.success(`Welcome, ${data.name}!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify driver');
    } finally {
      setIsLoading(false);
    }
  };

  // Load driver's trips
  const loadTrips = async (driverId: number) => {
    try {
      const response = await fetch(`${API_BASE}/trips/${driverId}`);
      if (!response.ok) throw new Error('Failed to load trips');
      const data = await response.json();
      setTrips(data.trips || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load trips');
    }
  };

  // Dispatch a trip
  const handleDispatch = async () => {
    if (!selectedTrip || !driver) return;
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/trip/${selectedTrip.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to dispatch trip');
      }

      toast.success('Trip dispatched successfully! Drive safe!');
      await loadTrips(driver.id);
      setSelectedTrip(null);
      setStep('trips');
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch trip');
    } finally {
      setIsLoading(false);
    }
  };

  // Arrive a trip
  const handleArrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !driver) return;
    setIsLoading(true);

    try {
      const payload: any = {
        driverId: driver.id,
        dropAndHook: dropAndHook ? parseInt(dropAndHook) : undefined,
        chainUpCycles: chainUpCycles ? parseInt(chainUpCycles) : undefined,
        notes: notes || undefined,
        moraleRating: moraleRating > 0 ? moraleRating : undefined
      };

      if (hasWaitTime && waitTimeStart && waitTimeEnd) {
        payload.waitTimeStart = waitTimeStart;
        payload.waitTimeEnd = waitTimeEnd;
        payload.waitTimeReason = waitTimeReason;
      }

      if (hasEquipmentIssue && equipmentIssueType && equipmentIssueNumber && equipmentIssueDescription) {
        payload.equipmentIssue = {
          equipmentType: equipmentIssueType,
          equipmentNumber: equipmentIssueNumber,
          description: equipmentIssueDescription
        };
      }

      const response = await fetch(`${API_BASE}/trip/${selectedTrip.id}/arrive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to arrive trip');
      }

      toast.success('Trip arrived successfully!');
      resetArrivalForm();
      await loadTrips(driver.id);
      setSelectedTrip(null);
      setStep('trips');
    } catch (error: any) {
      toast.error(error.message || 'Failed to arrive trip');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset arrival form
  const resetArrivalForm = () => {
    setDropAndHook('');
    setChainUpCycles('');
    setHasWaitTime(false);
    setWaitTimeStart('');
    setWaitTimeEnd('');
    setWaitTimeReason('');
    setNotes('');
    setHasEquipmentIssue(false);
    setEquipmentIssueType('');
    setEquipmentIssueNumber('');
    setEquipmentIssueDescription('');
    setMoraleRating(0);
  };

  // Logout
  const handleLogout = () => {
    setDriver(null);
    setTrips([]);
    setSelectedTrip(null);
    setDriverNumber('');
    setPhoneLast4('');
    resetArrivalForm();
    setStep('verify');
  };

  // Select trip for action
  const selectTrip = (trip: Trip, action: 'dispatch' | 'arrive') => {
    setSelectedTrip(trip);
    setStep(action);
  };

  // Format date for display
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
      case 'DISPATCHED':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800';
      case 'ARRIVED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Render verification form
  const renderVerifyForm = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Portal</h1>
          <p className="text-gray-500 mt-2">Dispatch and arrive your trips</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Number
            </label>
            <input
              type="text"
              value={driverNumber}
              onChange={(e) => setDriverNumber(e.target.value)}
              placeholder="Enter your driver number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              required
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last 4 digits of phone
            </label>
            <input
              type="text"
              value={phoneLast4}
              onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Last 4 digits"
              maxLength={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg text-center tracking-widest"
              required
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || driverNumber.length === 0 || phoneLast4.length !== 4}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <span className="animate-pulse">Verifying...</span>
            ) : (
              <>
                Sign In
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  // Render trips list
  const renderTripsList = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Welcome back</p>
            <h1 className="text-xl font-semibold">{driver?.name}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Active Trips</h2>

        {trips.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No active trips at this time</p>
            <button
              onClick={() => loadTrips(driver!.id)}
              className="mt-4 text-blue-600 font-medium"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  {/* Trip header */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm text-gray-500">
                      #{trip.tripNumber}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                      {trip.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="flex items-center mb-3">
                    <div className="flex-1">
                      <div className="flex items-center text-gray-900">
                        <MapPin className="w-4 h-4 text-blue-500 mr-1" />
                        <span className="font-medium">
                          {trip.linehaulProfile?.originTerminal?.code || '-'}
                        </span>
                        <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
                        <span className="font-medium">
                          {trip.linehaulProfile?.destinationTerminal?.code || '-'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {trip.linehaulProfile?.name || 'Unknown Route'}
                      </p>
                    </div>
                  </div>

                  {/* Equipment */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {trip.truck && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs">
                        <Truck className="w-3 h-3 mr-1" />
                        {trip.truck.unitNumber}
                      </span>
                    )}
                    {trip.trailer && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs">
                        Trailer: {trip.trailer.unitNumber}
                      </span>
                    )}
                    {trip.dolly && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs">
                        Dolly: {trip.dolly.unitNumber}
                      </span>
                    )}
                  </div>

                  {/* Manifests */}
                  {trip.loadsheets && trip.loadsheets.length > 0 && (
                    <div className="mb-3 text-sm">
                      <span className="text-gray-500">Manifests: </span>
                      <span className="font-medium">
                        {trip.loadsheets.map(ls => ls.manifestNumber).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Scheduled time */}
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <Clock className="w-4 h-4 mr-1" />
                    {formatDateTime(trip.plannedDeparture || trip.dispatchDate)}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {(trip.status === 'ASSIGNED' || trip.status === 'DISPATCHED') && (
                      <button
                        onClick={() => selectTrip(trip, 'dispatch')}
                        className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 flex items-center justify-center"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Trip
                      </button>
                    )}
                    {trip.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => selectTrip(trip, 'arrive')}
                        className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        Arrive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={() => loadTrips(driver!.id)}
          className="w-full mt-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
        >
          Refresh Trips
        </button>
      </div>
    </div>
  );

  // Render dispatch confirmation
  const renderDispatchConfirm = () => (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-10">
        <button
          onClick={() => { setSelectedTrip(null); setStep('trips'); }}
          className="flex items-center text-blue-100 hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <h1 className="text-xl font-semibold">Start Trip</h1>
      </div>

      {/* Content */}
      <div className="p-4">
        {selectedTrip && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Ready to Depart?</h2>
              <p className="text-gray-500 mt-2">Confirm you're starting trip #{selectedTrip.tripNumber}</p>
            </div>

            {/* Trip details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center mb-4">
                <span className="text-lg font-bold">
                  {selectedTrip.linehaulProfile?.originTerminal?.code}
                </span>
                <ChevronRight className="w-5 h-5 mx-2 text-gray-400" />
                <span className="text-lg font-bold">
                  {selectedTrip.linehaulProfile?.destinationTerminal?.code}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Power Unit</span>
                  <p className="font-medium">{selectedTrip.truck?.unitNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Trailer</span>
                  <p className="font-medium">{selectedTrip.trailer?.unitNumber || '-'}</p>
                </div>
                {selectedTrip.loadsheets && selectedTrip.loadsheets.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Manifests</span>
                    <p className="font-medium">
                      {selectedTrip.loadsheets.map(ls => ls.manifestNumber).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleDispatch}
                disabled={isLoading}
                className="w-full py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? (
                  <span className="animate-pulse">Processing...</span>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirm Departure
                  </>
                )}
              </button>

              <button
                onClick={() => { setSelectedTrip(null); setStep('trips'); }}
                disabled={isLoading}
                className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render arrival form
  const renderArrivalForm = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-10">
        <button
          onClick={() => { setSelectedTrip(null); resetArrivalForm(); setStep('trips'); }}
          className="flex items-center text-blue-100 hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <h1 className="text-xl font-semibold">Arrive Trip</h1>
        <p className="text-blue-100 text-sm">#{selectedTrip?.tripNumber}</p>
      </div>

      {/* Content */}
      <form onSubmit={handleArrive} className="p-4 space-y-4">
        {/* Trip info summary */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-center mb-2">
            <span className="font-bold">
              {selectedTrip?.linehaulProfile?.originTerminal?.code}
            </span>
            <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
            <span className="font-bold">
              {selectedTrip?.linehaulProfile?.destinationTerminal?.code}
            </span>
          </div>
          <p className="text-center text-sm text-gray-500">
            {selectedTrip?.linehaulProfile?.name}
          </p>
        </div>

        {/* Drop and Hook / Chain Up */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-3">Trip Details</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Drop & Hook</label>
              <input
                type="number"
                min="0"
                value={dropAndHook}
                onChange={(e) => setDropAndHook(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Chain Up Cycles</label>
              <input
                type="number"
                min="0"
                value={chainUpCycles}
                onChange={(e) => setChainUpCycles(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
              />
            </div>
          </div>
        </div>

        {/* Wait Time */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Wait Time</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasWaitTime}
                onChange={(e) => setHasWaitTime(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {hasWaitTime && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={waitTimeStart}
                  onChange={(e) => setWaitTimeStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={waitTimeEnd}
                  onChange={(e) => setWaitTimeEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Reason</label>
                <select
                  value={waitTimeReason}
                  onChange={(e) => setWaitTimeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select reason</option>
                  {WAIT_TIME_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Equipment Issue */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Equipment Issue</h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasEquipmentIssue}
                onChange={(e) => setHasEquipmentIssue(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {hasEquipmentIssue && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Equipment Type</label>
                <select
                  value={equipmentIssueType}
                  onChange={(e) => setEquipmentIssueType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select type</option>
                  {EQUIPMENT_ISSUE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Equipment Number</label>
                <input
                  type="text"
                  value={equipmentIssueNumber}
                  onChange={(e) => setEquipmentIssueNumber(e.target.value)}
                  placeholder="e.g., TRL-1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Description</label>
                <textarea
                  value={equipmentIssueDescription}
                  onChange={(e) => setEquipmentIssueDescription(e.target.value)}
                  placeholder="Describe the issue..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-2">Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
          />
        </div>

        {/* Morale Rating */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block font-medium text-gray-900 mb-3 text-center">How was your trip?</label>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setMoraleRating(star)}
                className={`p-2 rounded-full transition-colors ${
                  moraleRating >= star ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                <Star className="w-8 h-8" fill={moraleRating >= star ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>

        {/* Submit button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <span className="animate-pulse">Submitting...</span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Submit Arrival
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <>
      <Toaster position="top-center" />
      {step === 'verify' && renderVerifyForm()}
      {step === 'trips' && driver && renderTripsList()}
      {step === 'dispatch' && selectedTrip && renderDispatchConfirm()}
      {step === 'arrive' && selectedTrip && renderArrivalForm()}
    </>
  );
};

export default DriverSelfService;
