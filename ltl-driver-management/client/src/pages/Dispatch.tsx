import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Modal } from '../components/common/Modal';
import { TripStatusBadge } from '../components/dispatch/TripStatusBadge';
import { TripForm } from '../components/dispatch/TripForm';
import { linehaulTripService } from '../services/linehaulTripService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { equipmentService } from '../services/equipmentService';
import { driverService } from '../services/driverService';
import { locationService } from '../services/locationService';
import { DriversTab } from '../components/dispatch/DriversTab';
import { LoadsTab } from '../components/dispatch/LoadsTab';
import { CreateLoadsheetModal } from '../components/loadsheet/CreateLoadsheetModal';
import { OutboundTab } from '../components/dispatch/OutboundTab';
import { InboundTab } from '../components/dispatch/InboundTab';
import { ExpectedShipmentsTab } from '../components/dispatch/ExpectedShipmentsTab';
import { DispatchTripModal } from '../components/dispatch/DispatchTripModal';
import { ArriveTripModal } from '../components/dispatch/ArriveTripModal';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import {
  LinehaulTrip,
  LinehaulProfile,
  CarrierDriver,
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  Location
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
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
  Users,
  Container,
  LogOut,
  LogIn,
  TrendingUp
} from 'lucide-react';

type DispatchTab = 'loads' | 'drivers' | 'outbound' | 'inbound' | 'expected';

export const Dispatch: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState<LinehaulTrip[]>([]);
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [trucks, setTrucks] = useState<EquipmentTruck[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [dollies, setDollies] = useState<EquipmentDolly[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Global location filter state - shared across all tabs
  // Initialize with user's home location if set
  const [selectedLocations, setSelectedLocations] = useState<number[]>(() => {
    if (user?.homeLocationId) {
      return [user.homeLocationId];
    }
    return [];
  });

  // Tab state - read from URL params
  const tabFromUrl = searchParams.get('tab') as DispatchTab | null;
  const [activeTab, setActiveTab] = useState<DispatchTab>(tabFromUrl || 'loads');

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Handle action parameter (e.g., action=create for create loadsheet modal)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create' && tabFromUrl === 'loads') {
      setIsCreateLoadsheetModalOpen(true);
      // Clear the action parameter from URL so modal doesn't reopen on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    } else if (action === 'dispatch-trip') {
      setIsDispatchTripModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    } else if (action === 'arrive-trip') {
      setIsArriveTripModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (tab: DispatchTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Filters - persisted to localStorage
  const [filters, , updateFilter] = usePersistedFilters('dispatch-filters', {
    profileFilter: '' as number | '',
    startDate: '',
    endDate: '',
    selectedOrigins: [] as number[],
  });
  const { profileFilter, startDate, endDate, selectedOrigins } = filters;
  const setProfileFilter = (v: number | '') => updateFilter('profileFilter', v);
  const setStartDate = (v: string) => updateFilter('startDate', v);
  const setEndDate = (v: string) => updateFilter('endDate', v);
  const setSelectedOrigins = (v: number[]) => updateFilter('selectedOrigins', v);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<LinehaulTrip | null>(null);
  const [isCreateLoadsheetModalOpen, setIsCreateLoadsheetModalOpen] = useState(false);
  const [isDispatchTripModalOpen, setIsDispatchTripModalOpen] = useState(false);
  const [isArriveTripModalOpen, setIsArriveTripModalOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchProfiles();
    fetchDrivers();
    fetchEquipment();
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [currentPage, profileFilter, startDate, endDate, selectedOrigins]);

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
      const response = await driverService.getDrivers({ active: true, limit: 1000 });
      setDrivers(response.drivers);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch Board"
        subtitle="Manage linehaul trip dispatch and driver assignments"
      />

      {/* Tabs and Location Filter */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-1">
            <nav className="flex -mb-px gap-1">
              <button
                onClick={() => handleTabChange('loads')}
                className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === 'loads'
                    ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-500'
                    : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-b-2 border-transparent'
                }`}
              >
                <Container className="w-4 h-4 mr-2" />
                Loads
              </button>
              <button
                onClick={() => handleTabChange('inbound')}
                className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === 'inbound'
                    ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-b-2 border-transparent'
                }`}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Inbound
              </button>
              <button
                onClick={() => handleTabChange('outbound')}
                className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === 'outbound'
                    ? 'bg-green-100 text-green-700 border-b-2 border-green-500'
                    : 'bg-green-50 text-green-600 hover:bg-green-100 border-b-2 border-transparent'
                }`}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Outbound
              </button>
              <button
                onClick={() => handleTabChange('drivers')}
                className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === 'drivers'
                    ? 'bg-amber-100 text-amber-700 border-b-2 border-amber-500'
                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-b-2 border-transparent'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Drivers
              </button>
              <button
                onClick={() => handleTabChange('expected')}
                className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                  activeTab === 'expected'
                    ? 'bg-teal-100 text-teal-700 border-b-2 border-teal-500'
                    : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border-b-2 border-transparent'
                }`}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Expected
              </button>
            </nav>
            <div className="flex items-center gap-2 pr-2">
              <span className="text-sm text-gray-500">Location:</span>
              <LocationMultiSelect
                value={selectedLocations}
                onChange={setSelectedLocations}
                placeholder="All locations"
                className="w-64"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={activeTab === 'loads' ? '' : 'hidden'}>
        <LoadsTab onOpenCreateModal={() => setIsCreateLoadsheetModalOpen(true)} selectedLocations={selectedLocations} />
      </div>

      <div className={activeTab === 'inbound' ? '' : 'hidden'}>
        <InboundTab selectedLocations={selectedLocations} />
      </div>

      <div className={activeTab === 'outbound' ? '' : 'hidden'}>
        <OutboundTab selectedLocations={selectedLocations} />
      </div>

      <div className={activeTab === 'drivers' ? '' : 'hidden'}>
        <DriversTab selectedLocations={selectedLocations} />
      </div>

      <div className={activeTab === 'expected' ? '' : 'hidden'}>
        <ExpectedShipmentsTab selectedLocations={selectedLocations} />
      </div>

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

      {/* Create Loadsheet Modal */}
      <CreateLoadsheetModal
        isOpen={isCreateLoadsheetModalOpen}
        onClose={() => setIsCreateLoadsheetModalOpen(false)}
        onSuccess={() => {
          // Refresh loads tab data if we're on that tab
          if (activeTab === 'loads') {
            // The LoadsTab component will refresh on its own via refetch
          }
        }}
      />

      {/* Dispatch Trip Modal */}
      <DispatchTripModal
        isOpen={isDispatchTripModalOpen}
        onClose={() => setIsDispatchTripModalOpen(false)}
        onSuccess={() => {
          // Switch to outbound tab to see the dispatched trip
          handleTabChange('outbound');
        }}
      />

      {/* Arrive Trip Modal */}
      <ArriveTripModal
        isOpen={isArriveTripModalOpen}
        onClose={() => setIsArriveTripModalOpen(false)}
        onSuccess={() => {
          // Switch to inbound tab to see the arrived trip
          handleTabChange('inbound');
        }}
      />
    </div>
  );
};
