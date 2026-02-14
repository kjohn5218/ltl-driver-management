import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { DataTable, SortDirection } from '../common/DataTable';
import { Search } from '../common/Search';
import { DateRangePicker } from '../common/DateRangePicker';
import { Modal } from '../common/Modal';
import { LoadsheetShipmentsModal } from '../loadsheet/LoadsheetShipmentsModal';
import { CreateLoadsheetModal } from '../loadsheet/CreateLoadsheetModal';
import { loadsheetService } from '../../services/loadsheetService';
import { linehaulTripService } from '../../services/linehaulTripService';
import { linehaulProfileService } from '../../services/linehaulProfileService';
import { equipmentService } from '../../services/equipmentService';
import { driverService } from '../../services/driverService';
import { carrierService } from '../../services/carrierService';
import { locationService } from '../../services/locationService';
import { Loadsheet, CarrierDriver, Carrier, LinehaulTrip, LoadsheetStatus, EquipmentTrailer, LinehaulProfile } from '../../types';
import { toast } from 'react-hot-toast';
import {
  MapPin,
  RefreshCw,
  ArrowRight,
  User,
  Edit,
  Trash2,
  Download,
  Printer,
  Plus,
  AlertTriangle,
  Truck
} from 'lucide-react';
import { RequestContractPowerModal } from './RequestContractPowerModal';

// Load item type combining loadsheet data with additional load/unload info
export interface LoadItem {
  id: number;
  trailerNumber: string;
  manifestNumber: string;
  trailerLength: number; // in feet (28, 40, 45, 48, 53)
  hasPintleHook: boolean;
  trailerCapacity: number; // cubic feet
  currentLoad: number; // current load amount
  weight: number; // in lbs
  pieces: number;
  type: 'LOAD' | 'UNLOAD';
  status: string; // DRAFT, OPEN, LOADING, CLOSED, DISPATCHED, etc.
  originTerminalCode: string;
  destinationTerminalCode: string;
  linehaulName: string;
  door?: string;
  lastScanCategory?: string;
  lastScanTime?: string;
  eta?: string;
  arrivalTime?: string;
  tripNumber?: string;
  loadsheetId?: number;
  scheduledDeparture?: string;
  scheduledDepartDate?: string;
  linehaulTripId?: number;
  doNotLoadPlacardableHazmat?: boolean;
  // Contract Power Request
  contractPowerStatus?: 'REQUESTED' | 'BOOKED';
  contractPowerCarrierName?: string;
  contractPowerDriverName?: string;
  // Reference to the original loadsheet for actions
  originalLoadsheet?: Loadsheet;
}

interface LoadsTabProps {
  loading?: boolean;
  onOpenCreateModal?: () => void;
  selectedLocations?: number[];
}

// Planning data for carrier/driver assignment
interface PlanningData {
  plannedDriverId?: number;
  plannedCarrierId?: number;
}

