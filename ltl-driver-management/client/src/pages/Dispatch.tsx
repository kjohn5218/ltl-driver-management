import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { TripStatusBadge } from '../components/dispatch/TripStatusBadge';
import { TripForm } from '../components/dispatch/TripForm';
import { linehaulTripService } from '../services/linehaulTripService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { equipmentService } from '../services/equipmentService';
import { driverService } from '../services/driverService';
import {
  LinehaulTrip,
  LinehaulProfile,
  CarrierDriver,
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  TripStatus
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  List,
  ChevronLeft,
  ChevronRight,
  Truck,
  User,
  ArrowRight,
  Play,
  CheckCircle,
  XCircle,
  Filter
} from 'lucide-react';

type ViewMode = 'calendar' | 'list';

const statusFilterOptions: { value: TripStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export const Dispatch: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [trips, setTrips] = useState<LinehaulTrip[]>([]);
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [trucks, setTrucks] = useState<EquipmentTruck[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [dollies, setDollies] = useState<EquipmentDolly[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TripStatus | ''>('');
  const [profileFilter, setProfileFilter] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Calendar state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    return new Date(today.setDate(diff));
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
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [currentPage, searchTerm, statusFilter, profileFilter, viewMode, currentWeekStart]);

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
      const response = await driverService.getDrivers({ limit: 1000 });
      setDrivers(response.drivers);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
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

      if (viewMode === 'calendar') {
        const endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);

        const data = await linehaulTripService.getTripsForDispatch(
          currentWeekStart.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          profileFilter || undefined
        );
        setTrips(data);
      } else {
        const response = await linehaulTripService.getTrips({
          search: searchTerm || undefined,
          status: statusFilter || undefined,
          profileId: profileFilter || undefined,
          page: currentPage,
          limit: 20
        });
        setTrips(response.trips);
        setTotalPages(response.pagination.totalPages);
      }
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newStart);
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getTripsForDate = (date: Date) => {
    return trips.filter(trip => {
      const tripDate = new Date(trip.dispatchDate);
      return tripDate.toDateString() === date.toDateString();
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

  const renderCalendarView = () => {
    const weekDates = getWeekDates();

    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Calendar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-medium text-gray-900">
            {formatDate(currentWeekStart)} - {formatDate(weekDates[6])}
          </h3>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 divide-x divide-gray-200">
          {weekDates.map((date) => (
            <div key={date.toISOString()} className="min-h-[300px]">
              <div className={`p-2 text-center border-b ${
                date.toDateString() === new Date().toDateString()
                  ? 'bg-indigo-50 font-medium'
                  : 'bg-gray-50'
              }`}>
                <div className="text-xs text-gray-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                <div className={`text-lg ${
                  date.toDateString() === new Date().toDateString() ? 'text-indigo-600' : 'text-gray-900'
                }`}>
                  {date.getDate()}
                </div>
              </div>

              <div className="p-2 space-y-2">
                {getTripsForDate(date).map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => {
                      setSelectedTrip(trip);
                      setIsDetailsModalOpen(true);
                    }}
                    className="p-2 bg-white border rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900">
                        {trip.tripNumber}
                      </span>
                      <TripStatusBadge status={trip.status} />
                    </div>
                    <div className="text-xs text-gray-600">
                      {trip.linehaulProfile?.profileCode}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {trip.plannedDeparture || '-'}
                    </div>
                    {trip.driver && (
                      <div className="text-xs text-gray-500 truncate">
                        {trip.driver.name}
                      </div>
                    )}
                  </div>
                ))}

                {isAdmin && (
                  <button
                    onClick={() => {
                      // Pre-fill date for new trip
                      setIsCreateModalOpen(true);
                    }}
                    className="w-full p-2 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded border border-dashed border-gray-300"
                  >
                    + Add Trip
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch Board"
        subtitle="Manage linehaul trip dispatch and driver assignments"
      />

      {/* View Toggle and Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 flex items-center text-sm ${
                  viewMode === 'calendar'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 flex items-center text-sm ${
                  viewMode === 'list'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4 mr-1" />
                List
              </button>
            </div>

            {viewMode === 'list' && (
              <>
                <div className="w-64">
                  <Search
                    value={searchTerm}
                    onChange={(value) => {
                      setSearchTerm(value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search trips..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as TripStatus | '');
                      setCurrentPage(1);
                    }}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <select
              value={profileFilter}
              onChange={(e) => {
                setProfileFilter(e.target.value ? parseInt(e.target.value) : '');
                setCurrentPage(1);
              }}
              className="rounded-md border-gray-300 text-sm"
            >
              <option value="">All Profiles</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.profileCode}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Trip
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        renderCalendarView()
      ) : (
        <div className="bg-white shadow rounded-lg">
          <DataTable columns={columns} data={trips} loading={loading} />

          {!loading && trips.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
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
