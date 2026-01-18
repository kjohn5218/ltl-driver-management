import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { linehaulTripService } from '../../services/linehaulTripService';
import { loadsheetService } from '../../services/loadsheetService';
import { locationService } from '../../services/locationService';
import { lateDepartureReasonService } from '../../services/lateDepartureReasonService';
import { LinehaulTrip, Loadsheet, TripStatus, Location } from '../../types';
import { TripStatusBadge } from './TripStatusBadge';
import { LateReasonModal } from './LateReasonModal';
import { LateReasonViewModal } from './LateReasonViewModal';
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
  CheckCircle2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface OutboundTripRow {
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
}

export const OutboundTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [locationFilter, setLocationFilter] = useState<number | ''>('');

  // Late reason modal state
  const [lateModalOpen, setLateModalOpen] = useState(false);
  const [selectedLateTrip, setSelectedLateTrip] = useState<OutboundTripRow | null>(null);

  // Late reason view modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewTripId, setViewTripId] = useState<number | null>(null);
  const [viewTripNumber, setViewTripNumber] = useState<string>('');

  // Fetch locations for filter dropdown
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Fetch dispatched trips
  const { data: tripsData, isLoading, refetch: refetchTrips } = useQuery({
    queryKey: ['outbound-trips', startDate, endDate, locationFilter],
    queryFn: () => linehaulTripService.getTrips({
      status: 'DISPATCHED' as TripStatus,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      originTerminalId: locationFilter || undefined,
      limit: 100
    }),
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch loadsheets (without date filter - we'll match by linehaulTripId)
  const { data: loadsheetsData, refetch: refetchLoadsheets } = useQuery({
    queryKey: ['loadsheets-for-outbound'],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({ limit: 100 });
      return response.loadsheets;
    }
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
    // Find loadsheets associated with this trip
    const tripLoadsheets = loadsheets.filter(ls => ls.linehaulTripId === trip.id);
    return { trip, loadsheets: tripLoadsheets };
  });

  // Filter by search term
  const filteredRows = outboundRows.filter(row => {
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

  // Get scheduled departure time from loadsheet or trip (returns HH:mm format)
  const getSchedDepart = (row: OutboundTripRow): string | null => {
    // First check loadsheets for target dispatch time (stored as "HH:MM" or "HH:MM:SS" string)
    if (row.loadsheets.length > 0) {
      const firstLoadsheet = row.loadsheets[0];
      if (firstLoadsheet.targetDispatchTime) {
        // Format to remove seconds if present
        return formatTimeForDisplay(firstLoadsheet.targetDispatchTime);
      }
    }
    // Fall back to trip's planned departure (stored as ISO datetime)
    if (row.trip.plannedDeparture) {
      try {
        // plannedDeparture is stored as a full datetime, extract time portion
        const plannedDate = typeof row.trip.plannedDeparture === 'string'
          ? parseISO(row.trip.plannedDeparture)
          : new Date(row.trip.plannedDeparture);
        return format(plannedDate, 'HH:mm');
      } catch {
        return null;
      }
    }
    return null;
  };

  // Get dispatch time (returns HH:mm format)
  const getDispatchTime = (row: OutboundTripRow): string | null => {
    if (row.trip.actualDeparture) {
      try {
        const actualDate = typeof row.trip.actualDeparture === 'string'
          ? parseISO(row.trip.actualDeparture)
          : new Date(row.trip.actualDeparture);
        return format(actualDate, 'HH:mm');
      } catch {
        return null;
      }
    }
    // If no actual departure, use created time as proxy
    try {
      return format(parseISO(row.trip.createdAt), 'HH:mm');
    } catch {
      return null;
    }
  };

  // Check if trip is late (dispatch time > sched depart)
  const isLate = (row: OutboundTripRow): boolean => {
    const schedDepart = getSchedDepart(row);
    const dispatchTime = getDispatchTime(row);

    if (!schedDepart || !dispatchTime) return false;

    // Parse both times to minutes for comparison
    const schedMinutes = parseTimeToMinutes(schedDepart);
    const dispatchMinutes = parseTimeToMinutes(dispatchTime);

    if (schedMinutes === null || dispatchMinutes === null) return false;

    // Trip is late if dispatch time is after scheduled departure
    return dispatchMinutes > schedMinutes;
  };

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

            {/* Location Filter */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value ? parseInt(e.target.value) : '')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              >
                <option value="">All Locations</option>
                {locations.map((location: Location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name || location.city}
                  </option>
                ))}
              </select>
            </div>
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
          <div className="flex items-center">
            <Truck className="w-5 h-5 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Outbound Trips</h3>
            <span className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full text-xs">
              {filteredRows.length} dispatched
            </span>
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
            {locationFilter && locations.find((l: Location) => l.id === locationFilter) && (
              ` from ${locations.find((l: Location) => l.id === locationFilter)?.code}`
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
                    Sched Depart
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Dispatched
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
                  const schedDepart = getSchedDepart(row);
                  const dispatchTime = getDispatchTime(row);
                  const tripIsLate = isLate(row);
                  const hasLateReason = hasLateReasonRecorded(row.trip.id);

                  return (
                    <tr key={row.trip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">
                          {row.trip.tripNumber}
                        </span>
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
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {formatManifests(row.loadsheets)}
                          </span>
                          {row.loadsheets.length > 1 && (
                            <span className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs">
                              {row.loadsheets.length}
                            </span>
                          )}
                        </div>
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
                        {schedDepart || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-gray-600 dark:text-gray-400">
                            {dispatchTime || '-'}
                          </span>
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
          schedDepartTime={getSchedDepart(selectedLateTrip)}
          dispatchTime={getDispatchTime(selectedLateTrip)}
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
    </div>
  );
};