// Convert loadsheet to LoadItem - preserves actual loadsheet status for planning
const loadsheetToLoadItem = (loadsheet: Loadsheet, index: number): LoadItem => {
  // Parse linehaul name to get origin and destination (e.g., "ATL-MEM" -> origin: ATL, dest: MEM)
  const parts = loadsheet.linehaulName?.split('-') || [];
  const originCode = parts[0] || loadsheet.originTerminalCode || 'UNK';
  const destCode = parts[1] || 'UNK';

  // Capacity data based on trailer length (in lbs)
  const trailerLength = loadsheet.suggestedTrailerLength || 53;
  const capacityMap: Record<number, number> = { 28: 20000, 40: 40000, 43: 40000, 45: 42000, 48: 44000, 53: 45000 };
  const trailerCapacity = capacityMap[trailerLength] || 45000;

  // Use actual pieces/weight if available, otherwise estimate based on capacity
  let loadPercentage = 0;
  if (loadsheet.status === 'DRAFT') loadPercentage = 0;
  else if (loadsheet.status === 'OPEN') loadPercentage = 0.1;
  else if (loadsheet.status === 'LOADING') loadPercentage = 0.5;
  else if (loadsheet.status === 'CLOSED') loadPercentage = 0.9;
  else if (loadsheet.status === 'DISPATCHED') loadPercentage = 0.95;
  else loadPercentage = 0.5;

  // Current load is now weight-based (in lbs)
  const currentLoad = Math.round(trailerCapacity * loadPercentage);

  // Use actual loadsheet pieces/weight if available, otherwise show 0 (no estimate)
  const weight = loadsheet.weight ?? 0;
  const pieces = loadsheet.pieces ?? 0;

  return {
    id: loadsheet.id,
    trailerNumber: loadsheet.trailerNumber || '-',
    manifestNumber: loadsheet.manifestNumber,
    trailerLength,
    hasPintleHook: loadsheet.pintleHookRequired,
    trailerCapacity,
    currentLoad,
    weight,
    pieces,
    type: 'LOAD',
    status: loadsheet.status, // Use actual loadsheet status
    originTerminalCode: originCode,
    destinationTerminalCode: destCode,
    linehaulName: loadsheet.linehaulName,
    door: loadsheet.doorNumber,
    loadsheetId: loadsheet.id,
    scheduledDeparture: loadsheet.targetDispatchTime,
    scheduledDepartDate: loadsheet.scheduledDepartDate,
    linehaulTripId: loadsheet.linehaulTripId,
    doNotLoadPlacardableHazmat: loadsheet.doNotLoadPlacardableHazmat,
    contractPowerStatus: loadsheet.contractPowerStatus,
    contractPowerCarrierName: loadsheet.contractPowerCarrierName,
    contractPowerDriverName: loadsheet.contractPowerDriverName,
    originalLoadsheet: loadsheet
  };
};

// Status badge colors
const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  LOADING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DISPATCHED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  UNLOADING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ARRIVED: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  CONTINUING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
};

