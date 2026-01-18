import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { DateRangePicker } from '../components/common/DateRangePicker';
import { TripStatusBadge } from '../components/dispatch/TripStatusBadge';
import { TripForm } from '../components/dispatch/TripForm';
import { linehaulTripService } from '../services/linehaulTripService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { equipmentService } from '../services/equipmentService';
import { driverService } from '../services/driverService';
import { locationService } from '../services/locationService';
import { loadsheetService } from '../services/loadsheetService';
import { carrierService } from '../services/carrierService';
import { DriversTab } from '../components/dispatch/DriversTab';
import {
  LinehaulTrip,
  LinehaulProfile,
  CarrierDriver,
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  TripStatus,
  Location,
  Loadsheet,
  Carrier
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Edit,
  Trash2,
  Truck,
  User,
  ArrowRight,
  Play,
  CheckCircle,
  XCircle,
  Filter,
  Users,
  MapPin,
  FileText,
  Send,
  Clock
} from 'lucide-react';

type DispatchTab = 'planning' | 'drivers';

// Loadsheet status filter options for the planning table
const planningStatusFilterOptions: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'LOADING', label: 'Loading' },
  { value: 'CLOSED', label: 'Closed' }
];

// Planning data for a loadsheet
interface PlanningData {
  plannedDriverId?: number;
  plannedCarrierId?: number;
  plannedTractorId?: number;
}

