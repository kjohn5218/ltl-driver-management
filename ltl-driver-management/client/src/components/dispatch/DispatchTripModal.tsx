import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, AlertTriangle, CheckCircle, X, Search, Loader2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { linehaulTripService } from '../../services/linehaulTripService';
import { equipmentService } from '../../services/equipmentService';
import { loadsheetService } from '../../services/loadsheetService';
import { driverService } from '../../services/driverService';
import { linehaulProfileService } from '../../services/linehaulProfileService';
import { api } from '../../services/api';
import { Loadsheet, EquipmentTruck, EquipmentTrailer, EquipmentDolly, CarrierDriver, Route, Location, Terminal } from '../../types';
import { TripDocumentsModal } from './TripDocumentsModal';

interface DispatchTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedLocations?: number[];
  locations?: Location[];
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
  onSuccess,
  selectedLocations = [],
  locations = []
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

  // Alternate destination selection
  const [selectedDestination, setSelectedDestination] = useState<Terminal | null>(null);
  const [destinationDropdownOpen, setDestinationDropdownOpen] = useState(false);

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
      setSelectedDestination(null);
      setDestinationDropdownOpen(false);
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
  // Includes: OPEN, LOADING loadsheets + loadsheets from ALL arrived trips (continuing freight)
  const { data: loadsheetsData, isLoading: loadsheetsLoading } = useQuery({
    queryKey: ['loadsheets-for-dispatch', selectedLocations],
    queryFn: async () => {
      // Fetch OPEN and LOADING loadsheets (default)
      const openResponse = await loadsheetService.getLoadsheets({ limit: 100 });
      const allLoadsheets = [...openResponse.loadsheets];

      // Also fetch loadsheets from ALL arrived trips
      // This ensures continuing freight shows up regardless of status or originTerminalCode
      const tripsResponse = await linehaulTripService.getTrips({
        status: 'ARRIVED',
        limit: 100
      });

      // Include loadsheets from arrived trips
      for (const trip of tripsResponse.trips) {
        const tripLoadsheets = (trip.loadsheets || []) as Loadsheet[];
        for (const ls of tripLoadsheets) {
          // Only include loadsheets that can be dispatched (not TERMINATED, CLOSED, or already DISPATCHED)
          if (ls.status !== 'TERMINATED' && ls.status !== 'CLOSED' && ls.status !== 'DISPATCHED') {
            if (!allLoadsheets.some(existing => existing.id === ls.id)) {
              allLoadsheets.push(ls);
            }
          }
        }
      }

      return allLoadsheets;
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
    // PRIORITY 1: Exact name match WITH origin verification (for multi-leg routes)
    // This is critical for routes like DENWAMSLC3 which have multiple profiles (DEN→WAM and WAM→SLC)
    if (originTerminalCode) {
      const upperOrigin = originTerminalCode.toUpperCase();
      profile = profiles.find(p =>
        p.name?.toUpperCase() === linehaulName.toUpperCase() &&
        p.originTerminal?.code?.toUpperCase() === upperOrigin
      );
      if (profile) return profile;
    }

    // PRIORITY 2: Exact name match (only if no origin specified or no origin-matched profile found)
    profile = profiles.find(p => p.name === linehaulName);
    if (profile) return profile;

    // PRIORITY 3: Case-insensitive match with origin verification
    const lowerName = linehaulName.toLowerCase();
    if (originTerminalCode) {
      const upperOrigin = originTerminalCode.toUpperCase();
      profile = profiles.find(p =>
        (p.profileCode?.toLowerCase() === lowerName || p.name?.toLowerCase() === lowerName) &&
        p.originTerminal?.code?.toUpperCase() === upperOrigin
      );
      if (profile) return profile;
    }

    // PRIORITY 4: Case-insensitive match without origin (fallback)
    profile = profiles.find(p =>
      p.profileCode?.toLowerCase() === lowerName ||
      p.name?.toLowerCase() === lowerName
    );
    if (profile) return profile;

    // PRIORITY 5: Smart matching with origin verification
    if (originTerminalCode) {
      const upperLinehaulName = linehaulName.toUpperCase();
      const upperOrigin = originTerminalCode.toUpperCase();
      profile = profiles.find(p => {
        const profileOrigin = p.originTerminal?.code?.toUpperCase();
        const destCode = p.destinationTerminal?.code?.toUpperCase();
        return profileOrigin === upperOrigin && // Must match current origin!
          destCode &&
          upperLinehaulName.includes(destCode);
      });
      if (profile) return profile;
    }

    // PRIORITY 6: Fallback without origin check
    const upperName = linehaulName.toUpperCase();
    profile = profiles.find(p => {
      const originCode = p.originTerminal?.code?.toUpperCase();
      const destCode = p.destinationTerminal?.code?.toUpperCase();
      if (!originCode || !destCode) return false;
      return upperName.startsWith(originCode) && upperName.includes(destCode);
    });
    if (profile) return profile;

    // Final fallback: look up the route by name to get actual origin/destination
    const upperLinehaulName = linehaulName.toUpperCase();
    let route = routes.find(r =>
      r.name?.toUpperCase() === upperLinehaulName &&
      originTerminalCode &&
      r.origin?.toUpperCase() === originTerminalCode.toUpperCase()
    );

    if (!route) {
      route = routes.find(r => r.name?.toUpperCase() === upperLinehaulName);
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

  // Find the next destination for a loadsheet based on its current origin and route
  const findNextDestination = useCallback((linehaulName: string, currentOrigin: string | null): string | null => {
    if (!linehaulName || !currentOrigin) return null;

    const upperOrigin = currentOrigin.toUpperCase();
    const upperLinehaulName = linehaulName.toUpperCase();
    const routeBase = linehaulName.replace(/\d+$/, '').toUpperCase(); // Remove trailing number (e.g., MSPFARBIL1 -> MSPFARBIL)

    // FIRST: Check the routes table for exact match with current origin
    // This is most reliable as it directly maps route name + origin to destination
    const routeWithOrigin = routes.find(r =>
      r.name?.toUpperCase() === upperLinehaulName &&
      r.origin?.toUpperCase() === upperOrigin
    );
    if (routeWithOrigin?.destination) {
      return routeWithOrigin.destination;
    }

    // Extract final destination from route name (e.g., FARBISBIL -> BIL)
    const finalDestFromName = routeBase.length >= 3 ? routeBase.slice(-3) : null;

    // SECOND: Try to find a profile from the same route family with matching origin
    // This handles cases like MSPFARBIL2 for loadsheet with MSPFARBIL1 linehaulName
    // Only use if the destination is in the route name (prevents wrong intermediate stops)
    if (profiles.length > 0) {
      const sameRouteProfile = profiles.find(p => {
        const profileOrigin = p.originTerminal?.code?.toUpperCase();
        const profileName = (p.name || '').toUpperCase().replace(/\d+$/, ''); // Remove trailing number
        const profileDest = p.destinationTerminal?.code?.toUpperCase();
        // Must match origin, route family, AND destination must be in route name or be final dest
        return profileOrigin === upperOrigin &&
               profileName === routeBase &&
               profileDest &&
               profileDest !== upperOrigin && // Don't return same as origin
               (routeBase.includes(profileDest) || profileDest === finalDestFromName);
      });

      if (sameRouteProfile?.destinationTerminal?.code) {
        return sameRouteProfile.destinationTerminal.code;
      }

      // THIRD: Try to find a profile where origin matches and profile name starts with route base
      const similarRouteProfile = profiles.find(p => {
        const profileOrigin = p.originTerminal?.code?.toUpperCase();
        const profileName = (p.name || '').toUpperCase();
        const profileDest = p.destinationTerminal?.code?.toUpperCase();
        // Must match origin, similar route name, AND destination must be in route name or be final dest
        return profileOrigin === upperOrigin &&
               profileName.startsWith(routeBase) &&
               profileDest &&
               profileDest !== upperOrigin && // Don't return same as origin
               (routeBase.includes(profileDest) || profileDest === finalDestFromName);
      });

      if (similarRouteProfile?.destinationTerminal?.code) {
        return similarRouteProfile.destinationTerminal.code;
      }

      // FOURTH: Find any profile with matching origin where destination is in the route name
      const originIndex = upperLinehaulName.indexOf(upperOrigin);
      if (originIndex >= 0) {
        const afterOrigin = upperLinehaulName.substring(originIndex + upperOrigin.length);

        const profileWithDestInRoute = profiles.find(p => {
          const profileOrigin = p.originTerminal?.code?.toUpperCase();
          const destCode = p.destinationTerminal?.code?.toUpperCase();
          return profileOrigin === upperOrigin &&
                 destCode &&
                 destCode !== upperOrigin && // Don't return same as origin
                 afterOrigin.includes(destCode);
        });

        if (profileWithDestInRoute?.destinationTerminal?.code) {
          return profileWithDestInRoute.destinationTerminal.code;
        }
      }
    }

    // FIFTH: Fallback - look up any route with this name to find final destination
    // Try to find a route where the destination matches the final terminal in the route name
    const matchingRoutes = routes.filter(r => r.name?.toUpperCase() === upperLinehaulName);
    if (matchingRoutes.length > 0) {
      // Extract the last 3-character terminal code from the route base (e.g., FARBISBIL -> BIL)
      const finalTerminalFromName = routeBase.slice(-3);

      // First, try to find a route where destination matches the final terminal in the name
      const routeToFinalDest = matchingRoutes.find(r =>
        r.destination?.toUpperCase() === finalTerminalFromName
      );
      if (routeToFinalDest?.destination) {
        return routeToFinalDest.destination;
      }

      // Otherwise, return the first route's destination as last resort
      if (matchingRoutes[0]?.destination) {
        return matchingRoutes[0].destination;
      }
    }

    // SIXTH: Last resort - extract final destination directly from route name
    // Route names like FARBISBIL1 have the final destination as the last 3 chars before the number
    if (routeBase.length >= 3) {
      const extractedDest = routeBase.slice(-3);
      // Validate it's not the same as origin (would indicate we're already at final destination)
      if (extractedDest !== upperOrigin) {
        return extractedDest;
      }
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

    // If no destination set, try to find it
    if (!parsedDest) {
      // FIRST: Try direct route lookup - most reliable for continuing loads
      // This checks routes table for exact match of route name + current origin
      parsedDest = findNextDestination(
        lastLoadsheet.linehaulName,
        lastLoadsheet.originTerminalCode ?? null
      );

      // SECOND: Fall back to profile lookup if route lookup failed
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
    }

    return {
      originCode: parsedOrigin,
      destCode: parsedDest,
      hasManifest: true
    };
  }, [manifestEntries, profiles, findProfileByLinehaulName, findNextDestination]);

  // Get the matched linehaul profile for the first selected loadsheet
  const matchedProfile = useMemo(() => {
    const selectedLoadsheets = manifestEntries
      .filter(entry => entry.loadsheet)
      .map(entry => entry.loadsheet!);

    if (selectedLoadsheets.length === 0 || profiles.length === 0) {
      return null;
    }

    const firstLoadsheet = selectedLoadsheets[0];
    return findProfileByLinehaulName(
      firstLoadsheet.linehaulName,
      firstLoadsheet.originTerminalCode
    );
  }, [manifestEntries, profiles, findProfileByLinehaulName]);

  // Fetch okay-to-dispatch terminals for the matched profile
  // Only fetch if we have a valid profile ID (not 0 from fallback routes)
  const { data: okayToDispatchData } = useQuery({
    queryKey: ['okay-to-dispatch', matchedProfile?.id],
    queryFn: async () => {
      if (!matchedProfile?.id || matchedProfile.id <= 0) return null;
      try {
        return await linehaulProfileService.getOkayToDispatchTerminals(matchedProfile.id);
      } catch (error) {
        console.warn('Failed to fetch okay-to-dispatch terminals:', error);
        return null;
      }
    },
    enabled: !!matchedProfile?.id && matchedProfile.id > 0 && isOpen,
    retry: false,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Get available destination options (default destination + okay-to-dispatch terminals)
  const destinationOptions = useMemo(() => {
    const options: Terminal[] = [];

    // Add the profile's default destination first
    if (matchedProfile?.destinationTerminal) {
      // Ensure we have at least code and id for comparison
      const destTerminal = matchedProfile.destinationTerminal as Terminal;
      if (destTerminal.code) {
        options.push(destTerminal);
      }
    }

    // Add okay-to-dispatch terminals (excluding the default destination)
    if (okayToDispatchData?.okayToDispatchTerminals) {
      for (const terminal of okayToDispatchData.okayToDispatchTerminals) {
        // Don't add duplicates - compare by id if available, otherwise by code
        const isDuplicate = options.some(opt =>
          (opt.id && terminal.id && opt.id === terminal.id) ||
          (opt.code && terminal.code && opt.code.toUpperCase() === terminal.code.toUpperCase())
        );
        if (!isDuplicate && terminal.code) {
          options.push(terminal);
        }
      }
    }

    return options;
  }, [matchedProfile, okayToDispatchData]);

  // Effective destination (selected or default)
  const effectiveDestination = useMemo(() => {
    if (selectedDestination) {
      return selectedDestination;
    }
    if (matchedProfile?.destinationTerminal) {
      return matchedProfile.destinationTerminal;
    }
    return null;
  }, [selectedDestination, matchedProfile]);

  // Haversine formula to calculate distance between two GPS coordinates
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Calculate mileage and ETA based on origin and effective destination
  const { calculatedMiles, calculatedETA, transitMinutes } = useMemo(() => {
    const originTerminal = matchedProfile?.originTerminal;
    const destTerminal = effectiveDestination;

    // Check if we're using an alternate destination
    const isAlternateDestination = selectedDestination &&
      selectedDestination.code?.toUpperCase() !== matchedProfile?.destinationTerminal?.code?.toUpperCase();

    // If using default destination, use profile's stored values
    if (!isAlternateDestination && matchedProfile) {
      const profileMiles = matchedProfile.distanceMiles;
      const profileTransitMinutes = matchedProfile.transitTimeMinutes;

      if (profileMiles || profileTransitMinutes) {
        // Calculate ETA from now + transit time
        let eta: Date | null = null;
        if (profileTransitMinutes) {
          eta = new Date();
          eta.setMinutes(eta.getMinutes() + profileTransitMinutes);
        }
        return {
          calculatedMiles: profileMiles || null,
          calculatedETA: eta,
          transitMinutes: profileTransitMinutes || null
        };
      }
    }

    // Calculate distance using GPS coordinates
    if (originTerminal?.latitude && originTerminal?.longitude &&
        destTerminal?.latitude && destTerminal?.longitude) {
      const straightLineDistance = calculateDistance(
        originTerminal.latitude,
        originTerminal.longitude,
        destTerminal.latitude,
        destTerminal.longitude
      );

      // Apply a road distance factor (typically 1.2-1.4x straight line distance)
      const roadDistanceFactor = 1.3;
      const miles = Math.round(straightLineDistance * roadDistanceFactor);

      // Calculate transit time assuming average speed of 45 mph (accounting for stops, traffic, etc.)
      const averageSpeedMph = 45;
      const transitMins = Math.round((miles / averageSpeedMph) * 60);

      // Calculate ETA from now
      const eta = new Date();
      eta.setMinutes(eta.getMinutes() + transitMins);

      return {
        calculatedMiles: miles,
        calculatedETA: eta,
        transitMinutes: transitMins
      };
    }

    return { calculatedMiles: null, calculatedETA: null, transitMinutes: null };
  }, [matchedProfile, effectiveDestination, selectedDestination, calculateDistance]);

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

    // Reset destination selection when first manifest changes (profile may change)
    if (index === 0) {
      setSelectedDestination(null);
    }

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

    // Reset destination selection when first manifest is cleared (profile changes)
    if (index === 0) {
      setSelectedDestination(null);
    }

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

    // Validate multi-trailer dispatch: check if trailers are arrived at intermediate locations
    const selectedLoadsheets = manifestEntries
      .filter(entry => entry.loadsheet)
      .map(entry => entry.loadsheet!);

    if (selectedLoadsheets.length > 1) {
      const firstOrigin = selectedLoadsheets[0].originTerminalCode?.toUpperCase();

      for (let i = 1; i < selectedLoadsheets.length; i++) {
        const loadsheet = selectedLoadsheets[i];
        const manifestOrigin = loadsheet.originTerminalCode?.toUpperCase();

        // Check if this manifest originates from a different (intermediate) location
        if (manifestOrigin && manifestOrigin !== firstOrigin) {
          // Find the trailer for this manifest
          const trailer = trailers.find(
            (t: EquipmentTrailer) => t.unitNumber.toLowerCase() === loadsheet.trailerNumber?.toLowerCase()
          );

          if (trailer) {
            // Check if the trailer's effective location matches the manifest's origin
            const trailerLocationCode = trailer.effectiveTerminal?.code?.toUpperCase() ||
              trailer.currentTerminal?.code?.toUpperCase() ||
              trailer.lastArrivalTerminal?.code?.toUpperCase();

            if (!trailerLocationCode || trailerLocationCode !== manifestOrigin) {
              toast.error(
                `${loadsheet.manifestNumber} cannot be dispatched with ${selectedLoadsheets[0].manifestNumber} from ${firstOrigin} until it is arrived at ${manifestOrigin}`,
                { duration: 6000 }
              );
              return;
            }
          }
        }
      }
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

      // Determine if an alternate destination was selected (compare by code, not id)
      const isAlternateDestination = selectedDestination &&
        selectedDestination.code?.toUpperCase() !== matchingProfile.destinationTerminal?.code?.toUpperCase();
      const destinationCode = isAlternateDestination ? selectedDestination.code : undefined;

      // Calculate planned arrival based on mileage/transit time
      const plannedArrivalTime = calculatedETA ? calculatedETA.toISOString() : undefined;

      const tripData = {
        linehaulProfileId: matchingProfile.id,
        dispatchDate: new Date().toISOString(),
        driverId: selectedDriver?.id,
        truckId: isOwnerOperator ? undefined : selectedPowerUnit?.id,
        trailerId: trailerId,
        trailer2Id: trailer2Id,
        dollyId: manifestEntries[0]?.dollyId,
        destinationTerminalCode: destinationCode, // Override destination if alternate selected
        plannedArrival: plannedArrivalTime, // Calculated ETA based on mileage
        calculatedMiles: calculatedMiles, // Distance in miles
        notes: notes + (manifestNotes ? `\nManifests: ${manifestNotes}` : '') + (isOwnerOperator ? '\nOwner Operator' : '') + (isAlternateDestination ? `\nAlternate Destination: ${destinationCode}` : '') + (calculatedMiles ? `\nDistance: ${calculatedMiles} miles` : '')
      };

      const createdTrip = await linehaulTripService.createTrip(tripData);

      await linehaulTripService.updateTripStatus(createdTrip.id, {
        status: 'IN_TRANSIT',
        actualDeparture: new Date().toISOString()
        // Notes are already set during trip creation - don't overwrite
      });

      // Link loadsheets to the trip
      console.log(`[Dispatch] Linking ${selectedLoadsheets.length} loadsheets to trip ${createdTrip.id}`);
      for (const loadsheet of selectedLoadsheets) {
        if (!loadsheet.id) {
          console.error('[Dispatch] Loadsheet missing ID:', loadsheet);
          continue;
        }
        try {
          console.log(`[Dispatch] Updating loadsheet ${loadsheet.id} (${loadsheet.manifestNumber}) with linehaulTripId=${createdTrip.id}`);
          await loadsheetService.updateLoadsheet(loadsheet.id, {
            linehaulTripId: createdTrip.id,
            status: 'DISPATCHED',
            // Update loadsheet destination if alternate destination was selected
            ...(isAlternateDestination && { destinationTerminalCode: destinationCode })
          });
          console.log(`[Dispatch] Successfully updated loadsheet ${loadsheet.id}`);
        } catch (loadsheetError: any) {
          console.error(`[Dispatch] Failed to update loadsheet ${loadsheet.id}:`, loadsheetError);
          toast.error(`Failed to link manifest ${loadsheet.manifestNumber} to trip`);
        }
      }

      toast.success('Trip created and dispatched successfully');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['inbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-outbound'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-dispatch'] });
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-loads-tab'] });
      queryClient.invalidateQueries({ queryKey: ['continuing-trips-for-loads-tab'] });

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

    // Filter by selected locations if any are selected
    if (selectedLocations.length > 0) {
      // Get selected location codes for matching
      const selectedCodes = selectedLocations
        .map(id => locations.find(l => l.id === id)?.code?.toUpperCase())
        .filter(Boolean) as string[];

      filtered = filtered.filter(ls => {
        // Check if loadsheet's origin matches any selected location
        if (ls.originTerminalId && selectedLocations.includes(ls.originTerminalId)) {
          return true;
        }
        // Also check by origin terminal code
        if (ls.originTerminalCode && selectedCodes.includes(ls.originTerminalCode.toUpperCase())) {
          return true;
        }
        return false;
      });
    }

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

          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl">
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
                          {/* Converter Dolly - Only available for 1st and 2nd manifest */}
                          <div>
                            <label className={`block text-sm font-medium mb-1 ${index === 2 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                              Converter Dolly {index === 2 ? '(N/A for 3rd manifest)' : dolliesLoading ? '(loading...)' : `(${dollies.length} available)`}
                            </label>
                            {index === 2 ? (
                              /* Disabled state for 3rd manifest */
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-300 dark:text-gray-600" />
                                <input
                                  type="text"
                                  disabled
                                  placeholder="Not available for 3rd manifest"
                                  className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                                />
                              </div>
                            ) : (
                              /* Enabled state for 1st and 2nd manifest */
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
                            )}
                            {entry.dollyId && index !== 2 && (
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
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          {destinationOptions.length > 1 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({destinationOptions.length} options)
                            </span>
                          )}
                        </label>
                      {destinationOptions.length > 1 ? (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setDestinationDropdownOpen(!destinationDropdownOpen)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-left flex items-center justify-between"
                          >
                            <span>
                              {effectiveDestination?.code || destCode || '-'}
                              {effectiveDestination?.name && (
                                <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">
                                  - {effectiveDestination.name}
                                </span>
                              )}
                              {selectedDestination && selectedDestination.code?.toUpperCase() !== matchedProfile?.destinationTerminal?.code?.toUpperCase() && (
                                <span className="text-amber-600 dark:text-amber-400 ml-2 text-xs font-medium">
                                  (Alternate)
                                </span>
                              )}
                            </span>
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${destinationDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {destinationDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                              {destinationOptions.map((terminal, index) => {
                                const isDefault = terminal.code?.toUpperCase() === matchedProfile?.destinationTerminal?.code?.toUpperCase();
                                const isSelected = effectiveDestination?.code?.toUpperCase() === terminal.code?.toUpperCase();
                                return (
                                  <button
                                    key={terminal.id || terminal.code || index}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDestination(isDefault ? null : terminal);
                                      setDestinationDropdownOpen(false);
                                    }}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : ''}`}
                                  >
                                    <span className="font-medium">{terminal.code}</span>
                                    {terminal.name && (
                                      <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">
                                        - {terminal.name}
                                      </span>
                                    )}
                                    {isDefault && (
                                      <span className="text-green-600 dark:text-green-400 ml-2 text-xs">
                                        (Default)
                                      </span>
                                    )}
                                    {isSelected && (
                                      <CheckCircle className="h-4 w-4 text-primary-500 inline ml-2" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                          {effectiveDestination?.code || destCode || '-'}
                          {effectiveDestination?.name && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2 text-sm">
                              - {effectiveDestination.name}
                            </span>
                          )}
                        </div>
                      )}
                      </div>
                    </div>

                    {/* Mileage and ETA Display */}
                    {(calculatedMiles || calculatedETA) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Distance
                          </label>
                          <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                            {calculatedMiles ? `${calculatedMiles.toLocaleString()} miles` : '-'}
                            {selectedDestination && selectedDestination.code?.toUpperCase() !== matchedProfile?.destinationTerminal?.code?.toUpperCase() && (
                              <span className="text-amber-600 dark:text-amber-400 ml-2 text-xs font-medium">
                                (Calculated)
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Planned ETA
                          </label>
                          <div className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                            {calculatedETA ? (
                              <>
                                {calculatedETA.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                {' '}
                                {calculatedETA.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                {transitMinutes && (
                                  <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                                    ({Math.floor(transitMinutes / 60)}h {transitMinutes % 60}m)
                                  </span>
                                )}
                              </>
                            ) : '-'}
                            {selectedDestination && selectedDestination.code?.toUpperCase() !== matchedProfile?.destinationTerminal?.code?.toUpperCase() && (
                              <span className="text-amber-600 dark:text-amber-400 ml-2 text-xs font-medium">
                                (Calculated)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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
                          <div className="absolute z-10 w-[calc(100%-2rem)] mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
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
                  {effectiveDestination?.code || destCode || '-'}
                  {selectedDestination && selectedDestination.code?.toUpperCase() !== matchedProfile?.destinationTerminal?.code?.toUpperCase() && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2 text-xs font-medium">
                      (Alternate)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Mileage and ETA in confirmation */}
            {(calculatedMiles || calculatedETA) && (
              <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Distance:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {calculatedMiles ? `${calculatedMiles.toLocaleString()} miles` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Planned ETA:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {calculatedETA ? (
                      <>
                        {calculatedETA.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' '}
                        {calculatedETA.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </>
                    ) : '-'}
                  </p>
                </div>
              </div>
            )}
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
