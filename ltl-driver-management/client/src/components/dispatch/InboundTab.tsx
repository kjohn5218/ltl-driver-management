import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { linehaulTripService, EtaResult, VehicleLocationResult } from '../../services/linehaulTripService';
import { locationService } from '../../services/locationService';
import { LinehaulTrip, Loadsheet, TripStatus } from '../../types';
import { TripStatusBadge } from './TripStatusBadge';
import { ManifestDetailsModal } from './ManifestDetailsModal';
import { EditTripModal } from './EditTripModal';
import { ArrivalDetailsModal } from './ArrivalDetailsModal';
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
  Loader2,
  CheckCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'tripNumber' | 'driver' | 'powerUnit' | 'trailer' | 'manifests' | 'linehaul' | 'leg' | 'location' | 'pieces' | 'weight' | 'schedArrival' | 'eta' | 'actualArrival' | 'status';

interface SortConfig {
  column: SortColumn | null;
  direction: SortDirection;
}

// Sortable header component
const SortableHeader: React.FC<{
  column: SortColumn;
  label: string;
  sortConfig: SortConfig;
  onSort: (column: SortColumn) => void;
  className?: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
}> = ({ column, label, sortConfig, onSort, className = '', icon, align = 'left' }) => {
  const isActive = sortConfig.column === column;
  const direction = isActive ? sortConfig.direction : null;

  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      onClick={() => onSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {icon}
        <span>{label}</span>
        <span className="ml-1 flex flex-col">
          <ChevronUp className={`h-3 w-3 -mb-1 ${isActive && direction === 'asc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600'}`} />
          <ChevronDown className={`h-3 w-3 ${isActive && direction === 'desc' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </span>
      </div>
    </th>
  );
};

interface InboundTripRow {
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
  eta?: EtaResult;
}

interface InboundTabProps {
  selectedLocations?: number[];
}

export const InboundTab: React.FC<InboundTabProps> = ({ selectedLocations = [] }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [tripEtas, setTripEtas] = useState<Record<number, EtaResult>>({});
  const [showUnarrivedOnly, setShowUnarrivedOnly] = useState(false);

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

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

  // Arrival modal state
  const [arrivalModalOpen, setArrivalModalOpen] = useState(false);
  const [arrivalTrip, setArrivalTrip] = useState<LinehaulTrip | null>(null);

  // Fetch locations for displaying selected filter names
  const { data: locationsData } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  const locations = locationsData || [];

  // Fetch inbound trips (in transit, arrived, or unloading)
  const { data: tripsData, isLoading, error, refetch } = useQuery({
    queryKey: ['inbound-trips', startDate, endDate],
    queryFn: async () => {
      console.log('Fetching inbound trips with statuses: IN_TRANSIT, ARRIVED, UNLOADING');
      const result = await linehaulTripService.getTrips({
        statuses: ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED', 'UNLOADING'] as TripStatus[],
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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

  const trips = tripsData?.trips || [];

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
  // Loadsheets come directly from the trip include, no separate query needed
  const inboundRows: InboundTripRow[] = trips.map(trip => {
    // Use loadsheets from the trip (already included in the query)
    const tripLoadsheets = (trip.loadsheets || []) as Loadsheet[];
    const eta = tripEtas[trip.id];
    return { trip, loadsheets: tripLoadsheets, eta };
  });

  // Filter by destination, search term, and unarrived status
  const filteredRows = useMemo(() => {
    return inboundRows.filter(row => {
      // Apply unarrived filter first
      if (showUnarrivedOnly) {
        const unarrivedStatuses = ['DISPATCHED', 'IN_TRANSIT'];
        if (!unarrivedStatuses.includes(row.trip.status)) return false;
      }

      // Apply location filter (matches destination for inbound)
      // For inbound trips, the destination is where the trip is going TO (or arrived at)
      if (selectedLocations.length > 0) {
        // First check for trip's destinationTerminalCode override (alternate destination)
        const tripDestOverrideCode = (row.trip as any).destinationTerminalCode;
        const tripDestOverrideId = tripDestOverrideCode
          ? locations.find(l => l.code?.toUpperCase() === tripDestOverrideCode.toUpperCase())?.id
          : undefined;

        // If trip has a destination override, use that; otherwise use profile destination
        let matchesDestination = false;

        if (tripDestOverrideId) {
          // Trip has an alternate destination - use that for filtering
          matchesDestination = selectedLocations.includes(tripDestOverrideId);
        } else {
          // Use the trip profile's destination - this is the authoritative source
          const tripDestinationId = row.trip.linehaulProfile?.destinationTerminalId ||
            (row.trip.linehaulProfile as any)?.destinationTerminal?.id;

          // Also check destination terminal code from profile and map to ID
          const profileDestCode = (row.trip.linehaulProfile as any)?.destinationTerminal?.code;
          const profileDestId = profileDestCode
            ? locations.find(l => l.code?.toUpperCase() === profileDestCode.toUpperCase())?.id
            : undefined;

          // Match only if the trip's actual destination matches selected locations
          // Don't use loadsheet destination or parsed linehaulName - those may represent
          // the next leg or final destination of a multi-leg route, not this trip's destination
          matchesDestination =
            (tripDestinationId && selectedLocations.includes(tripDestinationId)) ||
            (profileDestId && selectedLocations.includes(profileDestId));
        }

        if (!matchesDestination) return false;
      }

      // Then apply search filter
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
  }, [inboundRows, selectedLocations, searchTerm, showUnarrivedOnly, locations]);

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    setSortConfig(current => {
      if (current.column === column) {
        // Cycle: asc -> desc -> null
        if (current.direction === 'asc') return { column, direction: 'desc' };
        if (current.direction === 'desc') return { column: null, direction: null };
      }
      return { column, direction: 'asc' };
    });
  };

  // Parse time string (HH:mm, HH:mm:ss, or HH:MM:SS) to minutes since midnight for comparison
  const parseTimeToMinutes = (timeStr: string): number | null => {
    if (!timeStr) return null;

    // Handle HH:mm or HH:mm:ss format (with or without seconds)
    const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      return hours * 60 + minutes;
    }
    return null;
  };

  // Format loadsheets/manifests for display in a single line
  const formatManifests = (loadsheets: Loadsheet[]): string => {
    if (loadsheets.length === 0) return '-';
    return loadsheets.map(ls => ls.manifestNumber).join(', ');
  };

  // Parse leg (origin-destination) from linehaulName
  // Examples: "DENWAMSLC1" → "DEN-WAM", "ATL-MEM" → "ATL-MEM", "ABQELP2" → "ABQ-ELP"
  const parseLeg = (linehaulName: string | null | undefined): { origin: string; destination: string; leg: string } => {
    if (!linehaulName || linehaulName === '-') {
      return { origin: '-', destination: '-', leg: '-' };
    }

    // If already dash-separated (e.g., "ATL-MEM" or "ATL-MEM2")
    if (linehaulName.includes('-')) {
      const parts = linehaulName.split('-');
      const origin = parts[0];
      const destination = parts[parts.length - 1].replace(/\d+$/, ''); // Remove trailing numbers
      return { origin, destination, leg: `${origin}-${destination}` };
    }

    // Concatenated format (e.g., "DENWAMSLC1" or "ABQELP2")
    // Terminal codes are typically 3 letters, extract first two codes
    const cleanName = linehaulName.replace(/\d+$/, ''); // Remove trailing numbers

    if (cleanName.length >= 6) {
      // At least 2 terminal codes (6 chars)
      const origin = cleanName.substring(0, 3);
      const destination = cleanName.substring(3, 6);
      return { origin, destination, leg: `${origin}-${destination}` };
    } else if (cleanName.length >= 3) {
      // Single terminal code
      return { origin: cleanName.substring(0, 3), destination: '-', leg: cleanName.substring(0, 3) };
    }

    return { origin: '-', destination: '-', leg: linehaulName };
  };

  // Get linehaul info from trip or loadsheets
  const getLinehaulInfo = (row: InboundTripRow): { origin: string; destination: string; linehaulName: string; leg: string; isAlternate?: boolean } => {
    // First try trip-level linehaulName (from API transformation)
    const linehaulName = row.trip.linehaulName || row.loadsheets?.[0]?.linehaulName || '-';
    const parsed = parseLeg(linehaulName);

    // Get the trip's ORIGINAL origin from the profile (not the loadsheet which gets updated on arrival)
    const tripProfileOrigin = row.trip.linehaulProfile?.originTerminal?.code;

    // Check for trip's destinationTerminalCode override (alternate destination)
    const tripDestOverride = (row.trip as any).destinationTerminalCode;
    if (tripDestOverride) {
      // Use profile origin first, then fall back to parsed origin
      const origin = tripProfileOrigin || parsed.origin;
      return {
        origin,
        destination: tripDestOverride,
        linehaulName,
        leg: `${origin}-${tripDestOverride}`,
        isAlternate: true
      };
    }

    // For normal trips, use profile origin and destination
    if (tripProfileOrigin) {
      const profileDest = row.trip.linehaulProfile?.destinationTerminal?.code;
      if (profileDest) {
        return {
          origin: tripProfileOrigin,
          destination: profileDest,
          linehaulName,
          leg: `${tripProfileOrigin}-${profileDest}`
        };
      }
    }

    // If parsing didn't get destination, try loadsheet's destinationTerminalCode
    if (parsed.destination === '-' && row.loadsheets && row.loadsheets.length > 0) {
      const firstLoadsheet = row.loadsheets[0];
      if (firstLoadsheet.destinationTerminalCode) {
        const origin = tripProfileOrigin || firstLoadsheet.originTerminalCode || parsed.origin;
        const destination = firstLoadsheet.destinationTerminalCode;
        return {
          origin,
          destination,
          linehaulName,
          leg: `${origin}-${destination}`
        };
      }
    }

    return { ...parsed, linehaulName };
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

  // Get actual arrival time (for ARRIVED trips)
  const getActualArrival = (row: InboundTripRow): { date: string | null; time: string | null } => {
    if (row.trip.actualArrival) {
      try {
        const arrivalDate = typeof row.trip.actualArrival === 'string'
          ? parseISO(row.trip.actualArrival)
          : new Date(row.trip.actualArrival);
        return {
          date: format(arrivalDate, 'MM/dd'),
          time: format(arrivalDate, 'HH:mm')
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

  // Sort filtered rows
  const sortedRows = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.column) {
        case 'tripNumber':
          return direction * (a.trip.tripNumber || '').localeCompare(b.trip.tripNumber || '');

        case 'driver':
          return direction * (a.trip.driver?.name || '').localeCompare(b.trip.driver?.name || '');

        case 'powerUnit':
          const aUnit = a.trip.truck?.unitNumber || 'OWNOP';
          const bUnit = b.trip.truck?.unitNumber || 'OWNOP';
          return direction * aUnit.localeCompare(bUnit);

        case 'trailer':
          const aTrailer = a.trip.trailer?.unitNumber || a.loadsheets[0]?.trailerNumber || '';
          const bTrailer = b.trip.trailer?.unitNumber || b.loadsheets[0]?.trailerNumber || '';
          return direction * aTrailer.localeCompare(bTrailer);

        case 'manifests':
          const aManifest = a.loadsheets[0]?.manifestNumber || '';
          const bManifest = b.loadsheets[0]?.manifestNumber || '';
          return direction * aManifest.localeCompare(bManifest);

        case 'linehaul':
          const aLinehaul = getLinehaulInfo(a).linehaulName;
          const bLinehaul = getLinehaulInfo(b).linehaulName;
          return direction * aLinehaul.localeCompare(bLinehaul);

        case 'leg':
          const aLeg = getLinehaulInfo(a).leg;
          const bLeg = getLinehaulInfo(b).leg;
          return direction * aLeg.localeCompare(bLeg);

        case 'location':
          const aLocation = getLinehaulInfo(a).destination;
          const bLocation = getLinehaulInfo(b).destination;
          return direction * aLocation.localeCompare(bLocation);

        case 'pieces':
          const aPieces = getTotalPieces(a) || 0;
          const bPieces = getTotalPieces(b) || 0;
          return direction * (aPieces - bPieces);

        case 'weight':
          const aWeight = getTotalWeight(a) || 0;
          const bWeight = getTotalWeight(b) || 0;
          return direction * (aWeight - bWeight);

        case 'schedArrival':
          const aSchedArrival = getSchedArrival(a);
          const bSchedArrival = getSchedArrival(b);
          const aSchedMinutes = parseTimeToMinutes(aSchedArrival.time || '') || 0;
          const bSchedMinutes = parseTimeToMinutes(bSchedArrival.time || '') || 0;
          return direction * (aSchedMinutes - bSchedMinutes);

        case 'eta':
          const aEta = formatEta(a);
          const bEta = formatEta(b);
          const aEtaMinutes = parseTimeToMinutes(aEta.time || '') || 0;
          const bEtaMinutes = parseTimeToMinutes(bEta.time || '') || 0;
          return direction * (aEtaMinutes - bEtaMinutes);

        case 'actualArrival':
          const aActualArrival = getActualArrival(a);
          const bActualArrival = getActualArrival(b);
          const aActualMinutes = parseTimeToMinutes(aActualArrival.time || '') || 0;
          const bActualMinutes = parseTimeToMinutes(bActualArrival.time || '') || 0;
          return direction * (aActualMinutes - bActualMinutes);

        case 'status':
          return direction * (a.trip.status || '').localeCompare(b.trip.status || '');

        default:
          return 0;
      }
    });
  }, [filteredRows, sortConfig]);

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

  // Handle arrive trip button click
  const handleArriveClick = (trip: LinehaulTrip) => {
    setArrivalTrip(trip);
    setArrivalModalOpen(true);
  };

  // Handle arrival modal success
  const handleArrivalSuccess = async () => {
    setArrivalModalOpen(false);
    setArrivalTrip(null);
    await queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
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

            {/* Unarrived Only Filter */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showUnarrivedOnly}
                onChange={(e) => setShowUnarrivedOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <Clock className="h-4 w-4 text-blue-500" />
                Unarrived Only
              </span>
            </label>
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
            {selectedLocations.length > 0 && (
              ` to ${selectedLocations.map(id => locations.find(l => l.id === id)?.code).filter(Boolean).join(', ')}`
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
                  <SortableHeader column="tripNumber" label="Trip #" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="driver" label="Driver" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="powerUnit" label="Power Unit" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="trailer" label="Trailer" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="manifests" label="Manifests" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="linehaul" label="Linehaul" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="leg" label="Leg" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="location" label="Location" sortConfig={sortConfig} onSort={handleSort} icon={<MapPin className="h-3 w-3" />} />
                  <SortableHeader column="pieces" label="Pieces" sortConfig={sortConfig} onSort={handleSort} align="right" icon={<Package className="h-3 w-3" />} />
                  <SortableHeader column="weight" label="Weight" sortConfig={sortConfig} onSort={handleSort} align="right" icon={<Scale className="h-3 w-3" />} />
                  <SortableHeader column="schedArrival" label="Sched Arrival" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="eta" label="ETA" sortConfig={sortConfig} onSort={handleSort} icon={<Clock className="h-3 w-3" />} />
                  <SortableHeader column="actualArrival" label="Arrived" sortConfig={sortConfig} onSort={handleSort} icon={<CheckCircle className="h-3 w-3" />} />
                  <SortableHeader column="status" label="Status" sortConfig={sortConfig} onSort={handleSort} />
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRows.map((row) => {
                  const linehaulInfo = getLinehaulInfo(row);
                  const totalPieces = getTotalPieces(row);
                  const totalWeight = getTotalWeight(row);
                  const schedArrival = getSchedArrival(row);
                  const eta = formatEta(row);
                  const actualArrival = getActualArrival(row);
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
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {linehaulInfo.linehaulName}
                        </span>
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
                            <span className="font-medium">{linehaulInfo.leg}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                          <span className="text-gray-900 dark:text-gray-100">{linehaulInfo.destination}</span>
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
                        {(row.trip.status === 'ARRIVED' || row.trip.status === 'UNLOADING') && actualArrival.time ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{actualArrival.date}</span>
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {actualArrival.time}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <TripStatusBadge status={row.trip.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {(row.trip.status === 'IN_TRANSIT' || row.trip.status === 'DISPATCHED') && (
                          <button
                            onClick={() => handleArriveClick(row.trip)}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                            title="Arrive trip"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Arrive
                          </button>
                        )}
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

      {/* Arrival Details Modal */}
      {arrivalTrip && (
        <ArrivalDetailsModal
          isOpen={arrivalModalOpen}
          onClose={() => {
            setArrivalModalOpen(false);
            setArrivalTrip(null);
          }}
          trip={arrivalTrip}
          onSuccess={handleArrivalSuccess}
        />
      )}
    </div>
  );
};
