import React, { useState, useEffect, useMemo } from 'react';
import { Truck, MapPin, Clock, CheckCircle, ChevronRight, ArrowLeft, Star, LogOut, Flag, Search, Plus, X, Package } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// API base URL
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
  trailerNumber?: string;
  originTerminalCode?: string;
  destinationTerminalCode?: string;
  pieces?: number;
  weight?: number;
}

interface EquipmentTruck {
  id: number;
  unitNumber: string;
  truckType: string;
}

interface EquipmentDolly {
  id: number;
  unitNumber: string;
  dollyType: string;
}

interface Trip {
  id: number;
  tripNumber: string;
  status: string;
  dispatchDate: string;
  plannedDeparture?: string;
  actualDeparture?: string;
  actualArrival?: string;
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

  // Dispatch form state
  const [availableLoadsheets, setAvailableLoadsheets] = useState<Loadsheet[]>([]);
  const [availableTrucks, setAvailableTrucks] = useState<EquipmentTruck[]>([]);
  const [availableDollies, setAvailableDollies] = useState<EquipmentDolly[]>([]);
  const [selectedLoadsheets, setSelectedLoadsheets] = useState<Loadsheet[]>([]);
  const [selectedDolly, setSelectedDolly] = useState<EquipmentDolly | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<EquipmentTruck | null>(null);
  const [isOwnerOperator, setIsOwnerOperator] = useState(false);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [loadsheetSearch, setLoadsheetSearch] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [dollySearch, setDollySearch] = useState('');

  // Arrival form state
  const [dropAndHook, setDropAndHook] = useState('');
  const [chainUpCycles, setChainUpCycles] = useState('');
  const [hasWaitTime, setHasWaitTime] = useState(false);
  const [waitTimeStart, setWaitTimeStart] = useState('');
  const [waitTimeEnd, setWaitTimeEnd] = useState('');
  const [waitTimeReason, setWaitTimeReason] = useState('');
  const [arrivalNotes, setArrivalNotes] = useState('');
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

  // Load driver's trips (past 7 days)
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

  // Load equipment and loadsheets for dispatch
  const loadDispatchData = async () => {
    try {
      const [loadsheetsRes, equipmentRes] = await Promise.all([
        fetch(`${API_BASE}/loadsheets`),
        fetch(`${API_BASE}/equipment`)
      ]);

      if (loadsheetsRes.ok) {
        const loadsheets = await loadsheetsRes.json();
        setAvailableLoadsheets(loadsheets);
      }

      if (equipmentRes.ok) {
        const equipment = await equipmentRes.json();
        setAvailableTrucks(equipment.trucks || []);
        setAvailableDollies(equipment.dollies || []);
      }
    } catch (error) {
      console.error('Error loading dispatch data:', error);
    }
  };

  // Filter loadsheets based on search
  const filteredLoadsheets = useMemo(() => {
    if (!loadsheetSearch.trim()) return availableLoadsheets.slice(0, 20);
    const search = loadsheetSearch.toLowerCase();
    return availableLoadsheets
      .filter(ls =>
        ls.manifestNumber?.toLowerCase().includes(search) ||
        ls.linehaulName?.toLowerCase().includes(search) ||
        ls.trailerNumber?.toLowerCase().includes(search)
      )
      .slice(0, 20);
  }, [availableLoadsheets, loadsheetSearch]);

  // Filter trucks based on search
  const filteredTrucks = useMemo(() => {
    if (!truckSearch.trim()) return availableTrucks.slice(0, 20);
    const search = truckSearch.toLowerCase();
    return availableTrucks
      .filter(t => t.unitNumber?.toLowerCase().includes(search))
      .slice(0, 20);
  }, [availableTrucks, truckSearch]);

  // Filter dollies based on search
  const filteredDollies = useMemo(() => {
    if (!dollySearch.trim()) return availableDollies.slice(0, 20);
    const search = dollySearch.toLowerCase();
    return availableDollies
      .filter(d => d.unitNumber?.toLowerCase().includes(search))
      .slice(0, 20);
  }, [availableDollies, dollySearch]);

  // Get origin/destination from selected loadsheets
  const { originCode, destCode } = useMemo(() => {
    if (selectedLoadsheets.length === 0) {
      return { originCode: null, destCode: null };
    }
    const first = selectedLoadsheets[0];
    const last = selectedLoadsheets[selectedLoadsheets.length - 1];
    return {
      originCode: first.originTerminalCode || null,
      destCode: last.destinationTerminalCode || null
    };
  }, [selectedLoadsheets]);