// Progress bar component
const CapacityDisplay: React.FC<{ weight: number; capacity: number }> = ({ weight, capacity }) => {
  const percentage = capacity > 0 ? Math.min(100, Math.round((weight / capacity) * 100)) : 0;
  const barColor = percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-blue-500' : 'bg-gray-400';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{percentage}%</span>
        <span>{capacity.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-0.5">
        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export const LoadsTab: React.FC<LoadsTabProps> = ({ loading: externalLoading = false, onOpenCreateModal, selectedLocations = [] }) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<keyof LoadItem | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Planning-related state
  const [planningData, setPlanningData] = useState<Record<number, PlanningData>>({});
  const [continuingTripData, setContinuingTripData] = useState<Record<number, PlanningData>>({});
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(tomorrow);

  // Modal states
  const [isShipmentsModalOpen, setIsShipmentsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isContractPowerModalOpen, setIsContractPowerModalOpen] = useState(false);
  const [selectedLoadItem, setSelectedLoadItem] = useState<LoadItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal form state
  const [editLinehaulName, setEditLinehaulName] = useState('');
  const [editTrailerNumber, setEditTrailerNumber] = useState('');
  const [editStatus, setEditStatus] = useState<LoadsheetStatus>('OPEN');
  const [editDoNotLoadHazmat, setEditDoNotLoadHazmat] = useState(false);
  const [editDoorNumber, setEditDoorNumber] = useState('');
  const [editScheduledDepartDate, setEditScheduledDepartDate] = useState('');
  const [editTargetDispatchTime, setEditTargetDispatchTime] = useState('');
  const [editContractPowerDriverName, setEditContractPowerDriverName] = useState('');
  const [editContractPowerCarrierName, setEditContractPowerCarrierName] = useState('');

  // Fetch drivers
  const { data: driversData } = useQuery({
    queryKey: ['drivers-for-loads-tab'],
    queryFn: async () => {
      const response = await driverService.getDrivers({ limit: 1000 });
      return response.drivers;
    }
  });
  const drivers = driversData || [];

  // Fetch carriers
  const { data: carriersData } = useQuery({
    queryKey: ['carriers-for-loads-tab'],
    queryFn: async () => {
      const response = await carrierService.getCarriers({ status: 'ACTIVE', limit: 500 });
      return response.carriers;
    }
  });
  const carriers = carriersData || [];

  // Fetch trailers for edit modal
  const { data: trailersData } = useQuery({
    queryKey: ['trailers-for-loads-tab'],
    queryFn: async () => {
      const response = await equipmentService.getTrailers({ limit: 500 });
      return response.trailers || [];
    }
  });
  const trailers = trailersData || [];

  // Fetch linehaul profiles for edit modal
  const { data: linehaulProfilesData } = useQuery({
    queryKey: ['linehaul-profiles-for-loads-tab'],
    queryFn: async () => {
      return await linehaulProfileService.getProfilesList();
    }
  });
  const linehaulProfiles = linehaulProfilesData || [];

  // Fetch locations
  const { data: locationsData } = useQuery({
    queryKey: ['locations-for-loads-tab'],
    queryFn: async () => {
      return await locationService.getLocationsList();
    }
  });
  const locations = locationsData || [];

  // Fetch loadsheets from the API
  const { data: loadsheetsData, isLoading, refetch } = useQuery({
    queryKey: ['loadsheets-for-loads-tab', startDate, endDate],
    queryFn: async () => {
      const response = await loadsheetService.getLoadsheets({
        limit: 100,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      return response.loadsheets;
    }
  });

  // Fetch continuing trips (arrived and will continue)
  const { data: continuingTripsData, refetch: refetchContinuingTrips } = useQuery({
    queryKey: ['continuing-trips-for-loads-tab', selectedLocations],
    queryFn: async () => {
      const response = await linehaulTripService.getTrips({
        status: 'ARRIVED',
        limit: 100
      });

      let arrivedTrips = response.trips;

      // Filter to trips that arrived at one of the selected origins
      if (selectedLocations.length > 0) {
        arrivedTrips = arrivedTrips.filter(trip => {
          const destinationId = trip.linehaulProfile?.destinationTerminalId;
          return destinationId && selectedLocations.includes(destinationId);
        });
      }

      return arrivedTrips;
    }
  });
  const continuingTrips = continuingTripsData || [];

  // Convert loadsheets to LoadItems with origin filtering - show all loadsheets for planning
  const loads = useMemo(() => {
    if (!loadsheetsData) return [];
    let filtered = loadsheetsData;

    // Filter by selected origins
    if (selectedLocations.length > 0) {
      const selectedCodes = selectedLocations.map(id =>
        locations.find(l => l.id === id)?.code
      ).filter(Boolean);

      filtered = filtered.filter(ls => {
        if (ls.originTerminalId && selectedLocations.includes(ls.originTerminalId)) {
          return true;
        }
        if (ls.originTerminalCode && selectedCodes.includes(ls.originTerminalCode)) {
          return true;
        }
        return false;
      });
    }

    return filtered.map((ls, index) => loadsheetToLoadItem(ls, index));
  }, [loadsheetsData, selectedLocations, locations]);

  const handleSort = (column: keyof LoadItem) => {
    if (sortBy === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortBy(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortBy(column);
      setSortDirection('asc');
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

  // Open shipments modal
  const openShipmentsModal = (loadItem: LoadItem) => {
    setSelectedLoadItem(loadItem);
    setIsShipmentsModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (loadItem: LoadItem) => {
    setSelectedLoadItem(loadItem);
    setEditLinehaulName(loadItem.linehaulName || '');
    setEditTrailerNumber(loadItem.trailerNumber || '');
    setEditStatus(loadItem.status as LoadsheetStatus);
    setEditDoNotLoadHazmat(loadItem.doNotLoadPlacardableHazmat || false);
    setEditDoorNumber(loadItem.door || '');
    setEditScheduledDepartDate(loadItem.scheduledDepartDate || '');
    setEditTargetDispatchTime(loadItem.scheduledDeparture || '');
    setEditContractPowerDriverName(loadItem.contractPowerDriverName || '');
    setEditContractPowerCarrierName(loadItem.contractPowerCarrierName || '');
    setIsEditModalOpen(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!selectedLoadItem) return;

    if (!editTrailerNumber || !editLinehaulName) {
      toast.error('Trailer number and linehaul name are required');
      return;
    }

    try {
      setSaving(true);
      await loadsheetService.updateLoadsheet(selectedLoadItem.id, {
        trailerNumber: editTrailerNumber,
        linehaulName: editLinehaulName,
        status: editStatus,
        doNotLoadPlacardableHazmat: editDoNotLoadHazmat,
        doorNumber: editDoorNumber || undefined,
        scheduledDepartDate: editScheduledDepartDate || undefined,
        targetDispatchTime: editTargetDispatchTime || undefined,
        contractPowerDriverName: editContractPowerDriverName || undefined,
        contractPowerCarrierName: editContractPowerCarrierName || undefined
      });
      toast.success('Loadsheet updated successfully');
      setIsEditModalOpen(false);
      setSelectedLoadItem(null);
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update loadsheet');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedLoadItem) return;
    try {
      setDeleting(true);
      await loadsheetService.deleteLoadsheet(selectedLoadItem.id);
      toast.success('Loadsheet deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedLoadItem(null);
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete loadsheet');
    } finally {
      setDeleting(false);
    }
  };

  // Handle download PDF
  const handleDownload = async (loadItem: LoadItem) => {
    try {
      const blob = await loadsheetService.downloadLoadsheet(loadItem.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loadsheet-${loadItem.manifestNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Loadsheet downloaded');
    } catch (error) {
      toast.error('Failed to download loadsheet');
    }
  };

  // Handle print
  const handlePrint = async (loadItem: LoadItem) => {
    try {
      toast.loading('Preparing print...', { id: 'print-loading' });
      const blob = await loadsheetService.downloadLoadsheet(loadItem.id);
      const url = window.URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;

      iframe.onload = () => {
        toast.dismiss('print-loading');
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            window.open(url, '_blank');
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        }, 500);
      };

      document.body.appendChild(iframe);
    } catch (error) {
      toast.dismiss('print-loading');
      toast.error('Failed to print loadsheet');
    }
  };

  // Filter loads
  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesTrailer = load.trailerNumber.toLowerCase().includes(search);
        const matchesManifest = load.manifestNumber.toLowerCase().includes(search);
        const matchesLinehaul = load.linehaulName?.toLowerCase().includes(search);
        const matchesOrigin = load.originTerminalCode.toLowerCase().includes(search);
        const matchesDest = load.destinationTerminalCode.toLowerCase().includes(search);
        if (!matchesTrailer && !matchesManifest && !matchesLinehaul && !matchesOrigin && !matchesDest) {
          return false;
        }
      }

      // Status filter
      if (statusFilter && load.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [loads, searchTerm, statusFilter]);

  // Sort filtered loads
  const sortedLoads = useMemo(() => {
    if (!sortBy || !sortDirection) return filteredLoads;

    return [...filteredLoads].sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLoads, sortBy, sortDirection]);

  // Count by status
  const draftCount = loads.filter(l => l.status === 'DRAFT').length;
  const openCount = loads.filter(l => l.status === 'OPEN').length;
  const loadingCount = loads.filter(l => l.status === 'LOADING').length;
  const closedCount = loads.filter(l => l.status === 'CLOSED').length;
  const dispatchedCount = loads.filter(l => l.status === 'DISPATCHED').length;

  const columns = [
    {
      header: 'Trailer',
      accessor: 'trailerNumber' as keyof LoadItem,
      sortable: true,
      width: 'w-36',
      cell: (load: LoadItem) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{load.trailerNumber}</div>
          <div className="text-xs text-gray-500">{load.trailerLength}′</div>
        </div>
      )
    },
    {
      header: 'Door',
      accessor: 'door' as keyof LoadItem,
      sortable: true,
      width: 'w-20',
      cell: (load: LoadItem) => <span className="text-gray-600 dark:text-gray-300">{load.door || '-'}</span>
    },
    {
      header: 'Manifest',
      accessor: 'manifestNumber' as keyof LoadItem,
      sortable: true,
      width: 'w-44',
      cell: (load: LoadItem) => (
        <button
          type="button"
          onClick={() => openShipmentsModal(load)}
          className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
        >
          {load.manifestNumber}
        </button>
      )
    },
    {
      header: 'Linehaul',
      accessor: 'linehaulName' as keyof LoadItem,
      sortable: true,
      width: 'w-48',
      cell: (load: LoadItem) => <span className="text-gray-900 dark:text-gray-100">{load.linehaulName}</span>
    },
    {
      header: 'Cap',
      accessor: 'trailerCapacity' as keyof LoadItem,
      sortable: true,
      width: 'w-40',
      cell: (load: LoadItem) => (
        <div className="min-w-[80px]">
          <CapacityDisplay weight={load.weight} capacity={load.trailerCapacity} />
        </div>
      )
    },
    {
      header: 'Wt',
      accessor: 'weight' as keyof LoadItem,
      sortable: true,
      width: 'w-32',
      cell: (load: LoadItem) => <span className="text-gray-600 dark:text-gray-300 text-xs">{load.weight.toLocaleString()}</span>
    },
    {
      header: 'Pcs',
      accessor: 'pieces' as keyof LoadItem,
      sortable: true,
      width: 'w-20',
      cell: (load: LoadItem) => <span className="text-gray-600 dark:text-gray-300 text-xs">{load.pieces}</span>
    },
    {
      header: 'Status',
      accessor: 'status' as keyof LoadItem,
      sortable: true,
      width: 'w-36',
      cell: (load: LoadItem) => (
        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${statusColors[load.status]}`}>
          {load.status}
        </span>
      )
    },
    {
      header: 'Sched',
      accessor: 'scheduledDepartDate' as keyof LoadItem,
      sortable: true,
      width: 'w-36',
      cell: (load: LoadItem) => {
        if (!load.scheduledDepartDate) return <span className="text-gray-400">-</span>;

        // Check if overdue (date/time has passed and not DISPATCHED)
        let isOverdue = false;
        if (load.status !== 'DISPATCHED') {
          const now = new Date();
          const scheduledDate = new Date(load.scheduledDepartDate + 'T00:00:00');

          if (load.scheduledDeparture) {
            const [hours, minutes] = load.scheduledDeparture.split(':').map(Number);
            scheduledDate.setHours(hours, minutes, 0, 0);
          } else {
            scheduledDate.setHours(23, 59, 59, 999);
          }

          isOverdue = now > scheduledDate;
        }

        const [year, month, day] = load.scheduledDepartDate.split('-');
        const textColorClass = isOverdue
          ? 'text-red-600 dark:text-red-400 font-medium'
          : 'text-gray-600 dark:text-gray-300';

        // Combine date and time
        let timeStr = '';
        if (load.scheduledDeparture) {
          const [hours, minutes] = load.scheduledDeparture.split(':').map(Number);
          if (!isNaN(hours) && !isNaN(minutes)) {
            const period = hours >= 12 ? 'P' : 'A';
            const displayHours = hours % 12 || 12;
            timeStr = ` ${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
          }
        }

        return (
          <span className={`text-xs ${textColorClass}`}>
            {month}/{day}{timeStr}
          </span>
        );
      }
    },
    {
      header: 'Planned Driver',
      accessor: 'id' as keyof LoadItem,
      sortable: false,
      width: 'w-[420px]',
      cell: (load: LoadItem) => (
        <div className="flex items-center gap-2">
          {/* Show contract power status if requested/booked */}
          {load.contractPowerStatus === 'BOOKED' ? (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                {load.contractPowerDriverName || 'TBD'}
              </span>
              {load.contractPowerCarrierName && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {load.contractPowerCarrierName}
                </span>
              )}
            </div>
          ) : load.contractPowerStatus === 'REQUESTED' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              <Truck className="w-3 h-3 mr-1" />
              Requested
            </span>
          ) : (
            <>
              <select
                value={planningData[load.id]?.plannedDriverId || ''}
                onChange={(e) => updatePlanningData(load.id, 'plannedDriverId', e.target.value ? parseInt(e.target.value) : undefined)}
                className="flex-1 min-w-0 text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1"
              >
                <option value="">Select...</option>
                {drivers
                  .filter(d => d.active && (!planningData[load.id]?.plannedCarrierId || d.carrierId === planningData[load.id]?.plannedCarrierId))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}{driver.number ? ` (${driver.number})` : ''}</option>
                  ))}
              </select>
              <button
                onClick={() => {
                  setSelectedLoadItem(load);
                  setIsContractPowerModalOpen(true);
                }}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 rounded hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 whitespace-nowrap flex-shrink-0"
                title="Request Contract Power"
              >
                <Truck className="w-3 h-3 mr-1" />
                Request Contract Power
              </button>
            </>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      accessor: 'loadsheetId' as keyof LoadItem,
      sortable: false,
      cell: (load: LoadItem) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditModal(load)}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handlePrint(load)}
            className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
            title="Print"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDownload(load)}
            className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {load.status === 'OPEN' && (
            <button
              onClick={() => {
                setSelectedLoadItem(load);
                setIsDeleteModalOpen(true);
              }}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const isLoadingData = externalLoading || isLoading;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      {/* Header with summary stats */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Loadsheets</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">All loadsheets for planning and dispatch</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => onOpenCreateModal ? onOpenCreateModal() : setIsCreateModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3 h-3 mr-1" />
              New Loadsheet
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </button>
            <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{draftCount} Draft</span>
            <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{openCount} Open</span>
            <span className="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">{loadingCount} Loading</span>
            <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{closedCount} Closed</span>
            <span className="px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{dispatchedCount} Dispatched</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Search
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm py-1"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="OPEN">Open</option>
            <option value="LOADING">Loading</option>
            <option value="CLOSED">Closed</option>
            <option value="DISPATCHED">Dispatched</option>
          </select>

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

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredLoads.length} load{filteredLoads.length !== 1 ? 's' : ''}
            {selectedLocations.length > 0 && ` from ${selectedLocations.map(id => locations.find(l => l.id === id)?.code).filter(Boolean).join(', ')}`}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={sortedLoads}
        loading={isLoadingData}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Continuing Trips Section - trips that arrived and will continue */}
      {continuingTrips.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
            <div className="flex items-center">
              <ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Arrived Trips Continuing ({continuingTrips.length})
              </span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              These trips have arrived and will continue to another destination
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Trailer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Door</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Manifest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Linehaul</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Wt (lbs)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pcs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Arrived At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sched. Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sched. Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Planned Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {continuingTrips.flatMap((trip) => {
                  // Get loadsheets for this trip
                  const tripLoadsheets = trip.loadsheets || [];
                  if (tripLoadsheets.length === 0) {
                    // Show a placeholder row if no loadsheets
                    return [(
                      <tr key={trip.id} className="hover:bg-amber-50 dark:hover:bg-amber-900/10">
                        <td className="px-4 py-3 text-gray-500" colSpan={13}>
                          Trip {trip.tripNumber} - No loadsheets
                        </td>
                      </tr>
                    )];
                  }
                  return tripLoadsheets.map((loadsheet: Loadsheet) => {
                    const loadItem = loadsheetToLoadItem(loadsheet, 0);
                    const arrivedAt = trip.linehaulProfile?.destinationTerminal?.code || '-';

                    return (
                      <tr key={`${trip.id}-${loadsheet.id}`} className="hover:bg-amber-50 dark:hover:bg-amber-900/10">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{loadItem.trailerNumber}</div>
                            <div className="text-xs text-gray-500">{loadItem.trailerLength}′</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {loadItem.door || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLoadItem(loadItem);
                              setIsShipmentsModalOpen(true);
                            }}
                            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline cursor-pointer"
                          >
                            {loadItem.manifestNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-gray-100">
                          {loadItem.linehaulName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="min-w-[100px]">
                            <CapacityDisplay weight={loadItem.weight} capacity={loadItem.trailerCapacity} />
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {loadItem.weight.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                          {loadItem.pieces}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[loadItem.status]}`}>
                            {loadItem.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                            {arrivedAt}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {loadItem.scheduledDepartDate ? (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {loadItem.scheduledDepartDate.split('-').slice(1).join('/')}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {loadItem.scheduledDeparture ? (
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {(() => {
                                const [hours, minutes] = loadItem.scheduledDeparture.split(':').map(Number);
                                if (isNaN(hours) || isNaN(minutes)) return '-';
                                const period = hours >= 12 ? 'PM' : 'AM';
                                const displayHours = hours % 12 || 12;
                                return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
                              })()}
                            </span>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={continuingTripData[trip.id]?.plannedDriverId || ''}
                            onChange={(e) => updateContinuingTripData(
                              trip.id,
                              'plannedDriverId',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )}
                            className="w-28 text-xs rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 py-1"
                          >
                            <option value="">Select...</option>
                            {drivers
                              .filter(d => d.active && (!continuingTripData[trip.id]?.plannedCarrierId || d.carrierId === continuingTripData[trip.id]?.plannedCarrierId))
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.name}{driver.number ? ` (${driver.number})` : ''}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(loadItem)}
                              className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrint(loadItem)}
                              className="p-1 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                              title="Print"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDownload(loadItem)}
                              className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {loadItem.status === 'OPEN' && (
                              <button
                                onClick={() => {
                                  setSelectedLoadItem(loadItem);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shipments Modal */}
      <LoadsheetShipmentsModal
        isOpen={isShipmentsModalOpen}
        onClose={() => {
          setIsShipmentsModalOpen(false);
          setSelectedLoadItem(null);
        }}
        loadsheet={selectedLoadItem?.originalLoadsheet || null}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedLoadItem(null);
        }}
        title="Delete Loadsheet"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to delete loadsheet{' '}
            <span className="font-semibold">{selectedLoadItem?.manifestNumber}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedLoadItem(null);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Loadsheet Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLoadItem(null);
        }}
        title={`Edit Loadsheet ${selectedLoadItem?.manifestNumber || ''}`}
      >
        <div className="space-y-4">
          {/* Linehaul Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Linehaul Name *
            </label>
            <select
              value={editLinehaulName}
              onChange={(e) => setEditLinehaulName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select linehaul...</option>
              {linehaulProfiles.map((profile) => (
                <option key={profile.id} value={profile.name || profile.profileCode}>
                  {profile.name || profile.profileCode}
                </option>
              ))}
            </select>
          </div>

          {/* Trailer Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trailer Number *
            </label>
            <select
              value={editTrailerNumber}
              onChange={(e) => setEditTrailerNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select trailer...</option>
              {trailers.map((trailer) => (
                <option key={trailer.id} value={trailer.unitNumber}>
                  {trailer.unitNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status *
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as LoadsheetStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="LOADING">Loading</option>
              <option value="CLOSED">Closed</option>
              <option value="DISPATCHED">Dispatched</option>
            </select>
          </div>

          {/* Door Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Door Number
            </label>
            <input
              type="text"
              value={editDoorNumber}
              onChange={(e) => setEditDoorNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter door number"
            />
          </div>

          {/* Scheduled Depart Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Scheduled Depart Date
            </label>
            <input
              type="date"
              value={editScheduledDepartDate}
              onChange={(e) => setEditScheduledDepartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Scheduled Depart Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Scheduled Depart Time
            </label>
            <input
              type="time"
              value={editTargetDispatchTime}
              onChange={(e) => setEditTargetDispatchTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Contract Power Driver/Carrier - only show if booked */}
          {selectedLoadItem?.contractPowerStatus === 'BOOKED' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Contract Power Assignment
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={editContractPowerDriverName}
                  onChange={(e) => setEditContractPowerDriverName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter driver name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Carrier Name
                </label>
                <input
                  type="text"
                  value={editContractPowerCarrierName}
                  onChange={(e) => setEditContractPowerCarrierName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter carrier name"
                />
              </div>
            </div>
          )}

          {/* Hazmat Checkbox */}
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editDoNotLoadHazmat}
                onChange={(e) => setEditDoNotLoadHazmat(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-yellow-600 rounded focus:ring-yellow-500"
              />
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Do Not Load Placardable Hazmat
                  </span>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    Alert scanning app that hazmat requiring endorsement cannot be loaded on this trailer.
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedLoadItem(null);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Loadsheet Modal */}
      <CreateLoadsheetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Request Contract Power Modal */}
      <RequestContractPowerModal
        isOpen={isContractPowerModalOpen}
        onClose={() => {
          setIsContractPowerModalOpen(false);
          setSelectedLoadItem(null);
        }}
        loadItem={selectedLoadItem}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
