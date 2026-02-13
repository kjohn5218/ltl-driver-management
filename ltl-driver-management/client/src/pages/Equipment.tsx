import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { EquipmentStatusBadge } from '../components/equipment/EquipmentStatusBadge';
import { TruckForm } from '../components/equipment/TruckForm';
import { TrailerForm } from '../components/equipment/TrailerForm';
import { DollyForm } from '../components/equipment/DollyForm';
import { equipmentService, VehicleLocationData, TerminalAllocationData, AllocationSummaryResponse } from '../services/equipmentService';
import { locationService } from '../services/locationService';
import {
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  EquipmentStatus,
  Location
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
import {
  Plus,
  Edit,
  Trash2,
  Truck,
  Container,
  Link2,
  MapPin,
  Filter,
  RefreshCw,
  X,
  Navigation,
  Gauge,
  Fuel,
  User,
  Clock,
  Database,
  TruckIcon,
  ExternalLink,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Save,
  Settings
} from 'lucide-react';

type TabType = 'trucks' | 'trailers' | 'dollies' | 'allocation';

const statusFilterOptions: { value: EquipmentStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service' }
];

export const Equipment: React.FC = () => {
  const { user } = useAuth();

  // Filters - persisted to localStorage
  const [filters, , updateFilter] = usePersistedFilters('equipment-filters', {
    activeTab: 'trucks' as TabType,
    searchTerm: '',
    statusFilter: '' as EquipmentStatus | '',
    terminalFilter: '' as number | '',
  });
  const { activeTab, searchTerm, statusFilter, terminalFilter } = filters;
  const setActiveTab = (v: TabType) => updateFilter('activeTab', v);
  const setSearchTerm = (v: string) => updateFilter('searchTerm', v);
  const setStatusFilter = (v: EquipmentStatus | '') => updateFilter('statusFilter', v);
  const setTerminalFilter = (v: number | '') => updateFilter('terminalFilter', v);

  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Data
  const [trucks, setTrucks] = useState<EquipmentTruck[]>([]);
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [dollies, setDollies] = useState<EquipmentDolly[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<EquipmentTruck | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<EquipmentTrailer | null>(null);
  const [selectedDolly, setSelectedDolly] = useState<EquipmentDolly | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Location modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<VehicleLocationData | null>(null);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState<string>('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  // Allocation state
  const [allocationData, setAllocationData] = useState<AllocationSummaryResponse | null>(null);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [expandedTerminals, setExpandedTerminals] = useState<Set<number>>(new Set());
  const [editingAllocation, setEditingAllocation] = useState<number | null>(null);
  const [editedAllocations, setEditedAllocations] = useState<Record<string, number>>({});
  const [savingAllocation, setSavingAllocation] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (activeTab === 'allocation') {
      fetchAllocationData();
    } else {
      fetchData();
    }
  }, [activeTab, currentPage, searchTerm, statusFilter, terminalFilter]);

  const fetchLocations = async () => {
    try {
      const data = await locationService.getLocationsList();
      setLocations(data);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchAllocationData = async () => {
    setAllocationLoading(true);
    try {
      const data = await equipmentService.getAllocationSummary();
      setAllocationData(data);
    } catch (error) {
      toast.error('Failed to fetch allocation data');
      console.error('Failed to fetch allocation data:', error);
    } finally {
      setAllocationLoading(false);
    }
  };


  const fetchData = async () => {
    setLoading(true);
    const filters = {
      search: searchTerm || undefined,
      status: statusFilter || undefined,
      terminalId: terminalFilter || undefined,
      page: currentPage,
      limit: 20
    };

    try {
      switch (activeTab) {
        case 'trucks':
          const trucksRes = await equipmentService.getTrucks(filters);
          setTrucks(trucksRes.trucks || []);
          setTotalPages(trucksRes.pagination.totalPages);
          break;
        case 'trailers':
          const trailersRes = await equipmentService.getTrailers(filters);
          setTrailers(trailersRes.trailers || []);
          setTotalPages(trailersRes.pagination.totalPages);
          break;
        case 'dollies':
          const dolliesRes = await equipmentService.getDollies(filters);
          setDollies(dolliesRes.dollies || []);
          setTotalPages(dolliesRes.pagination.totalPages);
          break;
      }
    } catch (error) {
      toast.error(`Failed to fetch ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchTerm('');
    setStatusFilter('');
  };

  const toggleTerminalExpand = (terminalId: number) => {
    const newExpanded = new Set(expandedTerminals);
    if (newExpanded.has(terminalId)) {
      newExpanded.delete(terminalId);
    } else {
      newExpanded.add(terminalId);
    }
    setExpandedTerminals(newExpanded);
  };

  const startEditingAllocation = (terminal: TerminalAllocationData) => {
    setEditingAllocation(terminal.id);
    setEditedAllocations({ ...terminal.targets });
  };

  const cancelEditingAllocation = () => {
    setEditingAllocation(null);
    setEditedAllocations({});
  };

  const saveAllocation = async (terminalId: number) => {
    setSavingAllocation(true);
    try {
      await equipmentService.updateTerminalAllocations(terminalId, editedAllocations);
      toast.success('Allocation targets saved successfully');
      setEditingAllocation(null);
      setEditedAllocations({});
      fetchAllocationData();
    } catch (error) {
      toast.error('Failed to save allocation targets');
    } finally {
      setSavingAllocation(false);
    }
  };

  const getVarianceClass = (variance: number, target: number): string => {
    if (target === 0) return 'text-gray-500';
    if (variance >= 0) return 'text-green-600';
    if (variance >= -2) return 'text-amber-600';
    return 'text-red-600';
  };

  const getVarianceBgClass = (variance: number, target: number): string => {
    if (target === 0) return 'bg-gray-50';
    if (variance >= 0) return 'bg-green-50';
    if (variance >= -2) return 'bg-amber-50';
    return 'bg-red-50';
  };

  const formatEquipmentTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'truck_day_cab': 'Day Cab',
      'truck_sleeper': 'Sleeper',
      'truck_straight': 'Straight',
      'trailer_53': "53'",
      'trailer_48': "48'",
      'trailer_45': "45'",
      'trailer_28': "28'",
      'dolly_a': 'A-Dolly',
      'dolly_b': 'B-Dolly'
    };
    return labels[type] || type;
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await equipmentService.syncAllEquipment();
      if (result.success) {
        toast.success(result.message);
        fetchData();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to sync equipment from Fleet App';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      switch (activeTab) {
        case 'trucks':
          await equipmentService.createTruck(data);
          break;
        case 'trailers':
          await equipmentService.createTrailer(data);
          break;
        case 'dollies':
          await equipmentService.createDolly(data);
          break;
      }
      toast.success(`${activeTab.slice(0, -1)} created successfully`);
      setIsCreateModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(`Failed to create ${activeTab.slice(0, -1)}`);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      switch (activeTab) {
        case 'trucks':
          if (selectedTruck) await equipmentService.updateTruck(selectedTruck.id, data);
          break;
        case 'trailers':
          if (selectedTrailer) await equipmentService.updateTrailer(selectedTrailer.id, data);
          break;
        case 'dollies':
          if (selectedDolly) await equipmentService.updateDolly(selectedDolly.id, data);
          break;
      }
      toast.success(`${activeTab.slice(0, -1)} updated successfully`);
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(`Failed to update ${activeTab.slice(0, -1)}`);
    }
  };

  const handleDelete = async () => {
    try {
      switch (activeTab) {
        case 'trucks':
          if (selectedTruck) await equipmentService.deleteTruck(selectedTruck.id);
          break;
        case 'trailers':
          if (selectedTrailer) await equipmentService.deleteTrailer(selectedTrailer.id);
          break;
        case 'dollies':
          if (selectedDolly) await equipmentService.deleteDolly(selectedDolly.id);
          break;
      }
      toast.success(`${activeTab.slice(0, -1)} deleted successfully`);
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(`Failed to delete ${activeTab.slice(0, -1)}`);
    }
  };

  const openEditModal = (item: EquipmentTruck | EquipmentTrailer | EquipmentDolly) => {
    switch (activeTab) {
      case 'trucks':
        setSelectedTruck(item as EquipmentTruck);
        break;
      case 'trailers':
        setSelectedTrailer(item as EquipmentTrailer);
        break;
      case 'dollies':
        setSelectedDolly(item as EquipmentDolly);
        break;
    }
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (item: EquipmentTruck | EquipmentTrailer | EquipmentDolly) => {
    switch (activeTab) {
      case 'trucks':
        setSelectedTruck(item as EquipmentTruck);
        break;
      case 'trailers':
        setSelectedTrailer(item as EquipmentTrailer);
        break;
      case 'dollies':
        setSelectedDolly(item as EquipmentDolly);
        break;
    }
    setIsDeleteModalOpen(true);
  };

  const getSelectedItem = () => {
    switch (activeTab) {
      case 'trucks':
        return selectedTruck;
      case 'trailers':
        return selectedTrailer;
      case 'dollies':
        return selectedDolly;
    }
  };

  const handleUnitNumberClick = async (unitNumber: string) => {
    setSelectedUnitNumber(unitNumber);
    setIsFetchingLocation(true);
    setIsLocationModalOpen(true);
    setSelectedLocation(null);

    try {
      const location = await equipmentService.getTruckLocation(unitNumber);
      if (location && location.latitude !== undefined && location.longitude !== undefined) {
        setSelectedLocation(location);
      } else {
        setSelectedLocation(null);
      }
    } catch (error: any) {
      console.error('Failed to fetch location:', error);
      toast.error(error.response?.data?.message || `No location data available for ${unitNumber}`);
      setSelectedLocation(null);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Column definitions for trucks
  const truckColumns = [
    {
      header: 'Unit #',
      accessor: 'unitNumber' as keyof EquipmentTruck,
      cell: (truck: EquipmentTruck) => (
        <button
          onClick={() => handleUnitNumberClick(truck.unitNumber)}
          className="font-medium text-indigo-600 hover:text-indigo-900 hover:underline flex items-center"
          title="View GPS Location"
        >
          <MapPin className="w-3 h-3 mr-1" />
          {truck.unitNumber}
        </button>
      )
    },
    {
      header: 'Type',
      accessor: 'truckType' as keyof EquipmentTruck,
      cell: (truck: EquipmentTruck) => {
        const typeLabels: Record<string, string> = {
          DAY_CAB: 'Day Cab',
          SLEEPER: 'Sleeper',
          STRAIGHT_TRUCK: 'Straight Truck'
        };
        return <span className="text-gray-600">{typeLabels[truck.truckType] || truck.truckType}</span>;
      }
    },
    {
      header: 'Make/Model',
      accessor: 'make' as keyof EquipmentTruck,
      cell: (truck: EquipmentTruck) => (
        <span className="text-gray-600">
          {truck.make} {truck.model} {truck.year ? `(${truck.year})` : ''}
        </span>
      )
    },
    {
      header: 'Terminal',
      accessor: 'effectiveTerminal' as keyof EquipmentTruck,
      cell: (truck: any) => {
        const terminal = truck.effectiveTerminal;
        const source = truck.locationSource;
        if (!terminal) return <span className="text-gray-400">-</span>;

        return (
          <div className="flex items-center text-gray-600" title={
            source === 'yard_sync' ? 'Location from yard inventory sync' :
            source === 'trip_arrival' ? 'Location from last trip arrival' :
            'Manually set location'
          }>
            {source === 'yard_sync' ? (
              <Database className="w-4 h-4 mr-1 text-blue-500" />
            ) : source === 'trip_arrival' ? (
              <TruckIcon className="w-4 h-4 mr-1 text-green-500" />
            ) : (
              <MapPin className="w-4 h-4 mr-1 text-gray-400" />
            )}
            <span>{terminal.code}</span>
          </div>
        );
      }
    },
    {
      header: 'GPS',
      accessor: 'currentLatitude' as keyof EquipmentTruck,
      cell: (truck: any) => {
        if (truck.currentLatitude && truck.currentLongitude) {
          const lat = truck.currentLatitude;
          const lng = truck.currentLongitude;
          return (
            <a
              href={`https://www.google.com/maps?q=${lat},${lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-indigo-600 hover:text-indigo-900 hover:underline text-xs"
              title={`Last updated: ${truck.lastLocationUpdate ? new Date(truck.lastLocationUpdate).toLocaleString() : 'Unknown'}`}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </a>
          );
        }
        return <span className="text-gray-400 text-xs">-</span>;
      }
    },
    {
      header: 'Status',
      accessor: 'status' as keyof EquipmentTruck,
      cell: (truck: EquipmentTruck) => <EquipmentStatusBadge status={truck.status} />
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof EquipmentTruck,
            cell: (truck: EquipmentTruck) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(truck)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(truck)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ];

  // Column definitions for trailers
  const trailerColumns = [
    {
      header: 'Unit #',
      accessor: 'unitNumber' as keyof EquipmentTrailer,
      cell: (trailer: EquipmentTrailer) => (
        <button
          onClick={() => handleUnitNumberClick(trailer.unitNumber)}
          className="font-medium text-indigo-600 hover:text-indigo-900 hover:underline flex items-center"
          title="View GPS Location"
        >
          <MapPin className="w-3 h-3 mr-1" />
          {trailer.unitNumber}
        </button>
      )
    },
    {
      header: 'Type',
      accessor: 'trailerType' as keyof EquipmentTrailer,
      cell: (trailer: EquipmentTrailer) => {
        const typeLabels: Record<string, string> = {
          DRY_VAN: 'Dry Van',
          REEFER: 'Reefer',
          FLATBED: 'Flatbed',
          CONTAINER: 'Container',
          TANKER: 'Tanker',
          SPECIALIZED: 'Specialized'
        };
        return <span className="text-gray-600">{typeLabels[trailer.trailerType] || trailer.trailerType}</span>;
      }
    },
    {
      header: 'Length',
      accessor: 'lengthFeet' as keyof EquipmentTrailer,
      cell: (trailer: EquipmentTrailer) => (
        <span className="text-gray-600">{trailer.lengthFeet ? `${trailer.lengthFeet}'` : '-'}</span>
      )
    },
    {
      header: 'Capacity',
      accessor: 'capacityWeight' as keyof EquipmentTrailer,
      cell: (trailer: EquipmentTrailer) => (
        <span className="text-gray-600">
          {trailer.capacityWeight ? `${trailer.capacityWeight.toLocaleString()} lbs` : '-'}
        </span>
      )
    },
    {
      header: 'Terminal',
      accessor: 'effectiveTerminal' as keyof EquipmentTrailer,
      cell: (trailer: any) => {
        const terminal = trailer.effectiveTerminal;
        const source = trailer.locationSource;
        if (!terminal) return <span className="text-gray-400">-</span>;

        return (
          <div className="flex items-center text-gray-600" title={
            source === 'yard_sync' ? 'Location from yard inventory sync' :
            source === 'trip_arrival' ? 'Location from last trip arrival' :
            'Manually set location'
          }>
            {source === 'yard_sync' ? (
              <Database className="w-4 h-4 mr-1 text-blue-500" />
            ) : source === 'trip_arrival' ? (
              <TruckIcon className="w-4 h-4 mr-1 text-green-500" />
            ) : (
              <MapPin className="w-4 h-4 mr-1 text-gray-400" />
            )}
            <span>{terminal.code}</span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status' as keyof EquipmentTrailer,
      cell: (trailer: EquipmentTrailer) => <EquipmentStatusBadge status={trailer.status} />
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof EquipmentTrailer,
            cell: (trailer: EquipmentTrailer) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(trailer)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(trailer)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ];

  // Column definitions for dollies
  const dollyColumns = [
    {
      header: 'Unit #',
      accessor: 'unitNumber' as keyof EquipmentDolly,
      cell: (dolly: EquipmentDolly) => (
        <div className="font-medium text-gray-900">{dolly.unitNumber}</div>
      )
    },
    {
      header: 'Type',
      accessor: 'dollyType' as keyof EquipmentDolly,
      cell: (dolly: EquipmentDolly) => {
        const typeLabels: Record<string, string> = {
          A_DOLLY: 'A-Dolly (Converter)',
          B_DOLLY: 'B-Dolly (Fixed)'
        };
        return <span className="text-gray-600">{typeLabels[dolly.dollyType] || dolly.dollyType}</span>;
      }
    },
    {
      header: 'Terminal',
      accessor: 'effectiveTerminal' as keyof EquipmentDolly,
      cell: (dolly: any) => {
        const terminal = dolly.effectiveTerminal;
        const source = dolly.locationSource;
        if (!terminal) return <span className="text-gray-400">-</span>;

        return (
          <div className="flex items-center text-gray-600" title={
            source === 'yard_sync' ? 'Location from yard inventory sync' :
            source === 'trip_arrival' ? 'Location from last trip arrival' :
            'Manually set location'
          }>
            {source === 'yard_sync' ? (
              <Database className="w-4 h-4 mr-1 text-blue-500" />
            ) : source === 'trip_arrival' ? (
              <TruckIcon className="w-4 h-4 mr-1 text-green-500" />
            ) : (
              <MapPin className="w-4 h-4 mr-1 text-gray-400" />
            )}
            <span>{terminal.code}</span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status' as keyof EquipmentDolly,
      cell: (dolly: EquipmentDolly) => <EquipmentStatusBadge status={dolly.status} />
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof EquipmentDolly,
            cell: (dolly: EquipmentDolly) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(dolly)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(dolly)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          }
        ]
      : [])
  ];

  const getColumns = () => {
    switch (activeTab) {
      case 'trucks':
        return truckColumns;
      case 'trailers':
        return trailerColumns;
      case 'dollies':
        return dollyColumns;
      case 'allocation':
        return [];
    }
  };

  const getData = () => {
    switch (activeTab) {
      case 'trucks':
        return trucks;
      case 'trailers':
        return trailers;
      case 'dollies':
        return dollies;
      case 'allocation':
        return [];
    }
  };

  const getFormModalTitle = () => {
    const action = isCreateModalOpen ? 'Add' : 'Edit';
    const type = activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1);
    return `${action} ${type}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        subtitle="Manage trucks, trailers, and dollies"
      />

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px gap-1 p-1">
            <button
              onClick={() => handleTabChange('trucks')}
              className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === 'trucks'
                  ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-500'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-b-2 border-transparent'
              }`}
            >
              <Truck className="w-4 h-4 mr-2" />
              Trucks
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'trucks'
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {trucks.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('trailers')}
              className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === 'trailers'
                  ? 'bg-green-100 text-green-700 border-b-2 border-green-500'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 border-b-2 border-transparent'
              }`}
            >
              <Container className="w-4 h-4 mr-2" />
              Trailers
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'trailers'
                  ? 'bg-green-200 text-green-800'
                  : 'bg-green-100 text-green-700'
              }`}>
                {trailers.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('dollies')}
              className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === 'dollies'
                  ? 'bg-orange-100 text-orange-700 border-b-2 border-orange-500'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100 border-b-2 border-transparent'
              }`}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Dollies
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'dollies'
                  ? 'bg-orange-200 text-orange-800'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {dollies.length}
              </span>
            </button>
            <button
              onClick={() => handleTabChange('allocation')}
              className={`flex items-center px-6 py-3 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === 'allocation'
                  ? 'bg-purple-100 text-purple-700 border-b-2 border-purple-500'
                  : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-b-2 border-transparent'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Allocation
            </button>
          </nav>
        </div>
      </div>

      {/* Equipment Table View */}
      {activeTab !== 'allocation' && (
        <div className="bg-white shadow rounded-lg">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 flex-1">
                <div className="flex-1 max-w-md">
                  <Search
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder={`Search ${activeTab} by unit number...`}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as EquipmentStatus | '');
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {statusFilterOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={terminalFilter}
                    onChange={(e) => {
                      setTerminalFilter(e.target.value ? parseInt(e.target.value) : '');
                      setCurrentPage(1);
                    }}
                    className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">All Locations</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} - {location.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync from Fleet App'}
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <DataTable columns={getColumns() as any} data={getData() as any} loading={loading} />

          {/* Pagination */}
          {!loading && getData() && getData()!.length > 0 && (
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

      {/* Allocation View */}
      {activeTab === 'allocation' && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Equipment Allocation by Terminal</h2>
                <p className="text-sm text-gray-500">View and manage equipment allocation targets for each terminal</p>
              </div>
              <button
                onClick={fetchAllocationData}
                disabled={allocationLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${allocationLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center space-x-6 text-xs">
            <span className="font-medium text-gray-700">Legend:</span>
            <span className="flex items-center">
              <span className="w-3 h-3 rounded bg-green-500 mr-1"></span>
              Met/Overage
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 rounded bg-amber-500 mr-1"></span>
              Near Target (-1 to -2)
            </span>
            <span className="flex items-center">
              <span className="w-3 h-3 rounded bg-red-500 mr-1"></span>
              Shortage (&lt; -2)
            </span>
          </div>

          {allocationLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : allocationData ? (
            <div className="divide-y divide-gray-200">
              {allocationData.terminals.map((terminal) => {
                const isExpanded = expandedTerminals.has(terminal.id);
                const isEditing = editingAllocation === terminal.id;

                // Equipment categories for display
                const truckTypes = ['truck_day_cab', 'truck_sleeper', 'truck_straight'];
                const trailerTypes = ['trailer_53', 'trailer_48', 'trailer_45', 'trailer_28'];
                const dollyTypes = ['dolly_a', 'dolly_b'];

                return (
                  <div key={terminal.id} className="bg-white">
                    {/* Terminal Header */}
                    <div className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => toggleTerminalExpand(terminal.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{terminal.code}</h3>
                          <p className="text-xs text-gray-500">{terminal.name}</p>
                        </div>
                      </div>

                      {/* Summary Badges */}
                      <div className="flex items-center space-x-6">
                        {/* Trucks Summary */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Trucks</div>
                          <div className="flex space-x-1">
                            {truckTypes.map(type => {
                              const variance = terminal.variance[type];
                              const target = terminal.targets[type];
                              if (target === 0 && terminal.current[type] === 0) return null;
                              return (
                                <span
                                  key={type}
                                  className={`px-2 py-1 rounded text-xs font-medium ${getVarianceBgClass(variance, target)} ${getVarianceClass(variance, target)}`}
                                  title={`${formatEquipmentTypeLabel(type)}: ${terminal.current[type]}/${target} (${variance >= 0 ? '+' : ''}${variance})`}
                                >
                                  {terminal.current[type]}/{target}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Trailers Summary */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Trailers</div>
                          <div className="flex space-x-1">
                            {trailerTypes.map(type => {
                              const variance = terminal.variance[type];
                              const target = terminal.targets[type];
                              if (target === 0 && terminal.current[type] === 0) return null;
                              return (
                                <span
                                  key={type}
                                  className={`px-2 py-1 rounded text-xs font-medium ${getVarianceBgClass(variance, target)} ${getVarianceClass(variance, target)}`}
                                  title={`${formatEquipmentTypeLabel(type)}: ${terminal.current[type]}/${target} (${variance >= 0 ? '+' : ''}${variance})`}
                                >
                                  {terminal.current[type]}/{target}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dollies Summary */}
                        <div className="text-center">
                          <div className="text-xs text-gray-500 mb-1">Dollies</div>
                          <div className="flex space-x-1">
                            {dollyTypes.map(type => {
                              const variance = terminal.variance[type];
                              const target = terminal.targets[type];
                              if (target === 0 && terminal.current[type] === 0) return null;
                              return (
                                <span
                                  key={type}
                                  className={`px-2 py-1 rounded text-xs font-medium ${getVarianceBgClass(variance, target)} ${getVarianceClass(variance, target)}`}
                                  title={`${formatEquipmentTypeLabel(type)}: ${terminal.current[type]}/${target} (${variance >= 0 ? '+' : ''}${variance})`}
                                >
                                  {terminal.current[type]}/{target}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Actions */}
                        {isAdmin && !isEditing && (
                          <button
                            onClick={() => startEditingAllocation(terminal)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit allocation targets"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-gray-50">
                        {/* Edit Mode */}
                        {isEditing && (
                          <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">Edit Allocation Targets</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {/* Trucks */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-700 mb-2">Trucks</h5>
                                {truckTypes.map(type => (
                                  <div key={type} className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-gray-600">{formatEquipmentTypeLabel(type)}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editedAllocations[type] || 0}
                                      onChange={(e) => setEditedAllocations({
                                        ...editedAllocations,
                                        [type]: parseInt(e.target.value) || 0
                                      })}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                ))}
                              </div>
                              {/* Trailers */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-700 mb-2">Trailers</h5>
                                {trailerTypes.map(type => (
                                  <div key={type} className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-gray-600">{formatEquipmentTypeLabel(type)}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editedAllocations[type] || 0}
                                      onChange={(e) => setEditedAllocations({
                                        ...editedAllocations,
                                        [type]: parseInt(e.target.value) || 0
                                      })}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                ))}
                              </div>
                              {/* Dollies */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-700 mb-2">Dollies</h5>
                                {dollyTypes.map(type => (
                                  <div key={type} className="flex items-center justify-between mb-2">
                                    <label className="text-sm text-gray-600">{formatEquipmentTypeLabel(type)}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={editedAllocations[type] || 0}
                                      onChange={(e) => setEditedAllocations({
                                        ...editedAllocations,
                                        [type]: parseInt(e.target.value) || 0
                                      })}
                                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                              <button
                                onClick={cancelEditingAllocation}
                                className="px-3 py-1 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveAllocation(terminal.id)}
                                disabled={savingAllocation}
                                className="px-3 py-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 flex items-center"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                {savingAllocation ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inbound Equipment */}
                        {terminal.inbound.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Inbound Equipment ({terminal.inbound.length})</h4>
                            <div className="grid grid-cols-4 gap-2">
                              {terminal.inbound.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between px-3 py-2 bg-white rounded border border-gray-200 text-sm"
                                >
                                  <span className="font-medium">{item.unitNumber}</span>
                                  <span className="text-xs text-gray-500">{formatEquipmentTypeLabel(item.equipmentType)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {terminal.inbound.length === 0 && !isEditing && (
                          <p className="text-sm text-gray-500 italic">No inbound equipment</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BarChart3 className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No allocation data available</p>
              <p className="text-sm">Click Refresh to load allocation data</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={getFormModalTitle()}
      >
        {activeTab === 'trucks' && (
          <TruckForm
            locations={locations}
            onSubmit={handleCreate}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        )}
        {activeTab === 'trailers' && (
          <TrailerForm
            locations={locations}
            onSubmit={handleCreate}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        )}
        {activeTab === 'dollies' && (
          <DollyForm
            locations={locations}
            onSubmit={handleCreate}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={getFormModalTitle()}
      >
        {activeTab === 'trucks' && (
          <TruckForm
            truck={selectedTruck}
            locations={locations}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditModalOpen(false)}
          />
        )}
        {activeTab === 'trailers' && (
          <TrailerForm
            trailer={selectedTrailer}
            locations={locations}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditModalOpen(false)}
          />
        )}
        {activeTab === 'dollies' && (
          <DollyForm
            dolly={selectedDolly}
            locations={locations}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete ${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}`}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this {activeTab.slice(0, -1)}?
          </p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{getSelectedItem()?.unitNumber}</p>
            <p className="text-sm text-gray-600">
              Status: {getSelectedItem()?.status}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            This action cannot be undone.
          </p>
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

      {/* Location Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setIsLocationModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-indigo-600" />
                    GPS Location - {selectedUnitNumber}
                  </h3>
                  <button
                    onClick={() => setIsLocationModalOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {isFetchingLocation ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                  </div>
                ) : selectedLocation && selectedLocation.latitude !== undefined && selectedLocation.longitude !== undefined ? (
                  <div className="space-y-4">
                    {/* Location Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center">
                        <Navigation className="w-4 h-4 mr-2 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Bearing</div>
                          <div className="text-sm font-medium">{selectedLocation.bearing}°</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Gauge className="w-4 h-4 mr-2 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Speed</div>
                          <div className="text-sm font-medium">
                            {selectedLocation.speed !== null ? `${selectedLocation.speed} mph` : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Fuel className="w-4 h-4 mr-2 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Fuel</div>
                          <div className="text-sm font-medium">
                            {selectedLocation.fuelPercentage !== null ? `${selectedLocation.fuelPercentage}%` : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-500" />
                        <div>
                          <div className="text-xs text-gray-500">Last Update</div>
                          <div className="text-sm font-medium">
                            {new Date(selectedLocation.locatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Driver Info */}
                    {selectedLocation.currentDriverName && (
                      <div className="flex items-center bg-blue-50 p-3 rounded-lg">
                        <User className="w-4 h-4 mr-2 text-blue-600" />
                        <div>
                          <span className="text-sm text-blue-600">Current Driver: </span>
                          <span className="text-sm font-medium text-blue-800">
                            {selectedLocation.currentDriverName}
                          </span>
                          {selectedLocation.currentDriverId && (
                            <span className="text-sm text-blue-600 ml-2">
                              (ID: {selectedLocation.currentDriverId})
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Location Description */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">Location</div>
                      <div className="text-sm font-medium">{selectedLocation.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {selectedLocation.latitude?.toFixed(6)}, {selectedLocation.longitude?.toFixed(6)}
                      </div>
                    </div>

                    {/* Map */}
                    <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
                      <iframe
                        title={`Map for ${selectedUnitNumber}`}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${selectedLocation.latitude},${selectedLocation.longitude}&zoom=14`}
                        allowFullScreen
                      ></iframe>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.latitude},${selectedLocation.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                      >
                        Open in Google Maps
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                    <MapPin className="w-12 h-12 mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No Location Data Available</p>
                    <p className="text-sm">This unit does not have GPS tracking data in Motive.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
