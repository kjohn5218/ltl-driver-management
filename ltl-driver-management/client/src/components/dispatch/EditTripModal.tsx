import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linehaulTripService } from '../../services/linehaulTripService';
import { equipmentService } from '../../services/equipmentService';
import { driverService } from '../../services/driverService';
import { loadsheetService } from '../../services/loadsheetService';
import { LinehaulTrip, TripStatus, CarrierDriver, EquipmentTruck, EquipmentTrailer, EquipmentDolly, Loadsheet } from '../../types';
import {
  X,
  Truck,
  Calendar,
  Clock,
  MapPin,
  FileText,
  CheckCircle,
  Search,
  Save
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface EditTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  onSaved?: () => void;
  mode?: 'outbound' | 'inbound';
}

const TRIP_STATUSES: { value: TripStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

const INBOUND_STATUSES: { value: TripStatus; label: string }[] = [
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'COMPLETED', label: 'Completed' }
];

export const EditTripModal: React.FC<EditTripModalProps> = ({
  isOpen,
  onClose,
  tripId,
  onSaved,
  mode = 'outbound'
}) => {
  const isInbound = mode === 'inbound';
  const statusOptions = isInbound ? INBOUND_STATUSES : TRIP_STATUSES;
  const queryClient = useQueryClient();

  // Form state
  const [status, setStatus] = useState<TripStatus>('PLANNED');
  const [dispatchDate, setDispatchDate] = useState('');
  const [plannedDepartureDate, setPlannedDepartureDate] = useState('');
  const [plannedDepartureTime, setPlannedDepartureTime] = useState('');
  const [actualDepartureDate, setActualDepartureDate] = useState('');
  const [actualDepartureTime, setActualDepartureTime] = useState('');
  const [plannedArrivalDate, setPlannedArrivalDate] = useState('');
  const [plannedArrivalTime, setPlannedArrivalTime] = useState('');
  const [actualArrivalDate, setActualArrivalDate] = useState('');
  const [actualArrivalTime, setActualArrivalTime] = useState('');
  const [actualMileage, setActualMileage] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Selection state
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [selectedTrailerId, setSelectedTrailerId] = useState<number | null>(null);
  const [selectedDollyId, setSelectedDollyId] = useState<number | null>(null);
  const [selectedTrailer2Id, setSelectedTrailer2Id] = useState<number | null>(null);
  const [selectedDolly2Id, setSelectedDolly2Id] = useState<number | null>(null);
  const [selectedTrailer3Id, setSelectedTrailer3Id] = useState<number | null>(null);

  // Manifest selection state (loadsheet IDs)
  const [selectedManifest1Id, setSelectedManifest1Id] = useState<number | null>(null);
  const [selectedManifest2Id, setSelectedManifest2Id] = useState<number | null>(null);
  const [selectedManifest3Id, setSelectedManifest3Id] = useState<number | null>(null);

  // Origin/Destination display state (derived from matched loadsheets for correct leg)
  const [displayOrigin, setDisplayOrigin] = useState<string>('');
  const [displayDestination, setDisplayDestination] = useState<string>('');

  // Search state
  const [driverSearch, setDriverSearch] = useState('');
  const [truckSearch, setTruckSearch] = useState('');
  const [trailerSearch, setTrailerSearch] = useState('');
  const [dollySearch, setDollySearch] = useState('');
  const [trailer2Search, setTrailer2Search] = useState('');
  const [dolly2Search, setDolly2Search] = useState('');
  const [trailer3Search, setTrailer3Search] = useState('');
  const [manifest1Search, setManifest1Search] = useState('');
  const [manifest2Search, setManifest2Search] = useState('');
  const [manifest3Search, setManifest3Search] = useState('');

  // Dropdown state
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);
  const [truckDropdownOpen, setTruckDropdownOpen] = useState(false);
  const [dollyDropdownOpen, setDollyDropdownOpen] = useState(false);
  const [dolly2DropdownOpen, setDolly2DropdownOpen] = useState(false);
  const [manifest1DropdownOpen, setManifest1DropdownOpen] = useState(false);
  const [manifest2DropdownOpen, setManifest2DropdownOpen] = useState(false);
  const [manifest3DropdownOpen, setManifest3DropdownOpen] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track if we're in initial load to prevent cascade effects
  const isInitializing = useRef(false);

  // Fetch trip data
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ['trip-edit', tripId],
    queryFn: () => linehaulTripService.getTripById(tripId),
    enabled: isOpen && !!tripId
  });

  // Fetch drivers
  const { data: driversData } = useQuery({
    queryKey: ['drivers-edit-trip'],
    queryFn: () => driverService.getDrivers({ active: true, limit: 200 }),
    enabled: isOpen
  });

  // Fetch trucks
  const { data: trucksData } = useQuery({
    queryKey: ['trucks-edit-trip'],
    queryFn: () => equipmentService.getTrucks({ limit: 200 }),
    enabled: isOpen
  });

  // Fetch trailers
  const { data: trailersData } = useQuery({
    queryKey: ['trailers-edit-trip'],
    queryFn: () => equipmentService.getTrailers({ limit: 500 }),
    enabled: isOpen
  });

  // Fetch dollies
  const { data: dolliesData } = useQuery({
    queryKey: ['dollies-edit-trip'],
    queryFn: () => equipmentService.getDollies({ limit: 100 }),
    enabled: isOpen
  });

  // Fetch available loadsheets (OPEN/LOADING status)
  const { data: loadsheetsData } = useQuery({
    queryKey: ['loadsheets-edit-trip-available'],
    queryFn: () => loadsheetService.getLoadsheets({ limit: 100 }),
    enabled: isOpen
  });

  // Fetch loadsheets assigned to this specific trip (includes DISPATCHED status)
  const { data: tripLoadsheetsData } = useQuery({
    queryKey: ['loadsheets-edit-trip-assigned', tripId],
    queryFn: () => loadsheetService.getLoadsheets({ linehaulTripId: tripId, limit: 100 }),
    enabled: isOpen && !!tripId
  });

  const drivers = driversData?.drivers || [];
  const trucks = trucksData?.trucks || [];
  const trailers = trailersData?.trailers || [];
  const dollies = dolliesData?.dollies || [];

  // Get trip's origin terminal code for filtering
  const tripOriginCode = trip?.linehaulProfile?.originTerminal?.code;

  // Combine available loadsheets with trip-assigned loadsheets
  const allLoadsheets = React.useMemo(() => {
    const available = loadsheetsData?.loadsheets || [];
    const tripAssigned = tripLoadsheetsData?.loadsheets || [];

    // Merge the two lists, avoiding duplicates by ID
    const combined = [...tripAssigned];
    const existingIds = new Set(tripAssigned.map((ls: Loadsheet) => ls.id));

    for (const ls of available) {
      if (!existingIds.has(ls.id)) {
        combined.push(ls);
      }
    }

    return combined;
  }, [loadsheetsData, tripLoadsheetsData]);

  // Filter loadsheets: show those assigned to this trip OR available (not assigned and not DISPATCHED/CLOSED)
  const availableLoadsheets = allLoadsheets.filter(
    (ls: Loadsheet) => {
      // For loadsheets assigned to this trip, always show them
      // Don't filter by terminal codes - they may have been updated after arrival
      // or may represent different legs in a multi-leg route
      if (ls.linehaulTripId === tripId) {
        return true;
      }
      // For unassigned loadsheets, exclude DISPATCHED and CLOSED status
      // Also filter by origin if available (show loadsheets from same origin terminal)
      if (!ls.linehaulTripId && ls.status !== 'DISPATCHED' && ls.status !== 'CLOSED') {
        // If we have trip origin code, prefer loadsheets from same origin
        if (tripOriginCode && ls.originTerminalCode) {
          return ls.originTerminalCode === tripOriginCode;
        }
        return true;
      }
      return false;
    }
  );

  // Helper to clean up notes - no longer strips dispatch/arrival notes, just trims
  const cleanNotes = (notesText: string | null | undefined): string => {
    if (!notesText) return '';
    return notesText.trim();
  };

  // Parse datetime to date and time parts
  const parseDatetime = (datetime: string | null | undefined): { date: string; time: string } => {
    if (!datetime) return { date: '', time: '' };
    try {
      const parsed = parseISO(datetime);
      return {
        date: format(parsed, 'yyyy-MM-dd'),
        time: format(parsed, 'HH:mm')
      };
    } catch {
      return { date: '', time: '' };
    }
  };

  // Track if we've already initialized to prevent re-initialization
  const hasInitialized = useRef(false);

  // Initialize form when trip data loads
  useEffect(() => {
    if (trip && isOpen && !hasInitialized.current) {
      // Set flag to prevent cascade effects during initialization
      isInitializing.current = true;
      hasInitialized.current = true;

      setStatus(trip.status);
      setDispatchDate(trip.dispatchDate ? format(parseISO(trip.dispatchDate), 'yyyy-MM-dd') : '');

      const plannedDep = parseDatetime(trip.plannedDeparture);
      setPlannedDepartureDate(plannedDep.date);
      setPlannedDepartureTime(plannedDep.time);

      const actualDep = parseDatetime(trip.actualDeparture);
      setActualDepartureDate(actualDep.date);
      setActualDepartureTime(actualDep.time);

      const plannedArr = parseDatetime(trip.plannedArrival);
      setPlannedArrivalDate(plannedArr.date);
      setPlannedArrivalTime(plannedArr.time);

      const actualArr = parseDatetime(trip.actualArrival);
      setActualArrivalDate(actualArr.date);
      setActualArrivalTime(actualArr.time);

      setActualMileage(trip.actualMileage?.toString() || '');
      setNotes(cleanNotes(trip.notes));

      // Initialize origin/destination from trip profile (will be overridden by loadsheet data if available)
      setDisplayOrigin(trip.linehaulProfile?.originTerminal?.name || trip.linehaulProfile?.origin || '');
      setDisplayDestination(trip.linehaulProfile?.destinationTerminal?.name || trip.linehaulProfile?.destination || '');

      setSelectedDriverId(trip.driverId || null);
      setSelectedTruckId(trip.truckId || null);
      setSelectedTrailerId(trip.trailerId || null);
      setSelectedDollyId(trip.dollyId || null);
      setSelectedTrailer2Id(trip.trailer2Id || null);
      setSelectedDolly2Id(trip.dolly2Id || null);
      setSelectedTrailer3Id(trip.trailer3Id || null);

      // Set search fields to display current values
      setDriverSearch(trip.driver?.number ? `${trip.driver.name} (${trip.driver.number})` : trip.driver?.name || '');
      setTruckSearch(trip.truck?.unitNumber || '');
      setTrailerSearch(trip.trailer?.unitNumber || '');
      setDollySearch(trip.dolly?.unitNumber || '');
      setTrailer2Search(trip.trailer2?.unitNumber || '');
      setDolly2Search(trip.dolly2?.unitNumber || '');
      setTrailer3Search(trip.trailer3?.unitNumber || '');

      // Reset manifest selections (will be set when loadsheets data loads)
      setSelectedManifest1Id(null);
      setSelectedManifest2Id(null);
      setSelectedManifest3Id(null);
      setManifest1Search('');
      setManifest2Search('');
      setManifest3Search('');

      // Reset success/error
      setSubmitSuccess(false);
      setSubmitError(null);

      // Allow cascade effects after a short delay to ensure all state is set
      setTimeout(() => {
        isInitializing.current = false;
      }, 100);
    }
  }, [trip, isOpen]);

  // Initialize manifest selections when loadsheets data loads
  useEffect(() => {
    if ((tripLoadsheetsData || loadsheetsData) && trip && isOpen && trailers.length > 0) {
      // Get the trip's origin and destination terminal codes from the profile
      const tripOriginCode = trip.linehaulProfile?.originTerminal?.code;
      const tripDestCode = trip.linehaulProfile?.destinationTerminal?.code;

      // Get all loadsheets assigned to this trip (prioritize tripLoadsheetsData which includes DISPATCHED loadsheets)
      const allTripLoadsheets = (tripLoadsheetsData?.loadsheets || []).filter(
        (ls: Loadsheet) => ls.linehaulTripId === tripId
      );

      // Try to filter by origin/destination codes to get the correct leg
      let tripLoadsheets = allTripLoadsheets;
      if (tripOriginCode && tripDestCode && allTripLoadsheets.length > 0) {
        const legMatched = allTripLoadsheets.filter(
          (ls: Loadsheet) =>
            ls.originTerminalCode === tripOriginCode &&
            ls.destinationTerminalCode === tripDestCode
        );
        // Only use filtered results if we found matches
        if (legMatched.length > 0) {
          tripLoadsheets = legMatched;
        }
      }

      // Populate manifest fields with loadsheets assigned to this trip
      // Also update trailer fields to match the manifest's trailerNumber
      // And set origin/destination from the loadsheet's terminal codes
      if (tripLoadsheets.length > 0) {
        const manifest1 = tripLoadsheets[0];
        setSelectedManifest1Id(manifest1.id);
        setManifest1Search(manifest1.manifestNumber);
        // Update trailer to match manifest
        setTrailerSearch(manifest1.trailerNumber || '');
        const trailer = trailers.find((t: EquipmentTrailer) => t.unitNumber === manifest1.trailerNumber);
        if (trailer) setSelectedTrailerId(trailer.id);

        // Update origin/destination display based on loadsheet (correct leg for multi-leg trips)
        if (manifest1.originTerminalCode) {
          setDisplayOrigin(manifest1.originTerminalCode);
        }
        if (manifest1.destinationTerminalCode) {
          setDisplayDestination(manifest1.destinationTerminalCode);
        }
      }
      if (tripLoadsheets.length > 1) {
        const manifest2 = tripLoadsheets[1];
        setSelectedManifest2Id(manifest2.id);
        setManifest2Search(manifest2.manifestNumber);
        // Update trailer 2 to match manifest
        setTrailer2Search(manifest2.trailerNumber || '');
        const trailer = trailers.find((t: EquipmentTrailer) => t.unitNumber === manifest2.trailerNumber);
        if (trailer) setSelectedTrailer2Id(trailer.id);
      }
      if (tripLoadsheets.length > 2) {
        const manifest3 = tripLoadsheets[2];
        setSelectedManifest3Id(manifest3.id);
        setManifest3Search(manifest3.manifestNumber);
        // Update trailer 3 to match manifest
        setTrailer3Search(manifest3.trailerNumber || '');
        const trailer = trailers.find((t: EquipmentTrailer) => t.unitNumber === manifest3.trailerNumber);
        if (trailer) setSelectedTrailer3Id(trailer.id);
      }
    }
  }, [loadsheetsData, tripLoadsheetsData, trip, tripId, isOpen, trailers]);

  // Reset initialization flags when modal closes
  useEffect(() => {
    if (!isOpen) {
      isInitializing.current = false;
      hasInitialized.current = false;
      setDisplayOrigin('');
      setDisplayDestination('');
    }
  }, [isOpen]);

  // Cascade clearing: when dolly 1 is cleared, clear manifest 2, trailer 2, dolly 2, manifest 3, and trailer 3
  useEffect(() => {
    if (isInitializing.current) return;
    if (!selectedDollyId) {
      setSelectedManifest2Id(null);
      setManifest2Search('');
      setSelectedTrailer2Id(null);
      setTrailer2Search('');
      setSelectedDolly2Id(null);
      setDolly2Search('');
      setSelectedManifest3Id(null);
      setManifest3Search('');
      setSelectedTrailer3Id(null);
      setTrailer3Search('');
    }
  }, [selectedDollyId]);

  // When manifest 2 / trailer 2 is cleared, clear dolly 2, manifest 3, and trailer 3
  useEffect(() => {
    if (isInitializing.current) return;
    if (!selectedTrailer2Id) {
      setSelectedDolly2Id(null);
      setDolly2Search('');
      setSelectedManifest3Id(null);
      setManifest3Search('');
      setSelectedTrailer3Id(null);
      setTrailer3Search('');
    }
  }, [selectedTrailer2Id]);

  // When dolly 2 is cleared, clear manifest 3 and trailer 3
  useEffect(() => {
    if (isInitializing.current) return;
    if (!selectedDolly2Id) {
      setSelectedManifest3Id(null);
      setManifest3Search('');
      setSelectedTrailer3Id(null);
      setTrailer3Search('');
    }
  }, [selectedDolly2Id]);

  // Update trip mutation
  const updateTripMutation = useMutation({
    mutationFn: (data: Partial<LinehaulTrip>) => linehaulTripService.updateTrip(tripId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip-edit', tripId] });
    }
  });

  // Combine date and time into ISO datetime
  const combineDateTime = (date: string, time: string): string | undefined => {
    if (!date) return undefined;
    if (!time) return `${date}T00:00:00`;
    return `${date}T${time}:00`;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const updates: Partial<LinehaulTrip> = {
        status,
        dispatchDate: dispatchDate ? `${dispatchDate}T00:00:00` : undefined,
        plannedDeparture: combineDateTime(plannedDepartureDate, plannedDepartureTime),
        actualDeparture: combineDateTime(actualDepartureDate, actualDepartureTime),
        plannedArrival: combineDateTime(plannedArrivalDate, plannedArrivalTime),
        actualArrival: combineDateTime(actualArrivalDate, actualArrivalTime),
        actualMileage: actualMileage ? parseInt(actualMileage, 10) : undefined,
        notes: notes || undefined,
        driverId: selectedDriverId || undefined,
        truckId: selectedTruckId || undefined,
        trailerId: selectedTrailerId || undefined,
        dollyId: selectedDollyId || undefined,
        trailer2Id: selectedDollyId ? (selectedTrailer2Id || undefined) : undefined,
        dolly2Id: selectedTrailer2Id ? (selectedDolly2Id || undefined) : undefined,
        trailer3Id: selectedDolly2Id ? (selectedTrailer3Id || undefined) : undefined
      };

      await updateTripMutation.mutateAsync(updates);

      // Update loadsheet assignments
      const selectedManifestIds = [selectedManifest1Id, selectedManifest2Id, selectedManifest3Id].filter(Boolean) as number[];
      const previouslyAssignedLoadsheets = (loadsheetsData?.loadsheets || []).filter(
        (ls: Loadsheet) => ls.linehaulTripId === tripId
      );

      // Unassign loadsheets that are no longer selected
      for (const ls of previouslyAssignedLoadsheets) {
        if (!selectedManifestIds.includes(ls.id)) {
          await loadsheetService.updateLoadsheet(ls.id, { linehaulTripId: undefined });
        }
      }

      // Assign newly selected loadsheets to this trip
      for (const manifestId of selectedManifestIds) {
        const loadsheet = availableLoadsheets.find((ls: Loadsheet) => ls.id === manifestId);
        if (loadsheet && loadsheet.linehaulTripId !== tripId) {
          await loadsheetService.updateLoadsheet(manifestId, { linehaulTripId: tripId });
        }
      }

      // Invalidate loadsheet queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['loadsheets-edit-trip-available'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-edit-trip-assigned'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-outbound'] });

      setSubmitSuccess(true);

      setTimeout(() => {
        onSaved?.();
        onClose();
      }, 800);
    } catch (error: any) {
      console.error('Error updating trip:', error);
      setSubmitError(error.response?.data?.message || 'Failed to update trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter functions for dropdowns
  const getFilteredDrivers = (search: string) => {
    return drivers
      .filter((d: CarrierDriver) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return d.name?.toLowerCase().includes(s) || d.number?.toLowerCase().includes(s);
      })
      .slice(0, 15);
  };

  const getFilteredTrucks = (search: string) => {
    return trucks
      .filter((t: EquipmentTruck) => {
        if (!search.trim()) return true;
        return t.unitNumber?.toLowerCase().includes(search.toLowerCase());
      })
      .slice(0, 15);
  };

  const getFilteredDollies = (search: string, excludeIds: (number | null)[]) => {
    return dollies
      .filter((d: EquipmentDolly) => !excludeIds.includes(d.id))
      .filter((d: EquipmentDolly) => {
        if (!search.trim()) return true;
        return d.unitNumber?.toLowerCase().includes(search.toLowerCase());
      })
      .slice(0, 15);
  };

  const getFilteredManifests = (search: string, excludeIds: (number | null)[]) => {
    return availableLoadsheets
      .filter((ls: Loadsheet) => !excludeIds.includes(ls.id))
      .filter((ls: Loadsheet) => {
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return ls.manifestNumber?.toLowerCase().includes(s) ||
               ls.trailerNumber?.toLowerCase().includes(s);
      })
      .slice(0, 15);
  };

  // Helper to find trailer by unit number string and return its ID
  const findTrailerIdByUnitNumber = (unitNumber: string): number | null => {
    const trailer = trailers.find((t: EquipmentTrailer) => t.unitNumber === unitNumber);
    return trailer?.id || null;
  };

  // Handle selection helpers
  const handleDriverSelect = (driver: CarrierDriver) => {
    setSelectedDriverId(driver.id);
    setDriverSearch(driver.number ? `${driver.name} (${driver.number})` : driver.name);
    setDriverDropdownOpen(false);
  };

  const handleTruckSelect = (truck: EquipmentTruck) => {
    setSelectedTruckId(truck.id);
    setTruckSearch(truck.unitNumber);
    setTruckDropdownOpen(false);
  };

  const handleDollySelect = (dolly: EquipmentDolly) => {
    setSelectedDollyId(dolly.id);
    setDollySearch(dolly.unitNumber);
    setDollyDropdownOpen(false);
  };

  const handleDolly2Select = (dolly: EquipmentDolly) => {
    setSelectedDolly2Id(dolly.id);
    setDolly2Search(dolly.unitNumber);
    setDolly2DropdownOpen(false);
  };

  // Manifest selection handlers - also update the corresponding trailer
  const handleManifest1Select = (loadsheet: Loadsheet) => {
    setSelectedManifest1Id(loadsheet.id);
    setManifest1Search(loadsheet.manifestNumber);
    setManifest1DropdownOpen(false);
    // Update trailer based on manifest's trailerNumber
    const trailerId = findTrailerIdByUnitNumber(loadsheet.trailerNumber);
    setSelectedTrailerId(trailerId);
    setTrailerSearch(loadsheet.trailerNumber);
  };

  const handleManifest2Select = (loadsheet: Loadsheet) => {
    setSelectedManifest2Id(loadsheet.id);
    setManifest2Search(loadsheet.manifestNumber);
    setManifest2DropdownOpen(false);
    // Update trailer 2 based on manifest's trailerNumber
    const trailerId = findTrailerIdByUnitNumber(loadsheet.trailerNumber);
    setSelectedTrailer2Id(trailerId);
    setTrailer2Search(loadsheet.trailerNumber);
  };

  const handleManifest3Select = (loadsheet: Loadsheet) => {
    setSelectedManifest3Id(loadsheet.id);
    setManifest3Search(loadsheet.manifestNumber);
    setManifest3DropdownOpen(false);
    // Update trailer 3 based on manifest's trailerNumber
    const trailerId = findTrailerIdByUnitNumber(loadsheet.trailerNumber);
    setSelectedTrailer3Id(trailerId);
    setTrailer3Search(loadsheet.trailerNumber);
  };

  // Clear handlers
  const clearDriver = () => {
    setSelectedDriverId(null);
    setDriverSearch('');
  };

  const clearTruck = () => {
    setSelectedTruckId(null);
    setTruckSearch('');
  };

  const clearDolly = () => {
    setSelectedDollyId(null);
    setDollySearch('');
  };

  const clearDolly2 = () => {
    setSelectedDolly2Id(null);
    setDolly2Search('');
  };

  // Manifest clear handlers - clear manifest but keep trailer (trailer only changes when new manifest is selected)
  const clearManifest1 = () => {
    setSelectedManifest1Id(null);
    setManifest1Search('');
  };

  const clearManifest2 = () => {
    setSelectedManifest2Id(null);
    setManifest2Search('');
  };

  const clearManifest3 = () => {
    setSelectedManifest3Id(null);
    setManifest3Search('');
  };

  if (!isOpen) return null;

  // Helper to render a searchable dropdown
  const renderSearchDropdown = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    onClear: () => void,
    selectedId: number | null,
    dropdownOpen: boolean,
    setDropdownOpen: (v: boolean) => void,
    items: any[],
    onSelect: (item: any) => void,
    renderItem: (item: any) => React.ReactNode,
    placeholder: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (selectedId) onClear();
          }}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
          placeholder={placeholder}
          className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm"
        />
        {selectedId && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {dropdownOpen && !selectedId && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
              >
                {renderItem(item)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-3xl p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all max-h-[90vh] overflow-y-auto">
          {/* Success overlay */}
          {submitSuccess && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-95 dark:bg-opacity-95 flex items-center justify-center rounded-lg z-10">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Trip Updated!</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-indigo-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Edit Trip {trip?.tripNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {tripLoading ? (
            <div className="py-12 text-center text-gray-500">Loading trip data...</div>
          ) : (
            <>
              {/* Error message */}
              {submitError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Status and Dispatch Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TripStatus)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        Dispatch Date
                      </div>
                    </label>
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>

                {/* Origin and Destination */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        Origin
                      </div>
                    </label>
                    <input
                      type="text"
                      value={displayOrigin}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        Destination
                      </div>
                    </label>
                    <input
                      type="text"
                      value={displayDestination}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
                    />
                  </div>
                </div>

                {/* Driver and Power Unit */}
                <div className="grid grid-cols-2 gap-4">
                  {renderSearchDropdown(
                    'Driver',
                    driverSearch,
                    setDriverSearch,
                    clearDriver,
                    selectedDriverId,
                    driverDropdownOpen,
                    setDriverDropdownOpen,
                    getFilteredDrivers(driverSearch),
                    handleDriverSelect,
                    (driver: CarrierDriver) => (
                      <>
                        <span className="font-medium">{driver.name}</span>
                        {driver.number && <span className="text-gray-500 ml-2">#{driver.number}</span>}
                      </>
                    ),
                    'Search drivers...'
                  )}

                  {renderSearchDropdown(
                    'Power Unit',
                    truckSearch,
                    setTruckSearch,
                    clearTruck,
                    selectedTruckId,
                    truckDropdownOpen,
                    setTruckDropdownOpen,
                    getFilteredTrucks(truckSearch),
                    handleTruckSelect,
                    (truck: EquipmentTruck) => (
                      <>
                        <span className="font-medium">{truck.unitNumber}</span>
                        <span className="text-gray-500 ml-2">- {truck.truckType}</span>
                      </>
                    ),
                    'Search trucks...'
                  )}
                </div>

                {/* Manifest 1 and Trailer 1 */}
                <div className="grid grid-cols-2 gap-4">
                  {renderSearchDropdown(
                    'Manifest 1',
                    manifest1Search,
                    setManifest1Search,
                    clearManifest1,
                    selectedManifest1Id,
                    manifest1DropdownOpen,
                    setManifest1DropdownOpen,
                    getFilteredManifests(manifest1Search, [selectedManifest2Id, selectedManifest3Id]),
                    handleManifest1Select,
                    (loadsheet: Loadsheet) => (
                      <>
                        <span className="font-medium">{loadsheet.manifestNumber}</span>
                        <span className="text-gray-500 ml-2">- {loadsheet.trailerNumber}</span>
                      </>
                    ),
                    'Search manifests...'
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Trailer 1
                    </label>
                    <input
                      type="text"
                      value={trailerSearch}
                      readOnly
                      placeholder="Select a manifest first"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
                    />
                  </div>
                </div>

                {/* Dolly 1 */}
                {renderSearchDropdown(
                  'Dolly 1',
                  dollySearch,
                  setDollySearch,
                  clearDolly,
                  selectedDollyId,
                  dollyDropdownOpen,
                  setDollyDropdownOpen,
                  getFilteredDollies(dollySearch, [selectedDolly2Id]),
                  handleDollySelect,
                  (dolly: EquipmentDolly) => (
                    <>
                      <span className="font-medium">{dolly.unitNumber}</span>
                      <span className="text-gray-500 ml-2">- {dolly.dollyType}</span>
                    </>
                  ),
                  'Search dollies...'
                )}

                {/* Manifest 2 and Trailer 2 - Only shown when Dolly 1 is selected */}
                {selectedDollyId && (
                  <div className="grid grid-cols-2 gap-4">
                    {renderSearchDropdown(
                      'Manifest 2',
                      manifest2Search,
                      setManifest2Search,
                      clearManifest2,
                      selectedManifest2Id,
                      manifest2DropdownOpen,
                      setManifest2DropdownOpen,
                      getFilteredManifests(manifest2Search, [selectedManifest1Id, selectedManifest3Id]),
                      handleManifest2Select,
                      (loadsheet: Loadsheet) => (
                        <>
                          <span className="font-medium">{loadsheet.manifestNumber}</span>
                          <span className="text-gray-500 ml-2">- {loadsheet.trailerNumber}</span>
                        </>
                      ),
                      'Search manifests...'
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trailer 2
                      </label>
                      <input
                        type="text"
                        value={trailer2Search}
                        readOnly
                        placeholder="Select a manifest first"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Dolly 2 - Only shown when Trailer 2 is selected */}
                {selectedTrailer2Id && renderSearchDropdown(
                  'Dolly 2',
                  dolly2Search,
                  setDolly2Search,
                  clearDolly2,
                  selectedDolly2Id,
                  dolly2DropdownOpen,
                  setDolly2DropdownOpen,
                  getFilteredDollies(dolly2Search, [selectedDollyId]),
                  handleDolly2Select,
                  (dolly: EquipmentDolly) => (
                    <>
                      <span className="font-medium">{dolly.unitNumber}</span>
                      <span className="text-gray-500 ml-2">- {dolly.dollyType}</span>
                    </>
                  ),
                  'Search dollies...'
                )}

                {/* Manifest 3 and Trailer 3 - Only shown when Dolly 2 is selected */}
                {selectedDolly2Id && (
                  <div className="grid grid-cols-2 gap-4">
                    {renderSearchDropdown(
                      'Manifest 3',
                      manifest3Search,
                      setManifest3Search,
                      clearManifest3,
                      selectedManifest3Id,
                      manifest3DropdownOpen,
                      setManifest3DropdownOpen,
                      getFilteredManifests(manifest3Search, [selectedManifest1Id, selectedManifest2Id]),
                      handleManifest3Select,
                      (loadsheet: Loadsheet) => (
                        <>
                          <span className="font-medium">{loadsheet.manifestNumber}</span>
                          <span className="text-gray-500 ml-2">- {loadsheet.trailerNumber}</span>
                        </>
                      ),
                      'Search manifests...'
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trailer 3
                      </label>
                      <input
                        type="text"
                        value={trailer3Search}
                        readOnly
                        placeholder="Select a manifest first"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Departure Times */}
                <div className={`p-4 rounded-lg ${isInbound ? 'bg-gray-100 dark:bg-gray-700/30 opacity-60' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Departure
                    {isInbound && <span className="ml-2 text-xs text-gray-400">(Read-only)</span>}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Planned</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={plannedDepartureDate}
                          onChange={(e) => setPlannedDepartureDate(e.target.value)}
                          disabled={isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                        <input
                          type="time"
                          value={plannedDepartureTime}
                          onChange={(e) => setPlannedDepartureTime(e.target.value)}
                          disabled={isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={actualDepartureDate}
                          onChange={(e) => setActualDepartureDate(e.target.value)}
                          disabled={isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                        <input
                          type="time"
                          value={actualDepartureTime}
                          onChange={(e) => setActualDepartureTime(e.target.value)}
                          disabled={isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrival Times */}
                <div className={`p-4 rounded-lg ${!isInbound ? 'bg-gray-100 dark:bg-gray-700/30 opacity-60' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Arrival
                    {!isInbound && <span className="ml-2 text-xs text-gray-400">(Read-only)</span>}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Planned</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={plannedArrivalDate}
                          onChange={(e) => setPlannedArrivalDate(e.target.value)}
                          disabled={!isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${!isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                        <input
                          type="time"
                          value={plannedArrivalTime}
                          onChange={(e) => setPlannedArrivalTime(e.target.value)}
                          disabled={!isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${!isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Actual</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={actualArrivalDate}
                          onChange={(e) => setActualArrivalDate(e.target.value)}
                          disabled={!isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${!isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                        <input
                          type="time"
                          value={actualArrivalTime}
                          onChange={(e) => setActualArrivalTime(e.target.value)}
                          disabled={!isInbound}
                          className={`w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm ${!isInbound ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mileage */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Actual Mileage
                    </label>
                    <input
                      type="number"
                      value={actualMileage}
                      onChange={(e) => setActualMileage(e.target.value)}
                      placeholder="Miles"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>

                {/* Notes - full width for better visibility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      Notes
                      <span className="text-xs text-gray-400 ml-2">(includes dispatch and arrival notes)</span>
                    </div>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Trip notes..."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 text-sm resize-y"
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