  // Create and dispatch trip
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver || selectedLoadsheets.length === 0) return;

    if (!isOwnerOperator && !selectedTruck) {
      toast.error('Please select a power unit');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          loadsheetIds: selectedLoadsheets.map(ls => ls.id),
          dollyId: selectedDolly?.id,
          truckId: selectedTruck?.id,
          isOwnerOperator,
          notes: dispatchNotes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to dispatch trip');
      }

      toast.success('Trip dispatched successfully! Drive safe!');
      resetDispatchForm();
      await loadTrips(driver.id);
      setStep('trips');
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch trip');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset dispatch form
  const resetDispatchForm = () => {
    setSelectedLoadsheets([]);
    setSelectedDolly(null);
    setSelectedTruck(null);
    setIsOwnerOperator(false);
    setDispatchNotes('');
    setLoadsheetSearch('');
    setTruckSearch('');
    setDollySearch('');
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
        notes: arrivalNotes || undefined,
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
    setArrivalNotes('');
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
    resetDispatchForm();
    resetArrivalForm();
    setStep('verify');
  };

  // Open dispatch form
  const openDispatchForm = async () => {
    setIsLoading(true);
    await loadDispatchData();
    setIsLoading(false);
    setStep('dispatch');
  };

  // Select trip for arrive
  const selectTripForArrive = (trip: Trip) => {
    setSelectedTrip(trip);
    setStep('arrive');
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

  // Format date only
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
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
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Add loadsheet to selection
  const addLoadsheet = (loadsheet: Loadsheet) => {
    if (selectedLoadsheets.length >= 3) {
      toast.error('Maximum 3 manifests allowed');
      return;
    }
    if (selectedLoadsheets.find(ls => ls.id === loadsheet.id)) {
      return;
    }
    setSelectedLoadsheets([...selectedLoadsheets, loadsheet]);
    setLoadsheetSearch('');
  };

  // Remove loadsheet from selection
  const removeLoadsheet = (loadsheetId: number) => {
    setSelectedLoadsheets(selectedLoadsheets.filter(ls => ls.id !== loadsheetId));
  };

  // Render verification form
  const renderVerifyForm = () => (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-8">
          <img src="/ccfs-logo.svg" alt="CCFS Logo" className="h-12 mx-auto mb-4" />
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
          <div className="flex items-center">
            <img src="/ccfs-logo-white.svg" alt="CCFS" className="h-8 mr-3" />
            <div>
              <p className="text-blue-100 text-sm">Welcome back</p>
              <h1 className="text-xl font-semibold">{driver?.name}</h1>
            </div>
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
        {/* Dispatch New Trip Button */}
        <button
          onClick={openDispatchForm}
          disabled={isLoading}
          className="w-full mb-4 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          Dispatch New Trip
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Trips (Last 7 Days)</h2>

        {trips.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No trips in the last 7 days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  {/* Trip header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono text-sm text-gray-500">
                        #{trip.tripNumber}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {formatDate(trip.dispatchDate)}
                      </span>
                    </div>
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

                  {/* Times */}
                  <div className="flex items-center text-sm text-gray-500 mb-4">
                    <Clock className="w-4 h-4 mr-1" />
                    {trip.actualDeparture ? (
                      <span>Departed: {formatDateTime(trip.actualDeparture)}</span>
                    ) : (
                      <span>Scheduled: {formatDateTime(trip.plannedDeparture || trip.dispatchDate)}</span>
                    )}
                    {trip.actualArrival && (
                      <span className="ml-3">Arrived: {formatDateTime(trip.actualArrival)}</span>
                    )}
                  </div>

                  {/* Action buttons - Only show Arrive for IN_TRANSIT trips */}
                  {trip.status === 'IN_TRANSIT' && (
                    <button
                      onClick={() => selectTripForArrive(trip)}
                      className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Arrive Trip
                    </button>
                  )}
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

  // Render dispatch form
  const renderDispatchForm = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 sticky top-0 z-10">
        <button
          onClick={() => { resetDispatchForm(); setStep('trips'); }}
          className="flex items-center text-blue-100 hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <h1 className="text-xl font-semibold">Dispatch New Trip</h1>
        <p className="text-blue-100 text-sm">Driver: {driver?.name}</p>
      </div>

      {/* Content */}
      <form onSubmit={handleDispatch} className="p-4 space-y-4">
        {/* Manifest Selection */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-500" />
            Select Manifests (up to 3) *
          </h3>

          {/* Selected manifests */}
          {selectedLoadsheets.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedLoadsheets.map((ls, index) => (
                <div key={ls.id} className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                  <div>
                    <span className="text-xs text-gray-500">Manifest {index + 1}</span>
                    <p className="font-medium text-gray-900">{ls.manifestNumber}</p>
                    <p className="text-sm text-gray-500">{ls.linehaulName} - {ls.trailerNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLoadsheet(ls.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search and add */}
          {selectedLoadsheets.length < 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={loadsheetSearch}
                onChange={(e) => setLoadsheetSearch(e.target.value)}
                placeholder="Search by manifest number..."
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg"
              />
              {loadsheetSearch && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredLoadsheets.length > 0 ? (
                    filteredLoadsheets
                      .filter(ls => !selectedLoadsheets.find(s => s.id === ls.id))
                      .map((ls) => (
                        <button
                          key={ls.id}
                          type="button"
                          onClick={() => addLoadsheet(ls)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <span className="font-medium">{ls.manifestNumber}</span>
                          <span className="text-gray-500 ml-2 text-sm">
                            {ls.linehaulName} - {ls.trailerNumber}
                          </span>
                        </button>
                      ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500">No manifests found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Origin & Destination (auto-populated) */}
        {selectedLoadsheets.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Origin</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg font-medium">
                  {originCode || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Destination</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg font-medium">
                  {destCode || '-'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dolly Selection */}
        {selectedLoadsheets.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-medium text-gray-900 mb-3">Converter Dolly</h3>

            {selectedDolly ? (
              <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{selectedDolly.unitNumber}</p>
                  <p className="text-sm text-gray-500">{selectedDolly.dollyType}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedDolly(null); setDollySearch(''); }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={dollySearch}
                  onChange={(e) => setDollySearch(e.target.value)}
                  placeholder="Search dollies..."
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg"
                />
                {dollySearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredDollies.length > 0 ? (
                      filteredDollies.map((dolly) => (
                        <button
                          key={dolly.id}
                          type="button"
                          onClick={() => { setSelectedDolly(dolly); setDollySearch(''); }}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <span className="font-medium">{dolly.unitNumber}</span>
                          <span className="text-gray-500 ml-2">- {dolly.dollyType}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500">No dollies found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Owner Operator Toggle */}
        {selectedLoadsheets.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Owner Operator?</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOwnerOperator}
                  onChange={(e) => {
                    setIsOwnerOperator(e.target.checked);
                    if (e.target.checked) {
                      setSelectedTruck(null);
                      setTruckSearch('');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {isOwnerOperator ? (
              <div className="px-3 py-2 bg-blue-50 rounded-lg text-blue-700 font-medium">
                OWNOP (Owner Operator)
              </div>
            ) : (
              <>
                <label className="block text-sm text-gray-500 mb-2">Power Unit *</label>
                {selectedTruck ? (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{selectedTruck.unitNumber}</p>
                      <p className="text-sm text-gray-500">{selectedTruck.truckType}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedTruck(null); setTruckSearch(''); }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={truckSearch}
                      onChange={(e) => setTruckSearch(e.target.value)}
                      placeholder="Search power units..."
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg"
                    />
                    {truckSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredTrucks.length > 0 ? (
                          filteredTrucks.map((truck) => (
                            <button
                              key={truck.id}
                              type="button"
                              onClick={() => { setSelectedTruck(truck); setTruckSearch(''); }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <span className="font-medium">{truck.unitNumber}</span>
                              <span className="text-gray-500 ml-2">- {truck.truckType}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500">No trucks found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Notes */}
        {selectedLoadsheets.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block font-medium text-gray-900 mb-2">Notes (Optional)</label>
            <textarea
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              placeholder="Any notes for this trip..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>
        )}

        {/* Submit button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
          <button
            type="submit"
            disabled={isLoading || selectedLoadsheets.length === 0 || (!isOwnerOperator && !selectedTruck)}
            className="w-full py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <span className="animate-pulse">Dispatching...</span>
            ) : (
              <>
                <Truck className="w-5 h-5 mr-2" />
                Dispatch Trip
              </>
            )}
          </button>
        </div>
      </form>
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
            value={arrivalNotes}
            onChange={(e) => setArrivalNotes(e.target.value)}
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
      {step === 'dispatch' && driver && renderDispatchForm()}
      {step === 'arrive' && selectedTrip && renderArrivalForm()}
    </>
  );
};

export default DriverSelfService;