export const Dispatch: React.FC = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<LinehaulTrip[]>([]);
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [trucks, setTrucks] = useState<EquipmentTruck[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [dollies, setDollies] = useState<EquipmentDolly[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [driversLoading, setDriversLoading] = useState(true);

  // Planning state
  const [planningLoadsheets, setPlanningLoadsheets] = useState<Loadsheet[]>([]);
  const [continuingTrips, setContinuingTrips] = useState<LinehaulTrip[]>([]);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [planningData, setPlanningData] = useState<Record<number, PlanningData>>({});
  const [continuingTripData, setContinuingTripData] = useState<Record<number, PlanningData>>({});
  const [dispatchingLoadsheetId, setDispatchingLoadsheetId] = useState<number | null>(null);
  const [dispatchingTripId, setDispatchingTripId] = useState<number | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<DispatchTab>('planning');

  // Filters
  const [planningSearchTerm, setPlanningSearchTerm] = useState('');
  const [planningStatusFilter, setPlanningStatusFilter] = useState<string>('');
  const [profileFilter, setProfileFilter] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState<number[]>([]);
  const [locationTypeFilter, setLocationTypeFilter] = useState<'all' | 'physical' | 'virtual'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter locations by type
  const filteredLocations = locations.filter(loc => {
    if (locationTypeFilter === 'physical') return loc.isPhysicalTerminal;
    if (locationTypeFilter === 'virtual') return loc.isVirtualTerminal;
    return true; // 'all' shows everything
  });

  // Filter planning loadsheets by search term and status
  const filteredPlanningLoadsheets = planningLoadsheets.filter(ls => {
    // Filter by status
    if (planningStatusFilter && ls.status !== planningStatusFilter) {
      return false;
    }
    // Filter by search term (search manifest number, linehaul name, trailer number, terminal code)
    if (planningSearchTerm) {
      const searchLower = planningSearchTerm.toLowerCase();
      const matchesManifest = ls.manifestNumber?.toLowerCase().includes(searchLower);
      const matchesLinehaul = ls.linehaulName?.toLowerCase().includes(searchLower);
      const matchesTrailer = ls.trailerNumber?.toLowerCase().includes(searchLower);
      const matchesOrigin = ls.originTerminalCode?.toLowerCase().includes(searchLower);
      return matchesManifest || matchesLinehaul || matchesTrailer || matchesOrigin;
    }
    return true;
  });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<LinehaulTrip | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchProfiles();
    fetchDrivers();
    fetchEquipment();
    fetchLocations();
    fetchCarriers();
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [currentPage, profileFilter, startDate, endDate, selectedOrigins]);

  // Fetch planning loadsheets and continuing trips on load and when origin/date filter changes
  useEffect(() => {
    if (activeTab === 'planning') {
      fetchPlanningLoadsheets();
      fetchContinuingTrips();
    }
  }, [selectedOrigins, activeTab, startDate, endDate]);

  const fetchProfiles = async () => {
    try {
      const data = await linehaulProfileService.getProfilesList();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      setDriversLoading(true);
      const response = await driverService.getDrivers({ limit: 1000 });
      setDrivers(response.drivers);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    } finally {
      setDriversLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await locationService.getLocationsList();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchCarriers = async () => {
    try {
      const response = await carrierService.getCarriers({ status: 'ACTIVE', limit: 500 });
      setCarriers(response.carriers);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
    }
  };

  const fetchPlanningLoadsheets = async () => {
    try {
      setPlanningLoading(true);
      // Fetch loadsheets with optional date filter (max 100 per API limit)
      const response = await loadsheetService.getLoadsheets({
        limit: 100,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      // Filter to exclude DISPATCHED status
      let nonDispatched = response.loadsheets.filter(
        ls => ls.status !== 'DISPATCHED'
      );
      // If specific origins selected, filter by those (check both ID and code)
      if (selectedOrigins.length > 0) {
        const selectedCodes = selectedOrigins.map(id =>
          locations.find(l => l.id === id)?.code
        ).filter(Boolean);

        nonDispatched = nonDispatched.filter(ls => {
          // Match by ID if available
          if (ls.originTerminalId && selectedOrigins.includes(ls.originTerminalId)) {
            return true;
          }
          // Match by code as fallback
          if (ls.originTerminalCode && selectedCodes.includes(ls.originTerminalCode)) {
            return true;
          }
          return false;
        });
      }
      setPlanningLoadsheets(nonDispatched);
    } catch (error) {
      console.error('Failed to fetch planning loadsheets:', error);
    } finally {
      setPlanningLoading(false);
    }
  };

  // Fetch trips that have ARRIVED at selected locations and will continue to another destination
  const fetchContinuingTrips = async () => {
    try {
      // Get trips with ARRIVED status
      const response = await linehaulTripService.getTrips({
        status: 'ARRIVED',
        limit: 100
      });

      let arrivedTrips = response.trips;

      // Filter to trips that arrived at one of the selected origins
      // These trips came from another location and will continue on
      if (selectedOrigins.length > 0) {
        arrivedTrips = arrivedTrips.filter(trip => {
          // Check if the trip's destination (where it arrived) is one of the selected origins
          const destinationId = trip.linehaulProfile?.destinationTerminalId;
          return destinationId && selectedOrigins.includes(destinationId);
        });
      }

      setContinuingTrips(arrivedTrips);
    } catch (error) {
      console.error('Failed to fetch continuing trips:', error);
    }
  };

  const fetchEquipment = async () => {
    try {
      const [trucksRes, trailersRes, dolliesRes] = await Promise.all([
        equipmentService.getTrucks({ limit: 500 }),
        equipmentService.getTrailers({ limit: 500 }),
        equipmentService.getDollies({ limit: 500 })
      ]);
      setTrucks(trucksRes.trucks || []);
      setTrailers(trailersRes.trailers || []);
      setDollies(dolliesRes.dollies || []);
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      // If multiple origins selected, pass the first one to API and filter the rest client-side
      // Or if single origin, pass it directly
      const originId = selectedOrigins.length === 1 ? selectedOrigins[0] : undefined;

      const response = await linehaulTripService.getTrips({
        profileId: profileFilter || undefined,
        originTerminalId: originId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        limit: 20
      });

      let filteredTrips = response.trips;
      // If multiple origins selected, filter client-side
      if (selectedOrigins.length > 1) {
        filteredTrips = response.trips.filter(trip =>
          trip.linehaulProfile?.originTerminalId &&
          selectedOrigins.includes(trip.linehaulProfile.originTerminalId)
        );
      }

      setTrips(filteredTrips);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch trips');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Partial<LinehaulTrip>) => {
    try {
      await linehaulTripService.createTrip(data);
      toast.success('Trip created successfully');
      setIsCreateModalOpen(false);
      fetchTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create trip');
    }
  };

  const handleUpdate = async (data: Partial<LinehaulTrip>) => {
    if (!selectedTrip) return;
    try {
      await linehaulTripService.updateTrip(selectedTrip.id, data);
      toast.success('Trip updated successfully');
      setIsEditModalOpen(false);
      fetchTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update trip');
    }
  };

  const handleDelete = async () => {
    if (!selectedTrip) return;
    try {
      await linehaulTripService.deleteTrip(selectedTrip.id);
      toast.success('Trip deleted successfully');
      setIsDeleteModalOpen(false);
      fetchTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete trip');
    }
  };

  const handleStatusAction = async (trip: LinehaulTrip, action: 'dispatch' | 'start' | 'complete' | 'cancel') => {
    try {
      switch (action) {
        case 'dispatch':
          await linehaulTripService.dispatchTrip(trip.id);
          toast.success('Trip dispatched');
          break;
        case 'start':
          await linehaulTripService.startTrip(trip.id);
          toast.success('Trip started');
          break;
        case 'complete':
          await linehaulTripService.completeTrip(trip.id);
          toast.success('Trip completed');
          break;
        case 'cancel':
          await linehaulTripService.cancelTrip(trip.id, 'Cancelled by dispatcher');
          toast.success('Trip cancelled');
          break;
      }
      fetchTrips();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${action} trip`);
    }
  };

  // Update planning data for a loadsheet
  const updatePlanningData = (loadsheetId: number, field: keyof PlanningData, value: number | undefined) => {
    setPlanningData(prev => ({
      ...prev,
      [loadsheetId]: {
        ...prev[loadsheetId],
        [field]: value
      }
    }));
  };

  // Dispatch from planning - creates a trip from the loadsheet planning data
  const handleDispatchFromPlanning = async (loadsheet: Loadsheet) => {
    const data = planningData[loadsheet.id];

    if (!data?.plannedDriverId) {
      toast.error('Please select a driver before dispatching');
      return;
    }

    setDispatchingLoadsheetId(loadsheet.id);
    try {
      // Find the profile that matches this linehaul name
      const matchingProfile = profiles.find(p =>
        p.name === loadsheet.linehaulName || p.profileCode === loadsheet.linehaulName
      );

      // Create the trip with the planned data (tractor will be assigned later)
      const tripData: Partial<LinehaulTrip> = {
        driverId: data.plannedDriverId,
        linehaulProfileId: matchingProfile?.id,
        dispatchDate: new Date().toISOString().split('T')[0],
        status: 'DISPATCHED' as TripStatus,
        notes: `Created from loadsheet ${loadsheet.manifestNumber}`
      };

      await linehaulTripService.createTrip(tripData);

      // Update loadsheet status to DISPATCHED
      await loadsheetService.updateLoadsheet(loadsheet.id, { status: 'DISPATCHED' });

      toast.success(`Trip created and dispatched for ${loadsheet.manifestNumber}`);

      // Refresh data
      fetchTrips();
      fetchPlanningLoadsheets();

      // Clear planning data for this loadsheet
      setPlanningData(prev => {
        const newData = { ...prev };
        delete newData[loadsheet.id];
        return newData;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to dispatch from planning');
    } finally {
      setDispatchingLoadsheetId(null);
    }
  };

  // Update planning data for continuing trips
  const updateContinuingTripData = (tripId: number, field: keyof PlanningData, value: number | undefined) => {
    setContinuingTripData(prev => ({
      ...prev,
      [tripId]: {
        ...prev[tripId],
        [field]: value
      }
    }));
  };

  // Dispatch a continuing trip - creates new trip leg from arrived trip
  const handleDispatchContinuingTrip = async (arrivedTrip: LinehaulTrip) => {
    const data = continuingTripData[arrivedTrip.id];

    if (!data?.plannedDriverId) {
      toast.error('Please select a driver before dispatching');
      return;
    }

    setDispatchingTripId(arrivedTrip.id);
    try {
      // Create a new trip for the continuing leg (tractor will be assigned later)
      const tripData: Partial<LinehaulTrip> = {
        driverId: data.plannedDriverId,
        linehaulProfileId: arrivedTrip.linehaulProfileId,
        dispatchDate: new Date().toISOString().split('T')[0],
        status: 'DISPATCHED' as TripStatus,
        notes: `Continuing from trip ${arrivedTrip.tripNumber}`
      };

      await linehaulTripService.createTrip(tripData);

      // Mark original trip as completed since it has continued
      await linehaulTripService.completeTrip(arrivedTrip.id);

      toast.success(`Continuing trip dispatched from ${arrivedTrip.tripNumber}`);

      // Refresh data
      fetchTrips();
      fetchContinuingTrips();

      // Clear planning data for this trip
      setContinuingTripData(prev => {
        const newData = { ...prev };
        delete newData[arrivedTrip.id];
        return newData;
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to dispatch continuing trip');
    } finally {
      setDispatchingTripId(null);
    }
  };

  // Handle multi-select origin filter
  const handleOriginSelect = (locationId: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Toggle selection with Ctrl/Cmd
      setSelectedOrigins(prev =>
        prev.includes(locationId)
          ? prev.filter(id => id !== locationId)
          : [...prev, locationId]
      );
    } else {
      // Single select without Ctrl/Cmd
      setSelectedOrigins(prev =>
        prev.includes(locationId) && prev.length === 1
          ? [] // Deselect if clicking the only selected item
          : [locationId]
      );
    }
    setCurrentPage(1);
  };

  // Get status badge color for loadsheet
  const getLoadsheetStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'OPEN': return 'bg-blue-100 text-blue-800';
      case 'LOADING': return 'bg-yellow-100 text-yellow-800';
      case 'CLOSED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    {
      header: 'Trip #',
      accessor: 'tripNumber' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => (
        <button
          onClick={() => {
            setSelectedTrip(trip);
            setIsDetailsModalOpen(true);
          }}
          className="font-medium text-indigo-600 hover:text-indigo-900"
        >
          {trip.tripNumber}
        </button>
      )
    },
    {
      header: 'Date',
      accessor: 'dispatchDate' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => (
        <span className="text-gray-600">
          {new Date(trip.dispatchDate).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Route',
      accessor: 'linehaulProfile' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => (
        <div className="flex items-center text-gray-600">
          <span className="font-medium">{trip.linehaulProfile?.profileCode}</span>
          <ArrowRight className="w-3 h-3 mx-1" />
          <span className="text-sm">
            {trip.linehaulProfile?.originTerminal?.code} - {trip.linehaulProfile?.destinationTerminal?.code}
          </span>
        </div>
      )
    },
    {
      header: 'Driver',
      accessor: 'driver' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => (
        <div className="flex items-center">
          <User className="w-4 h-4 mr-1 text-gray-400" />
          <span>{trip.driver?.name || '-'}</span>
          {trip.teamDriver && (
            <span className="ml-1 text-xs text-gray-500">(+ {trip.teamDriver.name})</span>
          )}
        </div>
      )
    },
    {
      header: 'Equipment',
      accessor: 'truck' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => (
        <div className="flex items-center">
          <Truck className="w-4 h-4 mr-1 text-gray-400" />
          <span>{trip.truck?.unitNumber || '-'}</span>
          {trip.trailer && (
            <span className="ml-1 text-xs text-gray-500">/ {trip.trailer.unitNumber}</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status' as keyof LinehaulTrip,
      cell: (trip: LinehaulTrip) => <TripStatusBadge status={trip.status} />
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof LinehaulTrip,
            cell: (trip: LinehaulTrip) => (
              <div className="flex space-x-1">
                {trip.status === 'ASSIGNED' && (
                  <button
                    onClick={() => handleStatusAction(trip, 'dispatch')}
                    className="text-green-600 hover:text-green-900 p-1"
                    title="Dispatch"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                {trip.status === 'DISPATCHED' && (
                  <button
                    onClick={() => handleStatusAction(trip, 'start')}
                    className="text-blue-600 hover:text-blue-900 p-1"
                    title="Start Trip"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                {(trip.status === 'IN_TRANSIT' || trip.status === 'ARRIVED') && (
                  <button
                    onClick={() => handleStatusAction(trip, 'complete')}
                    className="text-green-600 hover:text-green-900 p-1"
                    title="Complete"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {!['COMPLETED', 'CANCELLED'].includes(trip.status) && (
                  <button
                    onClick={() => handleStatusAction(trip, 'cancel')}
                    className="text-red-600 hover:text-red-900 p-1"
                    title="Cancel"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedTrip(trip);
                    setIsEditModalOpen(true);
                  }}
                  className="text-indigo-600 hover:text-indigo-900 p-1"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedTrip(trip);
                    setIsDeleteModalOpen(true);
                  }}
                  className="text-red-600 hover:text-red-900 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ];

  // Count active drivers for tab badge
  const activeDriverCount = drivers.filter(d => d.active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch Board"
        subtitle="Manage linehaul trip dispatch and driver assignments"
      />

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('planning')}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'planning'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 mr-2" />
              Planning
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 ${
                activeTab === 'drivers'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Drivers
              <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {activeDriverCount}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'planning' && (
        <>
          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-64">
              <Search
                value={planningSearchTerm}
                onChange={(value) => {
                  setPlanningSearchTerm(value);
                }}
                placeholder="Search manifest, linehaul, trailer..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={planningStatusFilter}
                onChange={(e) => {
                  setPlanningStatusFilter(e.target.value);
                }}
                className="rounded-md border-gray-300 text-sm"
              >
                {planningStatusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              {/* Location Type Filter */}
              <select
                value={locationTypeFilter}
                onChange={(e) => {
                  setLocationTypeFilter(e.target.value as 'all' | 'physical' | 'virtual');
                  setSelectedOrigins([]); // Clear selections when type changes
                }}
                className="rounded-md border-gray-300 text-sm"
              >
                <option value="all">All Types</option>
                <option value="physical">Physical Terminals</option>
                <option value="virtual">Virtual Terminals</option>
              </select>
              {/* Selected Origins Display */}
              <div className="relative">
                <div className="flex flex-wrap gap-1 items-center min-w-[150px] max-w-[300px] p-1 border border-gray-300 rounded-md bg-white text-sm">
                  {selectedOrigins.length === 0 ? (
                    <span className="text-gray-500 px-2 py-1">All Origins</span>
                  ) : (
                    selectedOrigins.map(id => {
                      const loc = locations.find(l => l.id === id);
                      return loc ? (
                        <span
                          key={id}
                          className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs"
                        >
                          {loc.code}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrigins(prev => prev.filter(i => i !== id));
                            }}
                            className="ml-1 hover:text-indigo-600"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })
                  )}
                </div>
              </div>
              {/* Select Dropdown */}
              <div className="relative group">
                <button
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  Select
                </button>
                <div className="absolute z-20 right-0 mt-1 w-64 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="p-2 border-b border-gray-200 bg-gray-50">
                    <span className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple</span>
                  </div>
                  {selectedOrigins.length > 0 && (
                    <button
                      onClick={() => setSelectedOrigins([])}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 border-b border-gray-200"
                    >
                      Clear all selections
                    </button>
                  )}
                  {filteredLocations.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No locations match this type</div>
                  ) : (
                    filteredLocations.map((location) => (
                      <button
                        key={location.id}
                        onClick={(e) => handleOriginSelect(location.id, e)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                          selectedOrigins.includes(location.id) ? 'bg-indigo-50 text-indigo-700' : ''
                        }`}
                      >
                        <span>{location.code} - {location.name || location.city}</span>
                        {selectedOrigins.includes(location.id) && (
                          <CheckCircle className="w-4 h-4 text-indigo-600" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

          {/* Planning Table - Shows loadsheets not yet dispatched */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-indigo-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Planning</h3>
                <span className="ml-2 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">
                  {filteredPlanningLoadsheets.length + continuingTrips.length} item{filteredPlanningLoadsheets.length + continuingTrips.length !== 1 ? 's' : ''} pending dispatch
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Loadsheets and arrived trips awaiting dispatch
                {selectedOrigins.length > 0 ? ` from ${selectedOrigins.map(id => locations.find(l => l.id === id)?.code).filter(Boolean).join(', ')}` : ' (all locations)'}
              </p>
            </div>

            {planningLoading ? (
              <div className="p-6 text-center text-gray-500">Loading planning data...</div>
            ) : (filteredPlanningLoadsheets.length === 0 && continuingTrips.length === 0) ? (
              <div className="p-6 text-center text-gray-500">
                No items pending dispatch{selectedOrigins.length > 0 ? ' from selected locations' : ''}{planningSearchTerm || planningStatusFilter ? ' matching your filters' : ''}. Create loadsheets on the Loadsheets page to see them here.
              </div>
            ) : (
              <>
                {filteredPlanningLoadsheets.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Linehaul
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Manifest #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Trailer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Load Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Dispatch
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Planned Carrier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Planned Driver
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredPlanningLoadsheets.map((loadsheet) => (
                        <tr key={loadsheet.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <MapPin className="w-3 h-3 mr-1" />
                              {loadsheet.originTerminalCode || loadsheet.originTerminal?.code || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <Truck className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="font-medium text-gray-900">{loadsheet.linehaulName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-indigo-600 font-medium">{loadsheet.manifestNumber}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {loadsheet.trailerNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            {new Date(loadsheet.loadDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {loadsheet.targetDispatchTime ? (
                              <div className="flex items-center text-gray-600">
                                <Clock className="w-3 h-3 mr-1" />
                                {loadsheet.targetDispatchTime}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLoadsheetStatusColor(loadsheet.status)}`}>
                              {loadsheet.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <select
                              value={planningData[loadsheet.id]?.plannedCarrierId || ''}
                              onChange={(e) => updatePlanningData(
                                loadsheet.id,
                                'plannedCarrierId',
                                e.target.value ? parseInt(e.target.value) : undefined
                              )}
                              className="w-40 text-sm rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Select carrier...</option>
                              {carriers.map((carrier) => (
                                <option key={carrier.id} value={carrier.id}>
                                  {carrier.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <select
                              value={planningData[loadsheet.id]?.plannedDriverId || ''}
                              onChange={(e) => updatePlanningData(
                                loadsheet.id,
                                'plannedDriverId',
                                e.target.value ? parseInt(e.target.value) : undefined
                              )}
                              className="w-40 text-sm rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                              <option value="">Select driver...</option>
                              {drivers
                                .filter(d => d.active && (!planningData[loadsheet.id]?.plannedCarrierId || d.carrierId === planningData[loadsheet.id]?.plannedCarrierId))
                                .map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleDispatchFromPlanning(loadsheet)}
                              disabled={
                                dispatchingLoadsheetId === loadsheet.id ||
                                !planningData[loadsheet.id]?.plannedDriverId
                              }
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="w-3 h-3 mr-1" />
                              {dispatchingLoadsheetId === loadsheet.id ? 'Dispatching...' : 'Dispatch'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )}

                {/* Continuing Trips Section - trips that arrived and will continue */}
                {continuingTrips.length > 0 && (
                  <div className="border-t border-gray-200">
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                      <div className="flex items-center">
                        <ArrowRight className="w-4 h-4 text-amber-600 mr-2" />
                        <span className="text-sm font-medium text-amber-800">
                          Arrived Trips Continuing ({continuingTrips.length})
                        </span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        These trips have arrived and will continue to another destination
                      </p>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Trip / Linehaul
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            From
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Arrived At
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Current Driver
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Planned Carrier
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Planned Driver
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {continuingTrips.map((trip) => (
                          <tr key={trip.id} className="hover:bg-amber-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div>
                                <span className="font-medium text-gray-900">{trip.tripNumber}</span>
                                <p className="text-xs text-gray-500">{trip.linehaulProfile?.name || trip.linehaulProfile?.profileCode}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                              {trip.linehaulProfile?.originTerminal?.code || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                {trip.linehaulProfile?.destinationTerminal?.code || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                              {trip.driver?.name || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={continuingTripData[trip.id]?.plannedCarrierId || ''}
                                onChange={(e) => updateContinuingTripData(
                                  trip.id,
                                  'plannedCarrierId',
                                  e.target.value ? parseInt(e.target.value) : undefined
                                )}
                                className="w-40 text-sm rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">Select carrier...</option>
                                {carriers.map((carrier) => (
                                  <option key={carrier.id} value={carrier.id}>
                                    {carrier.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <select
                                value={continuingTripData[trip.id]?.plannedDriverId || ''}
                                onChange={(e) => updateContinuingTripData(
                                  trip.id,
                                  'plannedDriverId',
                                  e.target.value ? parseInt(e.target.value) : undefined
                                )}
                                className="w-40 text-sm rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">Select driver...</option>
                                {drivers
                                  .filter(d => d.active && (!continuingTripData[trip.id]?.plannedCarrierId || d.carrierId === continuingTripData[trip.id]?.plannedCarrierId))
                                  .map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button
                                onClick={() => handleDispatchContinuingTrip(trip)}
                                disabled={
                                  dispatchingTripId === trip.id ||
                                  !continuingTripData[trip.id]?.plannedDriverId
                                }
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Send className="w-3 h-3 mr-1" />
                                {dispatchingTripId === trip.id ? 'Dispatching...' : 'Continue'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

        </>
      )}

      {activeTab === 'drivers' && (
        <DriversTab drivers={drivers} loading={driversLoading} />
      )}

      {/* Create Trip Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Trip"
      >
        <TripForm
          profiles={profiles}
          drivers={drivers}
          trucks={trucks}
          trailers={trailers}
          dollies={dollies}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Trip Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Trip"
      >
        <TripForm
          trip={selectedTrip}
          profiles={profiles}
          drivers={drivers}
          trucks={trucks}
          trailers={trailers}
          dollies={dollies}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Trip Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title="Trip Details"
      >
        {selectedTrip && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{selectedTrip.tripNumber}</h3>
              <TripStatusBadge status={selectedTrip.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Profile</label>
                <p className="text-gray-900">
                  {selectedTrip.linehaulProfile?.profileCode} - {selectedTrip.linehaulProfile?.name}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Dispatch Date</label>
                <p className="text-gray-900">{new Date(selectedTrip.dispatchDate).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Origin</label>
                <p className="text-gray-900">
                  {selectedTrip.linehaulProfile?.originTerminal?.code} - {selectedTrip.linehaulProfile?.originTerminal?.name}
                </p>
                <p className="text-sm text-gray-500">Departure: {selectedTrip.plannedDeparture || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Destination</label>
                <p className="text-gray-900">
                  {selectedTrip.linehaulProfile?.destinationTerminal?.code} - {selectedTrip.linehaulProfile?.destinationTerminal?.name}
                </p>
                <p className="text-sm text-gray-500">Arrival: {selectedTrip.plannedArrival || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Driver</label>
                <p className="text-gray-900 flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  {selectedTrip.driver?.name || '-'}
                </p>
                {selectedTrip.teamDriver && (
                  <p className="text-sm text-gray-500">Team Driver: {selectedTrip.teamDriver.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Equipment</label>
                <p className="text-gray-900 flex items-center">
                  <Truck className="w-4 h-4 mr-1" />
                  {selectedTrip.truck?.unitNumber || '-'}
                </p>
                {selectedTrip.trailer && (
                  <p className="text-sm text-gray-500">Trailer: {selectedTrip.trailer.unitNumber}</p>
                )}
              </div>
            </div>

            {selectedTrip.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Notes</label>
                <p className="text-gray-900">{selectedTrip.notes}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              {isAdmin && !['COMPLETED', 'CANCELLED'].includes(selectedTrip.status) && (
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Edit Trip
                </button>
              )}
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Trip"
      >
        <div className="space-y-4">
          <p className="text-gray-700">Are you sure you want to delete this trip?</p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{selectedTrip?.tripNumber}</p>
            <p className="text-sm text-gray-600">
              {selectedTrip?.linehaulProfile?.profileCode} - {new Date(selectedTrip?.dispatchDate || '').toLocaleDateString()}
            </p>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
