import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { linehaulTripService, EtaResult, VehicleLocationResult } from '../../services/linehaulTripService';
import { loadsheetService } from '../../services/loadsheetService';
import { locationService } from '../../services/locationService';
import { LinehaulTrip, Loadsheet, TripStatus, Location } from '../../types';
import { TripStatusBadge } from './TripStatusBadge';
import { ManifestDetailsModal } from './ManifestDetailsModal';
import { EditTripModal } from './EditTripModal';
import { DateRangePicker } from '../common/DateRangePicker';
import {
  Truck,
  User,
  ArrowRight,
  FileText,
  RefreshCw,
  Search,
  MapPin,
  LogIn,
  Package,
  Scale,
  Clock,
  Navigation,
  X,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface InboundTripRow {
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
  eta?: EtaResult;
}

export const InboundTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [locationFilter, setLocationFilter] = useState<number | ''>('');
  const [tripEtas, setTripEtas] = useState<Record<number, EtaResult>>({});

  // Manifest details modal state
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [selectedManifestLoadsheets, setSelectedManifestLoadsheets] = useState<Loadsheet[]>([]);
  const [selectedManifestTripNumber, setSelectedManifestTripNumber] = useState<string>('');
  const [selectedManifestTripId, setSelectedManifestTripId] = useState<number | undefined>(undefined);

  // Edit trip modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTripId, setEditTripId] = useState<number | null>(null);

  // Vehicle location modal state
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{ id: string; unitNumber: string } | null>(null);
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocationResult | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch locations for filter dropdown
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Fetch inbound trips (in transit, arrived, or unloading)
  const { data: tripsData, isLoading, error, refetch } = useQuery({
    queryKey: ['inbound-trips', startDate, endDate, locationFilter],
    queryFn: async () => {
      console.log('Fetching inbound trips with statuses: IN_TRANSIT, ARRIVED, UNLOADING');
      const result = await linehaulTripService.getTrips({
        statuses: ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING'] as TripStatus[],
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        destinationTerminalId: locationFilter || undefined,
        limit: 100
      });
      console.log('Inbound trips result:', result);
      return result;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Log any errors
  if (error) {
    console.error('Error fetching inbound trips:', error);
  }

  // Fetch all dispatched loadsheets to match with trips
  const { data: loadsheetsData } = useQuery({
    queryKey: ['all-loadsheets-inbound'],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({ status: 'DISPATCHED', limit: 100 });
      return response.loadsheets;
    }
  });

  const trips = tripsData?.trips || [];
  const loadsheets = loadsheetsData || [];

  // Fetch ETAs for all trips
  useEffect(() => {
    const fetchEtas = async () => {
      if (trips.length === 0) return;

      try {
        const tripIds = trips.map(t => t.id);
        const response = await linehaulTripService.getTripEtaBatch(tripIds);
        setTripEtas(response.etas);
      } catch (error) {
        console.error('Error fetching ETAs:', error);
      }
    };

    fetchEtas();
  }, [trips]);

  // Build inbound trip rows with their loadsheets and ETAs
  const inboundRows: InboundTripRow[] = trips.map(trip => {
    // Find loadsheets associated with this trip
    const tripLoadsheets = loadsheets.filter(ls => ls.linehaulTripId === trip.id);
    const eta = tripEtas[trip.id];
    return { trip, loadsheets: tripLoadsheets, eta };
  });

  // Filter by search term
  const filteredRows = inboundRows.filter(row => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();

    // Search by trip number
    if (row.trip.tripNumber?.toLowerCase().includes(search)) return true;

    // Search by driver name
    if (row.trip.driver?.name?.toLowerCase().includes(search)) return true;

    // Search by manifest number
    if (row.loadsheets.some(ls => ls.manifestNumber?.toLowerCase().includes(search))) return true;

    // Search by truck unit number
    if (row.trip.truck?.unitNumber?.toLowerCase().includes(search)) return true;

    return false;
  });

  // Format loadsheets/manifests for display in a single line
  const formatManifests = (loadsheets: Loadsheet[]): string => {
    if (loadsheets.length === 0) return '-';
    return loadsheets.map(ls => ls.manifestNumber).join(', ');
  };

  // Get linehaul info from loadsheets
  const getLinehaulInfo = (loadsheets: Loadsheet[]): { origin: string; destination: string; linehaulName: string } => {
    if (loadsheets.length === 0) {
      return { origin: '-', destination: '-', linehaulName: '-' };
    }

    const firstLoadsheet = loadsheets[0];
    const linehaulName = firstLoadsheet.linehaulName || '-';

    // Try to parse origin-destination from linehaulName (e.g., "ATL-MEM")
    const parts = linehaulName.split('-');
    if (parts.length >= 2) {
      return {
        origin: parts[0],
        destination: parts[parts.length - 1].replace(/\d+$/, ''), // Remove trailing numbers
        linehaulName
      };
    }

    // If no dash, use originTerminalCode and destinationTerminalCode from loadsheet
    const origin = firstLoadsheet.originTerminalCode || '-';
    const destination = firstLoadsheet.destinationTerminalCode || '-';

    return { origin, destination, linehaulName };
  };

  // Calculate total pieces from loadsheets or trip shipments
  const getTotalPieces = (row: InboundTripRow): number | null => {
    // First try loadsheets - these have pieces stored directly
    if (row.loadsheets && row.loadsheets.length > 0) {
      const loadsheetPieces = row.loadsheets.reduce((sum, ls) => sum + (ls.pieces || 0), 0);
      if (loadsheetPieces > 0) return loadsheetPieces;
    }
    // Fall back to trip shipments
    if (row.trip.shipments && row.trip.shipments.length > 0) {
      return row.trip.shipments.reduce((sum, s) => sum + (s.pieces || 0), 0);
    }
    return null;
  };

  // Calculate total weight from loadsheets or trip shipments
  const getTotalWeight = (row: InboundTripRow): number | null => {
    // First try loadsheets - these have weight stored directly
    if (row.loadsheets && row.loadsheets.length > 0) {
      const loadsheetWeight = row.loadsheets.reduce((sum, ls) => sum + (ls.weight || 0), 0);
      if (loadsheetWeight > 0) return loadsheetWeight;
    }
    // Fall back to trip shipments
    if (row.trip.shipments && row.trip.shipments.length > 0) {
      return row.trip.shipments.reduce((sum, s) => sum + (s.weight || 0), 0);
    }
    return null;
  };

  // Format time for display (strip seconds if present)
  const formatTimeForDisplay = (timeStr: string | null): string | null => {
    if (!timeStr) return null;
    // Remove seconds if present (10:00:00 -> 10:00)
    const match = timeStr.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
    return match ? match[1] : timeStr;
  };

  // Get scheduled arrival time from loadsheet, trip, or linehaul profile
  const getSchedArrival = (row: InboundTripRow): { date: string | null; time: string | null } => {
    // First check loadsheets for target arrival time
    if (row.loadsheets.length > 0) {
      const firstLoadsheet = row.loadsheets[0];
      if (firstLoadsheet.targetArrivalTime) {
        // Get date from scheduled arrival or dispatch date
        const dateStr = row.trip.plannedArrival
          ? format(new Date(row.trip.plannedArrival), 'MM/dd')
          : row.trip.dispatchDate
            ? format(new Date(row.trip.dispatchDate), 'MM/dd')
            : null;
        return {
          date: dateStr,
          time: formatTimeForDisplay(firstLoadsheet.targetArrivalTime)
        };
      }
    }
    // Fall back to trip's planned arrival
    if (row.trip.plannedArrival) {
      try {
        const plannedDate = typeof row.trip.plannedArrival === 'string'
          ? parseISO(row.trip.plannedArrival)
          : new Date(row.trip.plannedArrival);
        return {
          date: format(plannedDate, 'MM/dd'),
          time: format(plannedDate, 'HH:mm')
        };
      } catch {
        // Continue to next fallback
      }
    }
    // Fall back to linehaul profile's standard arrival time
    if (row.trip.linehaulProfile?.standardArrivalTime) {
      const dateStr = row.trip.dispatchDate
        ? format(new Date(row.trip.dispatchDate), 'MM/dd')
        : format(new Date(), 'MM/dd');
      return {
        date: dateStr,
        time: formatTimeForDisplay(row.trip.linehaulProfile.standardArrivalTime)
      };
    }
    return { date: null, time: null };
  };

  // Get dispatched time
  const getDispatchedTime = (row: InboundTripRow): { date: string | null; time: string | null } => {
    if (row.trip.actualDeparture) {
      try {
        const actualDate = typeof row.trip.actualDeparture === 'string'
          ? parseISO(row.trip.actualDeparture)
          : new Date(row.trip.actualDeparture);
        return {
          date: format(actualDate, 'MM/dd'),
          time: format(actualDate, 'HH:mm')
        };
      } catch {
        return { date: null, time: null };
      }
    }
    return { date: null, time: null };
  };

  // Format ETA for display
  const formatEta = (row: InboundTripRow): { date: string | null; time: string | null; source: string } => {
    const eta = row.eta;

    if (!eta || !eta.estimatedArrival) {
      return { date: null, time: null, source: 'NONE' };
    }

    try {
      const etaDate = typeof eta.estimatedArrival === 'string'
        ? parseISO(eta.estimatedArrival)
        : new Date(eta.estimatedArrival);
      return {
        date: format(etaDate, 'MM/dd'),
        time: format(etaDate, 'HH:mm'),
        source: eta.source
      };
    } catch {
      return { date: null, time: null, source: 'NONE' };
    }
  };

  // Check if trip is OWNOP (no truck assigned)
  const isOwnop = (row: InboundTripRow): boolean => {
    return !row.trip.truckId && !row.trip.truck;
  };

  // Open manifest details modal
  const handleManifestClick = (loadsheets: Loadsheet[], tripNumber: string, tripId: number) => {
    setSelectedManifestLoadsheets(loadsheets);
    setSelectedManifestTripNumber(tripNumber);
    setSelectedManifestTripId(tripId);
    setManifestModalOpen(true);
  };

  // Open edit trip modal
  const handleTripNumberClick = (tripId: number) => {
    setEditTripId(tripId);
    setEditModalOpen(true);
  };

  // Handle edit modal save
  const handleEditModalSaved = async () => {
    // Refetch trips to reflect changes on both tabs
    await queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
    await queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
    await refetch();
  };

  // Handle power unit click to fetch GPS location
  const handlePowerUnitClick = async (vehicleId: string, unitNumber: string) => {
    setSelectedVehicle({ id: vehicleId, unitNumber });
    setLocationModalOpen(true);
    setLocationLoading(true);
    setLocationError(null);
    setVehicleLocation(null);

    try {
      const result = await linehaulTripService.getVehicleLocation(vehicleId);
      setVehicleLocation(result);
      if (result.error) {
        setLocationError(result.error);
      }
    } catch (error) {
      console.error('Error fetching vehicle location:', error);
      setLocationError('Failed to fetch vehicle location');
    } finally {
      setLocationLoading(false);
    }
  };

  // Close location modal
  const handleCloseLocationModal = () => {
    setLocationModalOpen(false);
    setSelectedVehicle(null);
    setVehicleLocation(null);
    setLocationError(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search trips, manifests..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Date Range Filter */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => {
                setStartDate('');
                setEndDate('');
              }}
            />

            {/* Location Filter (Destination Terminal) */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value ? parseInt(e.target.value) : '')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">All Destinations</option>
                {locations.map((location: Location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name || location.city}
                  </option>
                ))}
              </select>
              {locationFilter && (
                <button
                  onClick={() => setLocationFilter('')}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Clear destination filter"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Inbound Trips Grid */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <LogIn className="w-5 h-5 text-blue-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Inbound Trips</h3>
            <span className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
              {filteredRows.length} en route
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {startDate && endDate ? (
              startDate === endDate
                ? `Trips arriving on ${format(new Date(startDate), 'MMMM d, yyyy')}`
                : `Trips arriving from ${format(new Date(startDate), 'MMM d, yyyy')} to ${format(new Date(endDate), 'MMM d, yyyy')}`
            ) : startDate ? (
              `Trips arriving from ${format(new Date(startDate), 'MMMM d, yyyy')}`
            ) : endDate ? (
              `Trips arriving until ${format(new Date(endDate), 'MMMM d, yyyy')}`
            ) : (
              'All inbound trips'
            )}
            {locationFilter && locations.find((l: Location) => l.id === locationFilter) && (
              ` to ${locations.find((l: Location) => l.id === locationFilter)?.code}`
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading inbound trips...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No inbound trips found{searchTerm ? ' matching your search' : ' for this date'}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trip #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Power Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trailer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Manifests
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Linehaul
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center justify-end">
                      <Package className="h-3 w-3 mr-1" />
                      Pieces
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center justify-end">
                      <Scale className="h-3 w-3 mr-1" />
                      Weight
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sched Arrival
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      ETA
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRows.map((row) => {
                  const linehaulInfo = getLinehaulInfo(row.loadsheets);
                  const totalPieces = getTotalPieces(row);
                  const totalWeight = getTotalWeight(row);
                  const schedArrival = getSchedArrival(row);
                  const eta = formatEta(row);
                  const ownop = isOwnop(row);

                  return (
                    <tr key={row.trip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleTripNumberClick(row.trip.id)}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                        >
                          {row.trip.tripNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-900 dark:text-gray-100">
                            {row.trip.driver?.name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <Truck className="h-4 w-4 text-gray-400 mr-2" />
                          {row.trip.truck ? (
                            <button
                              onClick={() => handlePowerUnitClick(String(row.trip.truck!.id), row.trip.truck!.unitNumber)}
                              className="flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                              title="View GPS location"
                            >
                              {row.trip.truck.unitNumber}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </button>
                          ) : (
                            <span className="text-gray-900 dark:text-gray-100">
                              OWNOP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-900 dark:text-gray-100">
                          {row.trip.trailer?.unitNumber ||
                           (row.loadsheets.length > 0 ? row.loadsheets[0].trailerNumber : null) ||
                           '-'}
                          {(row.trip.trailer2?.unitNumber ||
                            (row.loadsheets.length > 1 ? row.loadsheets[1].trailerNumber : null)) &&
                            ` / ${row.trip.trailer2?.unitNumber || row.loadsheets[1]?.trailerNumber}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.loadsheets.length > 0 ? (
                          <button
                            onClick={() => handleManifestClick(row.loadsheets, row.trip.tripNumber, row.trip.id)}
                            className="flex items-center group"
                          >
                            <FileText className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 group-hover:text-indigo-500" />
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                              {formatManifests(row.loadsheets)}
                            </span>
                            {row.loadsheets.length > 1 && (
                              <span className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs">
                                {row.loadsheets.length}
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            <span className="text-gray-500 dark:text-gray-400">-</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          {linehaulInfo.origin !== '-' && linehaulInfo.destination !== '-' ? (
                            <>
                              <span className="font-medium">{linehaulInfo.origin}</span>
                              <ArrowRight className="h-3 w-3 mx-2" />
                              <span className="font-medium">{linehaulInfo.destination}</span>
                            </>
                          ) : (
                            <span className="font-medium">{linehaulInfo.linehaulName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                        {totalPieces !== null ? totalPieces.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                        {totalWeight !== null ? `${totalWeight.toLocaleString()} lbs` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {schedArrival.date && schedArrival.time ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{schedArrival.date}</span>
                            <span>{schedArrival.time}</span>
                          </div>
                        ) : schedArrival.time ? (
                          schedArrival.time
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {eta.time ? (
                          <div className="flex items-center">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">{eta.date}</span>
                              <span className="text-gray-900 dark:text-gray-100 font-medium">
                                {eta.time}
                              </span>
                            </div>
                            {eta.source === 'GPS' && (
                              <span className="ml-2 inline-flex items-center" title="GPS-based ETA">
                                <Navigation className="h-3 w-3 text-green-500" />
                              </span>
                            )}
                            {eta.source === 'PROFILE' && ownop && (
                              <span className="ml-2 text-xs text-gray-400" title="Profile-based ETA (OWNOP)">
                                (Est)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TripStatusBadge status={row.trip.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manifest Details Modal */}
      <ManifestDetailsModal
        isOpen={manifestModalOpen}
        onClose={() => {
          setManifestModalOpen(false);
          setSelectedManifestLoadsheets([]);
          setSelectedManifestTripNumber('');
          setSelectedManifestTripId(undefined);
        }}
        loadsheets={selectedManifestLoadsheets}
        tripId={selectedManifestTripId}
        tripNumber={selectedManifestTripNumber}
      />

      {/* Edit Trip Modal */}
      {editTripId && (
        <EditTripModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditTripId(null);
          }}
          tripId={editTripId}
          onSaved={handleEditModalSaved}
          mode="inbound"
        />
      )}

      {/* Vehicle Location Modal */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
              onClick={handleCloseLocationModal}
            />

            {/* Modal */}
            <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  <Navigation className="h-5 w-5 mr-2 text-green-500" />
                  Vehicle Location
                </h3>
                <button
                  onClick={handleCloseLocationModal}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {selectedVehicle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Power Unit: <span className="font-medium text-gray-900 dark:text-gray-100">{selectedVehicle.unitNumber}</span>
                </p>
              )}

              {locationLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Fetching GPS location...</span>
                </div>
              ) : locationError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                  <p className="text-red-700 dark:text-red-400">{locationError}</p>
                </div>
              ) : vehicleLocation?.location ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {vehicleLocation.location.address || 'Address not available'}
                        </p>
                        {(vehicleLocation.location.city || vehicleLocation.location.state) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {[vehicleLocation.location.city, vehicleLocation.location.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Coordinates</p>
                        <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                          {vehicleLocation.location.latitude.toFixed(6)}, {vehicleLocation.location.longitude.toFixed(6)}
                        </p>
                      </div>
                      {vehicleLocation.location.speed !== undefined && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Speed</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {vehicleLocation.location.speed} mph
                          </p>
                        </div>
                      )}
                    </div>

                    {vehicleLocation.location.heading !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Heading</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {vehicleLocation.location.heading}°
                        </p>
                      </div>
                    )}

                    {vehicleLocation.location.timestamp && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Last Updated</p>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {format(new Date(vehicleLocation.location.timestamp), 'MMM d, yyyy h:mm:ss a')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Google Maps link */}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${vehicleLocation.location.latitude},${vehicleLocation.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Google Maps
                  </a>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 text-center">
                  <p className="text-gray-600 dark:text-gray-400">No location data available</p>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleCloseLocationModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
