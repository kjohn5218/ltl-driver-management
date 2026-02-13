import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, AlertTriangle, CheckCircle, X, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { linehaulTripService } from '../../services/linehaulTripService';
import { equipmentService } from '../../services/equipmentService';
import { loadsheetService } from '../../services/loadsheetService';
import { driverService } from '../../services/driverService';
import { linehaulProfileService } from '../../services/linehaulProfileService';
import { api } from '../../services/api';
import { Loadsheet, EquipmentTruck, EquipmentTrailer, EquipmentDolly, CarrierDriver, LinehaulProfile, Route } from '../../types';
import { TripDocumentsModal } from './TripDocumentsModal';

interface DispatchTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Interface for manifest entry with seal number and dolly (using loadsheet data)
interface ManifestEntry {
  loadsheet: Loadsheet | null;
  sealNumber: string;
  dollyId?: number;
}

export const DispatchTripModal: React.FC<DispatchTripModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Manifest entries (up to 3) - uses loadsheets which have manifest numbers
  const [manifestEntries, setManifestEntries] = useState<ManifestEntry[]>([
    { loadsheet: null, sealNumber: '', dollyId: undefined }
  ]);
  const [manifestSearches, setManifestSearches] = useState<string[]>(['']);
  const [manifestDropdownOpen, setManifestDropdownOpen] = useState<boolean[]>([false, false, false]);

  // Driver search and selection (search by name or number)
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<CarrierDriver | null>(null);
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);

  // Owner operator and power unit
  const [isOwnerOperator, setIsOwnerOperator] = useState(false);
  const [powerUnitSearch, setPowerUnitSearch] = useState('');
  const [selectedPowerUnit, setSelectedPowerUnit] = useState<EquipmentTruck | null>(null);
  const [powerUnitDropdownOpen, setPowerUnitDropdownOpen] = useState(false);

  // Dolly searches for each manifest entry
  const [dollySearches, setDollySearches] = useState<string[]>(['', '', '']);
  const [dollyDropdownOpen, setDollyDropdownOpen] = useState<boolean[]>([false, false, false]);

  // Notes
  const [notes, setNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [dispatchedTripId, setDispatchedTripId] = useState<number | null>(null);
  const [dispatchedTripNumber, setDispatchedTripNumber] = useState<string | undefined>(undefined);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setManifestEntries([{ loadsheet: null, sealNumber: '', dollyId: undefined }]);
      setManifestSearches(['']);
      setManifestDropdownOpen([false, false, false]);
      setDriverSearch('');
      setSelectedDriver(null);
      setDriverDropdownOpen(false);
      setIsOwnerOperator(false);
      setPowerUnitSearch('');
      setSelectedPowerUnit(null);
      setPowerUnitDropdownOpen(false);
      setDollySearches(['', '', '']);
      setDollyDropdownOpen([false, false, false]);
      setNotes('');
      setIsSubmitting(false);
      setShowConfirmModal(false);
      setShowDocumentsModal(false);
      setDispatchedTripId(null);
      setDispatchedTripNumber(undefined);
    }
  }, [isOpen]);

  // Fetch trucks (power units)
  const { data: trucksData, isLoading: trucksLoading } = useQuery({
    queryKey: ['trucks-dispatch'],
    queryFn: async () => {
      const response = await equipmentService.getTrucks({ limit: 100 });
      return response;
    },
    enabled: isOpen
  });

  // Fetch dollies
  const { data: dolliesData, isLoading: dolliesLoading } = useQuery({
    queryKey: ['dollies-dispatch'],
    queryFn: async () => {
      const response = await equipmentService.getDollies({ limit: 100 });
      return response;
    },
    enabled: isOpen
  });

  // Fetch trailers (to link loadsheet trailerNumber to trip trailerId)
  const { data: trailersData } = useQuery({
    queryKey: ['trailers-dispatch'],
    queryFn: async () => {
      const response = await equipmentService.getTrailers({ limit: 500 });
      return response;
    },
    enabled: isOpen
  });

  // Fetch linehaul profiles (for origin/destination lookup)
  const { data: profilesData } = useQuery({
    queryKey: ['linehaul-profiles-dispatch'],
    queryFn: async () => {
      const profiles = await linehaulProfileService.getProfilesList();
      return profiles;
    },
    enabled: isOpen
  });

  // Fetch routes (for fallback origin/destination lookup when linehaulName doesn't match profile name)
  const { data: routesData } = useQuery({
    queryKey: ['routes-for-dispatch'],
    queryFn: async () => {
      const response = await api.get('/routes?limit=1500&active=true');
      const routes = response.data.routes || response.data || [];
      return routes as Route[];
    },
    enabled: isOpen
  });

  const profiles = profilesData || [];
  const routes = routesData || [];

  // Fetch loadsheets (which contain manifest numbers)
  const { data: loadsheetsData, isLoading: loadsheetsLoading } = useQuery({
    queryKey: ['loadsheets-for-dispatch'],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({ limit: 100 });
      return response.loadsheets;
    },
    enabled: isOpen
  });

  // Fetch drivers for search
  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers-dispatch'],
    queryFn: async () => {
      const response = await driverService.getDrivers({ active: true, limit: 2000 });
      return response;
    },
    enabled: isOpen
  });

  const trucks = trucksData?.trucks || [];
  const dollies = dolliesData?.dollies || [];
  const trailers = trailersData?.trailers || [];
  const loadsheets = loadsheetsData || [];
  const drivers = driversData?.drivers || [];

  // Find profile by loadsheet's linehaulName or terminal codes
  const findProfileByLinehaulName = useCallback((linehaulName: string, originTerminalCode?: string | null) => {
    if (!linehaulName || profiles.length === 0) return null;

    // Try matching by profileCode first (e.g., "PHX-ABQ")
    let profile = profiles.find(p => p.profileCode === linehaulName);
    if (profile) return profile;

    // Try matching by exact name
    profile = profiles.find(p => p.name === linehaulName);
    if (profile) return profile;

    // Try case-insensitive match
    const lowerName = linehaulName.toLowerCase();
    profile = profiles.find(p =>
      p.profileCode?.toLowerCase() === lowerName ||
      p.name?.toLowerCase() === lowerName
    );
    if (profile) return profile;

    // Smart matching: find profile where origin terminal code matches
    if (originTerminalCode) {
      const upperLinehaulName = linehaulName.toUpperCase();
      profile = profiles.find(p => {
        const originCode = p.originTerminal?.code?.toUpperCase();
        const destCode = p.destinationTerminal?.code?.toUpperCase();
        return originCode && destCode &&
          upperLinehaulName.startsWith(originCode) &&
          upperLinehaulName.includes(destCode);
      });
      if (profile) return profile;
    }

    // Fallback: try to parse linehaulName and match by terminal codes
    const upperName = linehaulName.toUpperCase();
    profile = profiles.find(p => {
      const originCode = p.originTerminal?.code?.toUpperCase();
      const destCode = p.destinationTerminal?.code?.toUpperCase();
      if (!originCode || !destCode) return false;
      return upperName.startsWith(originCode) && upperName.includes(destCode);
    });
    if (profile) return profile;

    // Final fallback: look up the route by name to get actual origin/destination
    let route = routes.find(r =>
      r.name === linehaulName &&
      originTerminalCode &&
      r.origin?.toUpperCase() === originTerminalCode.toUpperCase()
    );

    if (!route) {
      route = routes.find(r => r.name === linehaulName);
    }

    if (route && route.origin && route.destination) {
      const routeOrigin = route.origin.toUpperCase();
      const routeDest = route.destination.toUpperCase();
      profile = profiles.find(p => {
        const originCode = p.originTerminal?.code?.toUpperCase();
        const destCode = p.destinationTerminal?.code?.toUpperCase();
        return originCode === routeOrigin && destCode === routeDest;
      });
      if (profile) return profile;
    }

    return null;
  }, [profiles, routes]);

  // Calculate origin and destination from selected loadsheets
  const { originCode, destCode, hasManifest } = useMemo(() => {
    const selectedLoadsheets = manifestEntries
      .filter(entry => entry.loadsheet)
      .map(entry => entry.loadsheet!);

    if (selectedLoadsheets.length === 0) {
      return { originCode: null, destCode: null, hasManifest: false };
    }

    const firstLoadsheet = selectedLoadsheets[0];
    const lastLoadsheet = selectedLoadsheets[selectedLoadsheets.length - 1];

    const parsedOrigin = firstLoadsheet.originTerminalCode || null;
    let parsedDest = lastLoadsheet.destinationTerminalCode || null;

    if (!parsedDest && profiles.length > 0) {
      const lastProfile = findProfileByLinehaulName(
        lastLoadsheet.linehaulName,
        lastLoadsheet.originTerminalCode
      );
      if (lastProfile?.destinationTerminal?.code) {
        parsedDest = lastProfile.destinationTerminal.code;
      } else if (lastProfile?.destination) {
        parsedDest = lastProfile.destination;
      }
    }

    return {
      originCode: parsedOrigin,
      destCode: parsedDest,
      hasManifest: true
    };
  }, [manifestEntries, profiles, findProfileByLinehaulName]);

  // Get already selected loadsheet IDs to filter dropdown
  const selectedLoadsheetIds = useMemo(() => {
    return manifestEntries
      .filter(entry => entry.loadsheet)
      .map(entry => entry.loadsheet!.id);
  }, [manifestEntries]);

  // Get already selected dolly IDs to filter dropdown
  const selectedDollyIds = useMemo(() => {
    return manifestEntries
      .filter(entry => entry.dollyId)
      .map(entry => entry.dollyId!);
  }, [manifestEntries]);

  // Determine if we should show the next manifest field
  const shouldShowManifest = (index: number): boolean => {
    if (index === 0) return true;
    const prevEntry = manifestEntries[index - 1];
    return prevEntry?.loadsheet !== null && prevEntry?.dollyId !== undefined;
  };

  const handleManifestSelect = (index: number, loadsheet: Loadsheet) => {
    const newEntries = [...manifestEntries];
    newEntries[index] = { ...newEntries[index], loadsheet };
    setManifestEntries(newEntries);

    const newSearches = [...manifestSearches];
    newSearches[index] = loadsheet.manifestNumber;
    setManifestSearches(newSearches);

    if (index < 2 && newEntries.length <= index + 1) {
      newEntries.push({ loadsheet: null, sealNumber: '', dollyId: undefined });
      setManifestEntries(newEntries);
      newSearches.push('');
      setManifestSearches(newSearches);
    }
  };

  const handleManifestClear = (index: number) => {
    const newEntries = [...manifestEntries];
    newEntries[index] = { loadsheet: null, sealNumber: '', dollyId: undefined };

    for (let i = index + 1; i < newEntries.length; i++) {
      newEntries[i] = { loadsheet: null, sealNumber: '', dollyId: undefined };
    }

    setManifestEntries(newEntries);

    const newSearches = [...manifestSearches];
    newSearches[index] = '';
    for (let i = index + 1; i < newSearches.length; i++) {
      newSearches[i] = '';
    }
    setManifestSearches(newSearches);

    const newDollySearches = [...dollySearches];
    for (let i = index; i < newDollySearches.length; i++) {
      newDollySearches[i] = '';
    }
    setDollySearches(newDollySearches);
  };

  const handleSealNumberChange = (index: number, sealNumber: string) => {
    const newEntries = [...manifestEntries];
    newEntries[index] = { ...newEntries[index], sealNumber };
    setManifestEntries(newEntries);
  };

  const handleDollySelect = (index: number, dolly: EquipmentDolly) => {
    const newEntries = [...manifestEntries];
    newEntries[index] = { ...newEntries[index], dollyId: dolly.id };

    const newDollySearches = [...dollySearches];
    newDollySearches[index] = `${dolly.unitNumber} - ${dolly.dollyType}`;
    setDollySearches(newDollySearches);

    if (index < 2 && newEntries.length <= index + 1) {
      newEntries.push({ loadsheet: null, sealNumber: '', dollyId: undefined });
      setManifestEntries(newEntries);
      setManifestSearches([...manifestSearches, '']);
    } else {
      setManifestEntries(newEntries);
    }
  };

  const handleDollyClear = (index: number) => {
    const newEntries = [...manifestEntries];
    newEntries[index] = { ...newEntries[index], dollyId: undefined };

    for (let i = index + 1; i < newEntries.length; i++) {
      newEntries[i] = { loadsheet: null, sealNumber: '', dollyId: undefined };
    }
    setManifestEntries(newEntries);

    const newDollySearches = [...dollySearches];
    newDollySearches[index] = '';
    for (let i = index + 1; i < newDollySearches.length; i++) {
      newDollySearches[i] = '';
    }
    setDollySearches(newDollySearches);

    const newManifestSearches = [...manifestSearches];
    for (let i = index + 1; i < newManifestSearches.length; i++) {
      newManifestSearches[i] = '';
    }
    setManifestSearches(newManifestSearches);
  };

  const handlePowerUnitSelect = (truck: EquipmentTruck) => {
    setSelectedPowerUnit(truck);
    setPowerUnitSearch(`${truck.unitNumber} - ${truck.truckType}`);
  };

  const handlePowerUnitClear = () => {
    setSelectedPowerUnit(null);
    setPowerUnitSearch('');
  };

  const handleOwnerOperatorChange = (value: boolean) => {
    setIsOwnerOperator(value);
    if (value) {
      setSelectedPowerUnit(null);
      setPowerUnitSearch('');
    }
  };

  const handleDriverSelect = (driver: CarrierDriver) => {
    setSelectedDriver(driver);
    const displayText = driver.number
      ? `${driver.name} (${driver.number})`
      : driver.name;
    setDriverSearch(displayText);
  };

  const handleDriverClear = () => {
    setSelectedDriver(null);
    setDriverSearch('');
  };

  const handleSubmitClick = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate driver is required
    if (!selectedDriver) {
      toast.error('Please select a driver');
      return;
    }

    // Require manifest
    const hasManifestSelected = manifestEntries.some(entry => entry.loadsheet);
    if (!hasManifestSelected) {
      toast.error('Please add at least one manifest');
      return;
    }

    if (!isOwnerOperator && !selectedPowerUnit) {
      toast.error('Please select a power unit');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmAndCreate = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);

    try {
      const selectedLoadsheets = manifestEntries
        .filter(entry => entry.loadsheet)
        .map(entry => entry.loadsheet!);

      const firstLoadsheet = selectedLoadsheets[0];
      const matchingProfile = findProfileByLinehaulName(
        firstLoadsheet.linehaulName,
        firstLoadsheet.originTerminalCode
      );

      if (!matchingProfile) {
        toast.error(`Could not find linehaul profile for "${firstLoadsheet.linehaulName}"`);
        setIsSubmitting(false);
        return;
      }

      const manifestNotes = selectedLoadsheets.map(ls => ls.manifestNumber).join(', ');

      let trailerId: number | undefined = undefined;
      let trailer2Id: number | undefined = undefined;

      if (firstLoadsheet.trailerNumber) {
        const matchingTrailer = trailers.find(
          (t: EquipmentTrailer) => t.unitNumber.toLowerCase() === firstLoadsheet.trailerNumber.toLowerCase()
        );
        if (matchingTrailer) {
          trailerId = matchingTrailer.id;
        }
      }

      if (selectedLoadsheets.length > 1 && selectedLoadsheets[1].trailerNumber) {
        const secondLoadsheet = selectedLoadsheets[1];
        const matchingTrailer2 = trailers.find(
          (t: EquipmentTrailer) => t.unitNumber.toLowerCase() === secondLoadsheet.trailerNumber.toLowerCase()
        );
        if (matchingTrailer2) {
          trailer2Id = matchingTrailer2.id;
        }
      }

      const tripData = {
        linehaulProfileId: matchingProfile.id,
        dispatchDate: new Date().toISOString(),
        driverId: selectedDriver?.id,
        truckId: isOwnerOperator ? undefined : selectedPowerUnit?.id,
        trailerId: trailerId,
        trailer2Id: trailer2Id,
        dollyId: manifestEntries[0]?.dollyId,
        notes: notes + (manifestNotes ? `\nManifests: ${manifestNotes}` : '') + (isOwnerOperator ? '\nOwner Operator' : '')
      };

      const createdTrip = await linehaulTripService.createTrip(tripData);

      await linehaulTripService.updateTripStatus(createdTrip.id, {
        status: 'IN_TRANSIT',
        actualDeparture: new Date().toISOString(),
        notes: `Dispatched with manifests: ${manifestNotes}`
      });

      for (const loadsheet of selectedLoadsheets) {
        await loadsheetService.updateLoadsheet(loadsheet.id, {
          linehaulTripId: createdTrip.id,
          status: 'DISPATCHED'
        });
      }

      toast.success('Trip created and dispatched successfully');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-outbound'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-dispatch'] });

      setDispatchedTripId(createdTrip.id);
      setDispatchedTripNumber(createdTrip.tripNumber);
      setShowDocumentsModal(true);
    } catch (error: any) {
      console.error('Error creating trip:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to create trip';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableDollies = (currentIndex: number, searchTerm: string) => {
    return dollies
      .filter(dolly =>
        !selectedDollyIds.includes(dolly.id) || manifestEntries[currentIndex]?.dollyId === dolly.id
      )
      .filter(dolly =>
        dolly.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dolly.dollyType.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 10);
  };

  const getAvailableLoadsheets = (currentIndex: number, searchTerm: string) => {
    let filtered = loadsheets
      .filter(ls => !selectedLoadsheetIds.includes(ls.id) || manifestEntries[currentIndex]?.loadsheet?.id === ls.id);

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ls =>
        ls.manifestNumber?.toLowerCase().includes(search) ||
        ls.linehaulName?.toLowerCase().includes(search) ||
        ls.trailerNumber?.toLowerCase().includes(search)
      );
    }

    return filtered.slice(0, 15);
  };

  const getAvailableTrucks = (searchTerm: string) => {
    let filtered = trucks;

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = trucks.filter(truck =>
        truck.unitNumber?.toLowerCase().includes(search) ||
        truck.truckType?.toLowerCase().includes(search)
      );
    }

    return filtered.slice(0, 15);
  };

  const getAvailableDrivers = (searchTerm: string) => {
    let filtered = drivers;

    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = drivers.filter(driver =>
        driver.name?.toLowerCase().includes(search) ||
        driver.number?.toLowerCase().includes(search) ||
        driver.externalDriverId?.toLowerCase().includes(search)
      );
    }

    return filtered.slice(0, 15);
  };

  const getManifestLabel = (index: number): string => {
    const ordinals = ['1st', '2nd', '3rd'];
    return `Add ${ordinals[index]} Manifest to Trip`;
  };

  const getSelectedDolly = (dollyId: number | undefined) => {
    return dollies.find(d => d.id === dollyId);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Truck className="h-6 w-6 text-green-500 mr-2" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Dispatch Trip
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create and dispatch a new linehaul trip
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitClick}>
              <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Manifest Entries - Progressive Reveal */}
                {[0, 1, 2].map((index) => {
                  if (!shouldShowManifest(index)) return null;

                  const entry = manifestEntries[index] || { loadsheet: null, sealNumber: '', dollyId: undefined };
                  const searchTerm = manifestSearches[index] || '';
                  const dollySearch = dollySearches[index] || '';

                  return (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {getManifestLabel(index)} {index === 0 && '*'}
                        </h3>
                        {entry.loadsheet && index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleManifestClear(index)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Manifest Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Manifest Number {loadsheetsLoading ? '(loading...)' : `(${loadsheets.length} available)`}
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                              const newSearches = [...manifestSearches];
                              newSearches[index] = e.target.value;
                              setManifestSearches(newSearches);
                              if (entry.loadsheet && e.target.value !== entry.loadsheet.manifestNumber) {
                                handleManifestClear(index);
                              }
                            }}
                            onFocus={() => {
                              const newOpen = [...manifestDropdownOpen];
                              newOpen[index] = true;
                              setManifestDropdownOpen(newOpen);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                const newOpen = [...manifestDropdownOpen];
                                newOpen[index] = false;
                                setManifestDropdownOpen(newOpen);
                              }, 200);
                            }}
                            placeholder="Type to search manifests..."
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          {manifestDropdownOpen[index] && !entry.loadsheet && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                              {loadsheetsLoading ? (
                                <div className="px-4 py-2 text-gray-500">Loading manifests...</div>
                              ) : getAvailableLoadsheets(index, searchTerm).length > 0 ? (
                                getAvailableLoadsheets(index, searchTerm).map((loadsheet) => (
                                  <button
                                    key={loadsheet.id}
                                    type="button"
                                    onClick={() => {
                                      handleManifestSelect(index, loadsheet);
                                      const newOpen = [...manifestDropdownOpen];
                                      newOpen[index] = false;
                                      setManifestDropdownOpen(newOpen);
                                    }}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                                  >
                                    <span className="font-medium">{loadsheet.manifestNumber}</span>
                                    <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">
                                      {loadsheet.linehaulName} - {loadsheet.trailerNumber}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-2 text-gray-500">
                                  {loadsheets.length === 0 ? 'No loadsheets in database' : 'No manifests match your search'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {entry.loadsheet && (
                          <p className="mt-1 text-sm text-green-600">
                            Selected: {entry.loadsheet.manifestNumber} ({entry.loadsheet.linehaulName} - Trailer: {entry.loadsheet.trailerNumber})
                          </p>
                        )}
                      </div>

                      {/* Show Seal Number and Dolly only after manifest is selected */}
                      {entry.loadsheet && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Converter Dolly */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Converter Dolly {dolliesLoading ? '(loading...)' : `(${dollies.length} available)`}
                            </label>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                value={dollySearch}
                                onChange={(e) => {
                                  const newSearches = [...dollySearches];
                                  newSearches[index] = e.target.value;
                                  setDollySearches(newSearches);
                                  if (entry.dollyId) {
                                    const currentDolly = getSelectedDolly(entry.dollyId);
                                    if (currentDolly && e.target.value !== `${currentDolly.unitNumber} - ${currentDolly.dollyType}`) {
                                      handleDollyClear(index);
                                    }
                                  }
                                }}
                                onFocus={() => {
                                  const newOpen = [...dollyDropdownOpen];
                                  newOpen[index] = true;
                                  setDollyDropdownOpen(newOpen);
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    const newOpen = [...dollyDropdownOpen];
                                    newOpen[index] = false;
                                    setDollyDropdownOpen(newOpen);
                                  }, 200);
                                }}
                                placeholder="Type to search dollies..."
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              />
                              {dollyDropdownOpen[index] && !entry.dollyId && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                                  {dolliesLoading ? (
                                    <div className="px-4 py-2 text-gray-500">Loading dollies...</div>
                                  ) : getAvailableDollies(index, dollySearch).length > 0 ? (
                                    getAvailableDollies(index, dollySearch).map((dolly) => (
                                      <button
                                        key={dolly.id}
                                        type="button"
                                        onClick={() => {
                                          handleDollySelect(index, dolly);
                                          const newOpen = [...dollyDropdownOpen];
                                          newOpen[index] = false;
                                          setDollyDropdownOpen(newOpen);
                                        }}
                                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                                      >
                                        <span className="font-medium">{dolly.unitNumber}</span>
                                        <span className="text-gray-500 dark:text-gray-400 ml-2">- {dolly.dollyType}</span>
                                      </button>
                                    ))
                                  ) : (
                                    <div className="px-4 py-2 text-gray-500">
                                      {dollies.length === 0 ? 'No dollies in database' : 'No dollies match your search'}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {entry.dollyId && (
                              <p className="mt-1 text-sm text-green-600">
                                Selected: {getSelectedDolly(entry.dollyId)?.unitNumber}
                              </p>
                            )}
                          </div>

                          {/* Seal Number */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Seal Number
                            </label>
                            <input
                              type="text"
                              value={entry.sealNumber}
                              onChange={(e) => handleSealNumberChange(index, e.target.value)}
                              placeholder="Enter seal number..."
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Origin & Destination */}
                {hasManifest && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Origin
                      </label>
                      <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        {originCode || '-'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Destination
                      </label>
                      <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                        {destCode || '-'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Driver Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Driver {driversLoading ? '(loading...)' : `(${drivers.length} available)`} *
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={driverSearch}
                      onChange={(e) => {
                        setDriverSearch(e.target.value);
                        if (selectedDriver) {
                          const displayText = selectedDriver.number
                            ? `${selectedDriver.name} (${selectedDriver.number})`
                            : selectedDriver.name;
                          if (e.target.value !== displayText) {
                            handleDriverClear();
                          }
                        }
                      }}
                      onFocus={() => setDriverDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setDriverDropdownOpen(false), 200)}
                      placeholder="Search by name or driver number..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {driverDropdownOpen && !selectedDriver && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                        {driversLoading ? (
                          <div className="px-4 py-2 text-gray-500">Loading drivers...</div>
                        ) : getAvailableDrivers(driverSearch).length > 0 ? (
                          getAvailableDrivers(driverSearch).map((driver) => (
                            <button
                              key={driver.id}
                              type="button"
                              onClick={() => {
                                handleDriverSelect(driver);
                                setDriverDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                            >
                              <span className="font-medium">{driver.name}</span>
                              {driver.number && (
                                <span className="text-gray-500 dark:text-gray-400 ml-2">
                                  #{driver.number}
                                </span>
                              )}
                              {driver.currentTerminalCode && (
                                <span className="text-gray-400 dark:text-gray-500 ml-2 text-sm">
                                  @ {driver.currentTerminalCode}
                                </span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-gray-500">
                            {drivers.length === 0 ? 'No drivers in database' : 'No drivers match your search'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {selectedDriver && (
                    <p className="mt-1 text-sm text-green-600">
                      Selected: {selectedDriver.name} {selectedDriver.number && `(#${selectedDriver.number})`}
                    </p>
                  )}
                </div>

                {/* Owner Operator & Power Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Is this an Owner Op?
                    </label>
                    <div className="flex space-x-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="isOwnerOperator"
                          checked={isOwnerOperator === true}
                          onChange={() => handleOwnerOperatorChange(true)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="isOwnerOperator"
                          checked={isOwnerOperator === false}
                          onChange={() => handleOwnerOperatorChange(false)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <span className="ml-2 text-gray-700 dark:text-gray-300">No</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Power Unit {trucksLoading ? '(loading...)' : `(${trucks.length} available)`} *
                    </label>
                    {isOwnerOperator ? (
                      <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                        OWNOP (Owner Operator)
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={powerUnitSearch}
                          onChange={(e) => {
                            setPowerUnitSearch(e.target.value);
                            if (selectedPowerUnit && e.target.value !== `${selectedPowerUnit.unitNumber} - ${selectedPowerUnit.truckType}`) {
                              handlePowerUnitClear();
                            }
                          }}
                          onFocus={() => setPowerUnitDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setPowerUnitDropdownOpen(false), 200)}
                          placeholder="Type to search power units..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        {powerUnitDropdownOpen && !selectedPowerUnit && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {trucksLoading ? (
                              <div className="px-4 py-2 text-gray-500">Loading power units...</div>
                            ) : getAvailableTrucks(powerUnitSearch).length > 0 ? (
                              getAvailableTrucks(powerUnitSearch).map((truck) => (
                                <button
                                  key={truck.id}
                                  type="button"
                                  onClick={() => {
                                    handlePowerUnitSelect(truck);
                                    setPowerUnitDropdownOpen(false);
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                                >
                                  <span className="font-medium">{truck.unitNumber}</span>
                                  <span className="text-gray-500 dark:text-gray-400 ml-2">- {truck.truckType}</span>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-2 text-gray-500">
                                {trucks.length === 0 ? 'No trucks in database' : 'No power units match your search'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {!isOwnerOperator && selectedPowerUnit && (
                      <p className="mt-1 text-sm text-green-600">
                        Selected: {selectedPowerUnit.unitNumber} - {selectedPowerUnit.truckType}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes for this trip..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Trip Creation"
      >
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-700 dark:text-gray-300">
                Please review the trip details before confirming:
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Driver:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {selectedDriver?.name} {selectedDriver?.number && `(#${selectedDriver.number})`}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Power Unit:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {isOwnerOperator ? 'OWNOP' : selectedPowerUnit?.unitNumber || '-'}
                </p>
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Manifests:</span>
              <div className="mt-1 space-y-1">
                {manifestEntries
                  .filter(entry => entry.loadsheet)
                  .map((entry, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="font-medium">{entry.loadsheet!.manifestNumber}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({entry.loadsheet!.linehaulName} - {entry.loadsheet!.trailerNumber})
                      </span>
                      {entry.dollyId && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          - Dolly: {getSelectedDolly(entry.dollyId)?.unitNumber}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Origin:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {originCode || '-'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Destination:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {destCode || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Make Changes
            </button>
            <button
              onClick={handleConfirmAndCreate}
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm & Create Trip
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Trip Documents Modal - shows after successful dispatch */}
      {dispatchedTripId && (
        <TripDocumentsModal
          isOpen={showDocumentsModal}
          onClose={() => {
            setShowDocumentsModal(false);
            onSuccess?.();
            onClose();
          }}
          tripId={dispatchedTripId}
          tripNumber={dispatchedTripNumber}
        />
      )}
    </>
  );
};
