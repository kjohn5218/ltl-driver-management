import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { linehaulTripService } from '../../services/linehaulTripService';
import { loadsheetService } from '../../services/loadsheetService';
import { lateDepartureReasonService } from '../../services/lateDepartureReasonService';
import { locationService } from '../../services/locationService';
import { LinehaulTrip, Loadsheet, TripStatus } from '../../types';
import { TripStatusBadge } from './TripStatusBadge';
import { LateReasonModal } from './LateReasonModal';
import { LateReasonViewModal } from './LateReasonViewModal';
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
  AlertTriangle,
  Package,
  Scale,
  CheckCircle2,
  Percent,
  TrendingUp,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'tripNumber' | 'driver' | 'powerUnit' | 'trailer' | 'manifests' | 'linehaul' | 'leg' | 'location' | 'pieces' | 'weight' | 'lf' | 'schedDepart' | 'dispatched' | 'status';

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
import { format, parseISO, addDays } from 'date-fns';

interface OutboundTripRow {
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
}

interface OutboundTabProps {
  selectedLocations?: number[];
}

export const OutboundTab: React.FC<OutboundTabProps> = ({ selectedLocations = [] }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);
  const [showLateOnly, setShowLateOnly] = useState(false);
  const [showHeadhaulOnly, setShowHeadhaulOnly] = useState(false);

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

  // Late reason modal state
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [selectedLateTrip, setSelectedLateTrip] = useState<OutboundTripRow | null>(null);

  // Late reason view modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewTripId, setViewTripId] = useState<number | null>(null);
  const [viewTripNumber, setViewTripNumber] = useState<string>('');

  // Manifest details modal state
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [selectedManifestLoadsheets, setSelectedManifestLoadsheets] = useState<Loadsheet[]>([]);
  const [selectedManifestTripNumber, setSelectedManifestTripNumber] = useState<string>('');
  const [selectedManifestTripId, setSelectedManifestTripId] = useState<number | undefined>(undefined);

  // Edit trip modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTripId, setEditTripId] = useState<number | null>(null);

  // Fetch locations for displaying selected filter names
  const { data: locationsData } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  const locations = locationsData || [];

  // Fetch dispatched, in-transit, and arrived trips (trips that departed in date range)
  // Arrived trips stay on outbound tab for information and late dispositioning purposes
  const { data: tripsData, isLoading, refetch: refetchTrips } = useQuery({
    queryKey: ['outbound-trips', startDate, endDate],
    queryFn: () => linehaulTripService.getTrips({
      statuses: ['DISPATCHED', 'IN_TRANSIT', 'ARRIVED'] as TripStatus[],
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: 500
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0 // Always fetch fresh data
  });

  // Fetch loadsheets (we'll match by linehaulTripId to the trips)
  const { data: loadsheetsData, refetch: refetchLoadsheets } = useQuery({
    queryKey: ['loadsheets-for-outbound', startDate, endDate],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({
        status: 'DISPATCHED',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 500
      });
      return response.loadsheets;
    },
    staleTime: 0
  });

  // Fetch late departure reasons to know which trips have reasons recorded
  // We fetch all reasons without date filter since we just need to match by tripId
  const { data: lateReasonsData, refetch: refetchLateReasons } = useQuery({
    queryKey: ['late-departure-reasons-for-outbound'],
    queryFn: () => lateDepartureReasonService.getLateDepartureReasons({
      limit: 500
    }),
    staleTime: 0 // Always fetch fresh data
  });

  const trips = tripsData?.trips || [];
  const loadsheets = loadsheetsData || [];
  const lateReasons = lateReasonsData?.reasons || [];

  // Create a Set of trip IDs that have late reasons recorded
  const tripIdsWithLateReasons = new Set(lateReasons.map(lr => lr.tripId));

  // Build outbound trip rows with their loadsheets
  const outboundRows: OutboundTripRow[] = trips.map(trip => {
    // Find loadsheets associated with this trip from the separate query
    const tripLoadsheets = loadsheets.filter(ls => ls.linehaulTripId === trip.id);
    // If no loadsheets found from separate query, use embedded loadsheets from trip
    // (these have fewer fields but at least have manifestNumber and linehaulName)
    const effectiveLoadsheets = tripLoadsheets.length > 0
      ? tripLoadsheets
      : (trip.loadsheets as Loadsheet[] || []);
    return { trip, loadsheets: effectiveLoadsheets };
  });

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

  // Format time for display (strip seconds if present)
  const formatTimeForDisplay = (timeStr: string | null): string | null => {
    if (!timeStr) return null;
    // Remove seconds if present (10:00:00 -> 10:00)
    const match = timeStr.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
    return match ? match[1] : timeStr;
  };

  // Get scheduled departure date and time from loadsheet or trip
  const getSchedDepart = (row: OutboundTripRow): { date: string | null; time: string | null } => {
    // First check loadsheets for target dispatch time (stored as "HH:MM" or "HH:MM:SS" string)
    if (row.loadsheets.length > 0) {
      const firstLoadsheet = row.loadsheets[0];
      if (firstLoadsheet.targetDispatchTime) {
        // Get date from loadsheet's scheduledDepartDate or dispatch date
        const dateStr = firstLoadsheet.scheduledDepartDate
          ? format(new Date(firstLoadsheet.scheduledDepartDate), 'MM/dd')
          : row.trip.dispatchDate
            ? format(new Date(row.trip.dispatchDate), 'MM/dd')
            : null;
        return {
          date: dateStr,
          time: formatTimeForDisplay(firstLoadsheet.targetDispatchTime)
        };
      }
    }
    // Fall back to trip's planned departure (stored as ISO datetime)
    if (row.trip.plannedDeparture) {
      try {
        // plannedDeparture is stored as a full datetime, extract date and time portions
        const plannedDate = typeof row.trip.plannedDeparture === 'string'
          ? parseISO(row.trip.plannedDeparture)
          : new Date(row.trip.plannedDeparture);
        return {
          date: format(plannedDate, 'MM/dd'),
          time: format(plannedDate, 'HH:mm')
        };
      } catch {
        return { date: null, time: null };
      }
    }
    return { date: null, time: null };
  };

  // Get dispatch date and time
  const getDispatchTime = (row: OutboundTripRow): { date: string | null; time: string | null } => {
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
    // If no actual departure, use created time as proxy
    try {
      const createdDate = parseISO(row.trip.createdAt);
      return {
        date: format(createdDate, 'MM/dd'),
        time: format(createdDate, 'HH:mm')
      };
    } catch {
      return { date: null, time: null };
    }
  };

  // Check if trip is late (dispatch time > sched depart)
  const isLate = (row: OutboundTripRow): boolean => {
    const schedDepart = getSchedDepart(row);
    const dispatchTime = getDispatchTime(row);

    if (!schedDepart.time || !dispatchTime.time) return false;

    // Parse both times to minutes for comparison
    const schedMinutes = parseTimeToMinutes(schedDepart.time);
    const dispatchMinutes = parseTimeToMinutes(dispatchTime.time);

    if (schedMinutes === null || dispatchMinutes === null) return false;

    // Trip is late if dispatch time is after scheduled departure
    return dispatchMinutes > schedMinutes;
  };

  // Filter by search term, location filter (origin), late filter, and HH filter
  const filteredRows = useMemo(() => {
    return outboundRows.filter(row => {
      // Apply location filter (matches origin for outbound)
      if (selectedLocations.length > 0) {
        // Try multiple sources for origin
        const tripOriginId = row.trip.linehaulProfile?.originTerminalId;

        // Also check loadsheet origin terminal code and map to location ID
        const loadsheetOriginCode = row.loadsheets?.[0]?.originTerminalCode;
        const loadsheetOriginId = loadsheetOriginCode
          ? locations.find(l => l.code === loadsheetOriginCode)?.id
          : undefined;

        // Also try parsing from linehaulName (e.g., "FAR-BIS" -> origin is "FAR")
        const linehaulName = row.trip.linehaulName || row.loadsheets?.[0]?.linehaulName;
        let parsedOriginId: number | undefined;
        if (linehaulName) {
          const parts = linehaulName.includes('-')
            ? linehaulName.split('-')
            : linehaulName.replace(/\d+$/, '').match(/.{1,3}/g);
          if (parts && parts.length >= 1) {
            const originCode = parts[0];
            parsedOriginId = locations.find(l => l.code === originCode)?.id;
          }
        }

        // Match if any origin source matches selected locations
        const matchesOrigin =
          (tripOriginId && selectedLocations.includes(tripOriginId)) ||
          (loadsheetOriginId && selectedLocations.includes(loadsheetOriginId)) ||
          (parsedOriginId && selectedLocations.includes(parsedOriginId));

        if (!matchesOrigin) return false;
      }

      // Apply late filter
      if (showLateOnly && !isLate(row)) return false;

      // Apply headhaul filter
      if (showHeadhaulOnly && !row.trip.linehaulProfile?.headhaul) return false;

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
  }, [outboundRows, selectedLocations, showLateOnly, showHeadhaulOnly, searchTerm, locations]);

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
          const aLocation = getLinehaulInfo(a).origin;
          const bLocation = getLinehaulInfo(b).origin;
          return direction * aLocation.localeCompare(bLocation);

        case 'pieces':
          const aPieces = getTotalPieces(a) || 0;
          const bPieces = getTotalPieces(b) || 0;
          return direction * (aPieces - bPieces);

        case 'weight':
          const aWeight = getTotalWeight(a) || 0;
          const bWeight = getTotalWeight(b) || 0;
          return direction * (aWeight - bWeight);

        case 'lf':
          const aLf = getLoadFactor(a) || 0;
          const bLf = getLoadFactor(b) || 0;
          return direction * (aLf - bLf);

        case 'schedDepart':
          const aSchedMinutes = parseTimeToMinutes(getSchedDepart(a).time || '') || 0;
          const bSchedMinutes = parseTimeToMinutes(getSchedDepart(b).time || '') || 0;
          return direction * (aSchedMinutes - bSchedMinutes);

        case 'dispatched':
          const aDispatchMinutes = parseTimeToMinutes(getDispatchTime(a).time || '') || 0;
          const bDispatchMinutes = parseTimeToMinutes(getDispatchTime(b).time || '') || 0;
          return direction * (aDispatchMinutes - bDispatchMinutes);

        case 'status':
          return direction * (a.trip.status || '').localeCompare(b.trip.status || '');

        default:
          return 0;
      }
    });
  }, [filteredRows, sortConfig]);

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
  const getLinehaulInfo = (row: OutboundTripRow): { origin: string; destination: string; linehaulName: string; leg: string } => {
    // First try trip-level linehaulName (from API transformation)
    const linehaulName = row.trip.linehaulName || row.loadsheets?.[0]?.linehaulName || '-';
    const parsed = parseLeg(linehaulName);

    // If parsing didn't get destination, try loadsheet's destinationTerminalCode
    if (parsed.destination === '-' && row.loadsheets && row.loadsheets.length > 0) {
      const firstLoadsheet = row.loadsheets[0];
      if (firstLoadsheet.destinationTerminalCode) {
        const origin = firstLoadsheet.originTerminalCode || parsed.origin;
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
  const getTotalPieces = (row: OutboundTripRow): number | null => {
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
  const getTotalWeight = (row: OutboundTripRow): number | null => {
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

  // Calculate total trailer length (in feet) for a trip
  // Includes primary trailer, trailer2, and trailer3 if present
  const getTotalTrailerLength = (row: OutboundTripRow): number | null => {
    let totalLength = 0;

    // Get length from trip's trailers
    if (row.trip.trailer?.lengthFeet) {
      totalLength += row.trip.trailer.lengthFeet;
    }
    if (row.trip.trailer2?.lengthFeet) {
      totalLength += row.trip.trailer2.lengthFeet;
    }
    if ((row.trip as any).trailer3?.lengthFeet) {
      totalLength += (row.trip as any).trailer3.lengthFeet;
    }

    // If no trailer length from trip, try to get from loadsheet's suggestedTrailerLength
    if (totalLength === 0 && row.loadsheets && row.loadsheets.length > 0) {
      const loadsheetLength = row.loadsheets.reduce((sum, ls) => sum + (ls.suggestedTrailerLength || 0), 0);
      if (loadsheetLength > 0) totalLength = loadsheetLength;
    }

    return totalLength > 0 ? totalLength : null;
  };

  // Calculate Load Factor percentage
  // LF % = (Weight / (Trailer Length * 590)) * 100
  // 590 lbs per foot is the industry standard for LTL
  const getLoadFactor = (row: OutboundTripRow): number | null => {
    const weight = getTotalWeight(row);
    const trailerLength = getTotalTrailerLength(row);

    if (!weight || !trailerLength || trailerLength === 0) return null;

    const lf = (weight / (trailerLength * 590)) * 100;
    return Math.round(lf * 10) / 10; // Round to 1 decimal place
  };

  // Calculate cumulative load factor for all filtered rows
  const cumulativeLoadFactor = useMemo(() => {
    let totalWeight = 0;
    let totalTrailerLength = 0;

    filteredRows.forEach(row => {
      const weight = getTotalWeight(row);
      const length = getTotalTrailerLength(row);
      if (weight && length) {
        totalWeight += weight;
        totalTrailerLength += length;
      }
    });

    if (totalTrailerLength === 0) return null;

    const lf = (totalWeight / (totalTrailerLength * 590)) * 100;
    return Math.round(lf * 10) / 10;
  }, [filteredRows]);

  // Check if trip has a late reason recorded
  const hasLateReasonRecorded = (tripId: number): boolean => {
    return tripIdsWithLateReasons.has(tripId);
  };

  // Open late reason modal (for entering a new late reason)
  const handleLateClick = (row: OutboundTripRow) => {
    setSelectedLateTrip(row);
    setLateModalOpen(true);
  };

  // Open late reason view modal (for viewing an existing late reason)
  const handleViewLateReason = (tripId: number, tripNumber: string) => {
    setViewTripId(tripId);
    setViewTripNumber(tripNumber);
    setViewModalOpen(true);
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
    await queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
    await queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
    await refetchTrips();
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

            {/* Late Filter */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLateOnly}
                onChange={(e) => setShowLateOnly(e.target.checked)}
                className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Late Only
              </span>
            </label>

            {/* Headhaul Only Filter */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeadhaulOnly}
                onChange={(e) => setShowHeadhaulOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                HH Only
              </span>
            </label>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetchTrips()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Outbound Trips Grid */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center flex-wrap gap-2">
            <Truck className="w-5 h-5 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Outbound Trips</h3>
            <span className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full text-xs">
              {filteredRows.length} dispatched
            </span>
            {cumulativeLoadFactor !== null && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                cumulativeLoadFactor >= 85 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                cumulativeLoadFactor >= 65 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                <Percent className="h-3 w-3" />
                Avg LF: {cumulativeLoadFactor.toFixed(1)}%
              </span>
            )}
            {showHeadhaulOnly && (
              <span className="flex items-center gap-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-xs">
                <TrendingUp className="h-3 w-3" />
                Headhaul Only
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {startDate && endDate ? (
              startDate === endDate
                ? `Trips dispatched on ${format(new Date(startDate), 'MMMM d, yyyy')}`
                : `Trips dispatched from ${format(new Date(startDate), 'MMM d, yyyy')} to ${format(new Date(endDate), 'MMM d, yyyy')}`
            ) : startDate ? (
              `Trips dispatched from ${format(new Date(startDate), 'MMMM d, yyyy')}`
            ) : endDate ? (
              `Trips dispatched until ${format(new Date(endDate), 'MMMM d, yyyy')}`
            ) : (
              'All dispatched trips'
            )}
            {selectedLocations.length > 0 && (
              ` from ${selectedLocations.map(id => locations.find(l => l.id === id)?.code).filter(Boolean).join(', ')}`
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading outbound trips...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No outbound trips found{searchTerm ? ' matching your search' : ' for this date'}.
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
                  <SortableHeader column="lf" label="LF %" sortConfig={sortConfig} onSort={handleSort} align="right" icon={<Percent className="h-3 w-3" />} />
                  <SortableHeader column="schedDepart" label="Sched Depart" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="dispatched" label="Dispatched" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableHeader column="status" label="Status" sortConfig={sortConfig} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRows.map((row) => {
                  const linehaulInfo = getLinehaulInfo(row);
                  const totalPieces = getTotalPieces(row);
                  const totalWeight = getTotalWeight(row);
                  const schedDepart = getSchedDepart(row);
                  const dispatchTime = getDispatchTime(row);
                  const tripIsLate = isLate(row);
                  const hasLateReason = hasLateReasonRecorded(row.trip.id);

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
                          <span className="text-gray-900 dark:text-gray-100">
                            {row.trip.truck?.unitNumber || 'OWNOP'}
                          </span>
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
                          <span className="text-gray-900 dark:text-gray-100">{linehaulInfo.origin}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                        {totalPieces !== null ? totalPieces.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-gray-900 dark:text-gray-100">
                        {totalWeight !== null ? `${totalWeight.toLocaleString()} lbs` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {(() => {
                          const lf = getLoadFactor(row);
                          if (lf === null) return <span className="text-gray-400">-</span>;
                          const colorClass = lf >= 85 ? 'text-green-600 dark:text-green-400' :
                                             lf >= 65 ? 'text-yellow-600 dark:text-yellow-400' :
                                             'text-red-600 dark:text-red-400';
                          return <span className={`font-medium ${colorClass}`}>{lf.toFixed(1)}%</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {schedDepart.date && schedDepart.time ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">{schedDepart.date}</span>
                            <span>{schedDepart.time}</span>
                          </div>
                        ) : schedDepart.time ? (
                          schedDepart.time
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {dispatchTime.date && dispatchTime.time ? (
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">{dispatchTime.date}</span>
                              <span className="text-gray-600 dark:text-gray-400">{dispatchTime.time}</span>
                            </div>
                          ) : dispatchTime.time ? (
                            <span className="text-gray-600 dark:text-gray-400">{dispatchTime.time}</span>
                          ) : (
                            <span className="text-gray-600 dark:text-gray-400">-</span>
                          )}
                          {tripIsLate && !hasLateReason && (
                            <button
                              onClick={() => handleLateClick(row)}
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 cursor-pointer"
                              title="Click to enter late reason"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Late
                            </button>
                          )}
                          {tripIsLate && hasLateReason && (
                            <button
                              onClick={() => handleViewLateReason(row.trip.id, row.trip.tripNumber)}
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 cursor-pointer"
                              title="Click to view late reason"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Reason
                            </button>
                          )}
                        </div>
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

      {/* Late Reason Modal (for entering new late reasons) */}
      {selectedLateTrip && (
        <LateReasonModal
          isOpen={lateModalOpen}
          onClose={async () => {
            // First invalidate all related queries to clear cache
            await queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
            await queryClient.invalidateQueries({ queryKey: ['loadsheets-for-outbound'] });
            await queryClient.invalidateQueries({ queryKey: ['late-departure-reasons-for-outbound'] });

            // Then refetch to get fresh data
            await Promise.all([
              refetchTrips(),
              refetchLoadsheets(),
              refetchLateReasons()
            ]);

            setLateModalOpen(false);
            setSelectedLateTrip(null);
          }}
          trip={selectedLateTrip.trip}
          loadsheets={selectedLateTrip.loadsheets}
          schedDepartTime={getSchedDepart(selectedLateTrip).time}
          dispatchTime={getDispatchTime(selectedLateTrip).time}
        />
      )}

      {/* Late Reason View Modal (for viewing existing late reasons) */}
      {viewTripId && (
        <LateReasonViewModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setViewTripId(null);
            setViewTripNumber('');
          }}
          tripId={viewTripId}
          tripNumber={viewTripNumber}
        />
      )}

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
        />
      )}
    </div>
  );
};
