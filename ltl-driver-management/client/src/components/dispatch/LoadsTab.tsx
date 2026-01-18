import React, { useState, useMemo } from 'react';
import { DataTable, SortDirection } from '../common/DataTable';
import { Search } from '../common/Search';
import {
  Container,
  Scale,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Truck,
  Clock,
  MapPin,
  Link2,
  Ruler
} from 'lucide-react';

// Load item type representing a trailer load/unload operation
export interface LoadItem {
  id: number;
  trailerNumber: string;
  manifestNumber: string;
  trailerLength: number; // in feet (28, 40, 45, 48, 53)
  hasPintleHook: boolean;
  trailerCapacity: number; // cubic feet or linear feet
  currentLoad: number; // current load amount
  weight: number; // in lbs
  pieces: number;
  type: 'LOAD' | 'UNLOAD';
  status: 'LOADING' | 'UNLOADING' | 'ARRIVED' | 'CONTINUING';
  originTerminalCode: string;
  destinationTerminalCode: string;
  profileCode: string;
  profileName?: string;
  door?: string;
  lastScanCategory?: string; // LHLOAD, LHUNLOAD, etc.
  lastScanTime?: string;
  eta?: string;
  arrivalTime?: string;
  tripNumber?: string;
}

interface LoadsTabProps {
  loading?: boolean;
}

// Mock data for the loads tab
const generateMockLoads = (): LoadItem[] => {
  return [
    // Trailers currently loading
    {
      id: 1,
      trailerNumber: 'TR-5421',
      manifestNumber: 'ATL-MIA-0117-01',
      trailerLength: 53,
      hasPintleHook: false,
      trailerCapacity: 2800,
      currentLoad: 1680,
      weight: 28450,
      pieces: 124,
      type: 'LOAD',
      status: 'LOADING',
      originTerminalCode: 'ATL',
      destinationTerminalCode: 'MIA',
      profileCode: 'ATL-MIA-01',
      profileName: 'Atlanta to Miami Express',
      door: 'D-15',
      lastScanCategory: 'LHLOAD',
      lastScanTime: '10:45 AM'
    },
    {
      id: 2,
      trailerNumber: 'TR-8834',
      manifestNumber: 'ATL-DAL-0117-01',
      trailerLength: 53,
      hasPintleHook: true,
      trailerCapacity: 2800,
      currentLoad: 2240,
      weight: 38200,
      pieces: 186,
      type: 'LOAD',
      status: 'LOADING',
      originTerminalCode: 'ATL',
      destinationTerminalCode: 'DAL',
      profileCode: 'ATL-DAL-01',
      profileName: 'Atlanta to Dallas Overnight',
      door: 'D-22',
      lastScanCategory: 'LHLOAD',
      lastScanTime: '10:52 AM'
    },
    {
      id: 3,
      trailerNumber: 'TR-2209',
      manifestNumber: 'ATL-CHI-0117-01',
      trailerLength: 45,
      hasPintleHook: false,
      trailerCapacity: 2400,
      currentLoad: 720,
      weight: 12800,
      pieces: 48,
      type: 'LOAD',
      status: 'LOADING',
      originTerminalCode: 'ATL',
      destinationTerminalCode: 'CHI',
      profileCode: 'ATL-CHI-01',
      profileName: 'Atlanta to Chicago Direct',
      door: 'D-08',
      lastScanCategory: 'LHLOAD',
      lastScanTime: '11:02 AM'
    },
    // Arrived trailers needing unload
    {
      id: 4,
      trailerNumber: 'TR-6612',
      manifestNumber: 'MIA-ATL-0116-02',
      trailerLength: 53,
      hasPintleHook: true,
      trailerCapacity: 2800,
      currentLoad: 2520,
      weight: 42100,
      pieces: 205,
      type: 'UNLOAD',
      status: 'UNLOADING',
      originTerminalCode: 'MIA',
      destinationTerminalCode: 'ATL',
      profileCode: 'MIA-ATL-01',
      profileName: 'Miami to Atlanta Express',
      door: 'D-03',
      lastScanCategory: 'LHUNLOAD',
      lastScanTime: '10:38 AM',
      arrivalTime: '08:45 AM',
      tripNumber: 'MIA-ATL-2026-0892'
    },
    {
      id: 5,
      trailerNumber: 'TR-1147',
      manifestNumber: 'DAL-ATL-0116-01',
      trailerLength: 48,
      hasPintleHook: false,
      trailerCapacity: 2400,
      currentLoad: 960,
      weight: 18500,
      pieces: 78,
      type: 'UNLOAD',
      status: 'UNLOADING',
      originTerminalCode: 'DAL',
      destinationTerminalCode: 'ATL',
      profileCode: 'DAL-ATL-01',
      profileName: 'Dallas to Atlanta Overnight',
      door: 'D-05',
      lastScanCategory: 'LHUNLOAD',
      lastScanTime: '10:25 AM',
      arrivalTime: '06:30 AM',
      tripNumber: 'DAL-ATL-2026-0885'
    },
    {
      id: 6,
      trailerNumber: 'TR-9903',
      manifestNumber: 'CHI-ATL-0116-01',
      trailerLength: 53,
      hasPintleHook: false,
      trailerCapacity: 2800,
      currentLoad: 2100,
      weight: 35600,
      pieces: 167,
      type: 'UNLOAD',
      status: 'ARRIVED',
      originTerminalCode: 'CHI',
      destinationTerminalCode: 'ATL',
      profileCode: 'CHI-ATL-01',
      profileName: 'Chicago to Atlanta Direct',
      arrivalTime: '10:15 AM',
      tripNumber: 'CHI-ATL-2026-0901'
    },
    // Arrived and will continue to next destination
    {
      id: 7,
      trailerNumber: 'TR-3356',
      manifestNumber: 'NYC-MIA-0116-01',
      trailerLength: 53,
      hasPintleHook: true,
      trailerCapacity: 2800,
      currentLoad: 2660,
      weight: 44800,
      pieces: 212,
      type: 'LOAD',
      status: 'CONTINUING',
      originTerminalCode: 'NYC',
      destinationTerminalCode: 'MIA',
      profileCode: 'NYC-MIA-01',
      profileName: 'New York to Miami via Atlanta',
      arrivalTime: '07:20 AM',
      eta: '11:30 PM',
      tripNumber: 'NYC-MIA-2026-0879'
    },
    {
      id: 8,
      trailerNumber: 'TR-7741',
      manifestNumber: 'SEA-DAL-0116-01',
      trailerLength: 48,
      hasPintleHook: true,
      trailerCapacity: 2400,
      currentLoad: 2280,
      weight: 38400,
      pieces: 189,
      type: 'LOAD',
      status: 'CONTINUING',
      originTerminalCode: 'SEA',
      destinationTerminalCode: 'DAL',
      profileCode: 'SEA-DAL-01',
      profileName: 'Seattle to Dallas via Atlanta',
      arrivalTime: '09:05 AM',
      eta: '06:00 AM',
      tripNumber: 'SEA-DAL-2026-0888'
    },
    // More loading trailers
    {
      id: 9,
      trailerNumber: 'TR-5528',
      manifestNumber: 'ATL-NYC-0117-01',
      trailerLength: 53,
      hasPintleHook: false,
      trailerCapacity: 2800,
      currentLoad: 560,
      weight: 9200,
      pieces: 35,
      type: 'LOAD',
      status: 'LOADING',
      originTerminalCode: 'ATL',
      destinationTerminalCode: 'NYC',
      profileCode: 'ATL-NYC-01',
      profileName: 'Atlanta to New York Express',
      door: 'D-18',
      lastScanCategory: 'LHLOAD',
      lastScanTime: '11:08 AM'
    },
    {
      id: 10,
      trailerNumber: 'TR-4412',
      manifestNumber: 'ATL-LAX-0117-01',
      trailerLength: 45,
      hasPintleHook: true,
      trailerCapacity: 2400,
      currentLoad: 1920,
      weight: 32100,
      pieces: 145,
      type: 'LOAD',
      status: 'LOADING',
      originTerminalCode: 'ATL',
      destinationTerminalCode: 'LAX',
      profileCode: 'ATL-LAX-01',
      profileName: 'Atlanta to Los Angeles Overnight',
      door: 'D-25',
      lastScanCategory: 'LHLOAD',
      lastScanTime: '10:58 AM'
    },
    // Unloading trailers
    {
      id: 11,
      trailerNumber: 'TR-8821',
      manifestNumber: 'LAX-ATL-0116-01',
      trailerLength: 53,
      hasPintleHook: false,
      trailerCapacity: 2800,
      currentLoad: 840,
      weight: 14200,
      pieces: 62,
      type: 'UNLOAD',
      status: 'UNLOADING',
      originTerminalCode: 'LAX',
      destinationTerminalCode: 'ATL',
      profileCode: 'LAX-ATL-01',
      profileName: 'Los Angeles to Atlanta Express',
      door: 'D-07',
      lastScanCategory: 'LHUNLOAD',
      lastScanTime: '10:42 AM',
      arrivalTime: '05:45 AM',
      tripNumber: 'LAX-ATL-2026-0872'
    },
    {
      id: 12,
      trailerNumber: 'TR-2295',
      manifestNumber: 'NYC-ATL-0116-02',
      trailerLength: 28,
      hasPintleHook: true,
      trailerCapacity: 2400,
      currentLoad: 480,
      weight: 8100,
      pieces: 28,
      type: 'UNLOAD',
      status: 'UNLOADING',
      originTerminalCode: 'NYC',
      destinationTerminalCode: 'ATL',
      profileCode: 'NYC-ATL-01',
      profileName: 'New York to Atlanta Direct',
      door: 'D-11',
      lastScanCategory: 'LHUNLOAD',
      lastScanTime: '10:55 AM',
      arrivalTime: '07:00 AM',
      tripNumber: 'NYC-ATL-2026-0880'
    }
  ];
};

// Status badge colors
const statusColors: Record<string, string> = {
  LOADING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  UNLOADING: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  ARRIVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CONTINUING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
};

// Type badge colors
const typeColors: Record<string, string> = {
  LOAD: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  UNLOAD: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
};

// Progress bar component
const ProgressBar: React.FC<{ current: number; max: number; type: 'LOAD' | 'UNLOAD' }> = ({ current, max, type }) => {
  const percentage = Math.min(100, Math.round((current / max) * 100));
  const isHighCapacity = percentage >= 80;

  // For unloading, we show how much is left to unload (inverse)
  const displayPercentage = type === 'UNLOAD' ? percentage : percentage;
  const barColor = type === 'UNLOAD'
    ? 'bg-amber-500'
    : isHighCapacity
      ? 'bg-green-500'
      : 'bg-blue-500';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{current.toLocaleString()} / {max.toLocaleString()} cu ft</span>
        <span className="font-medium">{displayPercentage}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>
    </div>
  );
};

export const LoadsTab: React.FC<LoadsTabProps> = ({ loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LOAD' | 'UNLOAD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<keyof LoadItem | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Get mock data
  const loads = useMemo(() => generateMockLoads(), []);

  // Get unique locations from loads (both origin and destination)
  const uniqueLocations = useMemo(() => {
    const locationSet = new Set<string>();
    loads.forEach(load => {
      locationSet.add(load.originTerminalCode);
      locationSet.add(load.destinationTerminalCode);
    });
    return Array.from(locationSet).sort();
  }, [loads]);

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

  // Filter loads
  const filteredLoads = useMemo(() => {
    return loads.filter(load => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesTrailer = load.trailerNumber.toLowerCase().includes(search);
        const matchesManifest = load.manifestNumber.toLowerCase().includes(search);
        const matchesProfile = load.profileCode.toLowerCase().includes(search);
        const matchesProfileName = load.profileName?.toLowerCase().includes(search);
        const matchesOrigin = load.originTerminalCode.toLowerCase().includes(search);
        const matchesDest = load.destinationTerminalCode.toLowerCase().includes(search);
        const matchesTrip = load.tripNumber?.toLowerCase().includes(search);
        if (!matchesTrailer && !matchesManifest && !matchesProfile && !matchesProfileName && !matchesOrigin && !matchesDest && !matchesTrip) {
          return false;
        }
      }

      // Type filter
      if (typeFilter !== 'ALL' && load.type !== typeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter && load.status !== statusFilter) {
        return false;
      }

      // Location filter - matches origin OR destination
      if (locationFilter && load.originTerminalCode !== locationFilter && load.destinationTerminalCode !== locationFilter) {
        return false;
      }

      return true;
    });
  }, [loads, searchTerm, typeFilter, statusFilter, locationFilter]);

  // Sort filtered loads
  const sortedLoads = useMemo(() => {
    if (!sortBy || !sortDirection) return filteredLoads;

    return [...filteredLoads].sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      // Handle null/undefined values
      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Numeric comparison
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLoads, sortBy, sortDirection]);

  // Count by status
  const loadingCount = loads.filter(l => l.status === 'LOADING').length;
  const unloadingCount = loads.filter(l => l.status === 'UNLOADING' || l.status === 'ARRIVED').length;
  const continuingCount = loads.filter(l => l.status === 'CONTINUING').length;

  const columns = [
    {
      header: 'Trailer #',
      accessor: 'trailerNumber' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="flex items-center">
          <Container className="w-4 h-4 mr-2 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{load.trailerNumber}</div>
            {load.door && (
              <div className="text-xs text-gray-500 dark:text-gray-400">Door: {load.door}</div>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Length',
      accessor: 'trailerLength' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Ruler className="w-4 h-4 mr-1" />
          {load.trailerLength}′
        </div>
      )
    },
    {
      header: 'Pintle',
      accessor: 'hasPintleHook' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        load.hasPintleHook ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <Link2 className="w-3 h-3 mr-1" />
            Yes
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500 text-sm">No</span>
        )
      )
    },
    {
      header: 'Manifest #',
      accessor: 'manifestNumber' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div>
          <div className="font-medium text-indigo-600 dark:text-indigo-400">{load.manifestNumber}</div>
          {load.tripNumber && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip: {load.tripNumber}</div>
          )}
        </div>
      )
    },
    {
      header: 'Profile',
      accessor: 'profileCode' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="flex items-center">
          <Truck className="w-4 h-4 mr-2 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{load.profileCode}</div>
            {load.profileName && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{load.profileName}</div>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Capacity',
      accessor: 'trailerCapacity' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="min-w-[180px]">
          <ProgressBar
            current={load.currentLoad}
            max={load.trailerCapacity}
            type={load.type}
          />
        </div>
      )
    },
    {
      header: 'Weight',
      accessor: 'weight' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Scale className="w-4 h-4 mr-1" />
          {load.weight.toLocaleString()} lbs
        </div>
      )
    },
    {
      header: 'Pieces',
      accessor: 'pieces' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div className="flex items-center text-gray-600 dark:text-gray-300">
          <Package className="w-4 h-4 mr-1" />
          {load.pieces}
        </div>
      )
    },
    {
      header: 'Type',
      accessor: 'type' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[load.type]}`}>
          {load.type === 'LOAD' ? (
            <>
              <ArrowDownToLine className="w-3 h-3 mr-1" />
              Load
            </>
          ) : (
            <>
              <ArrowUpFromLine className="w-3 h-3 mr-1" />
              Unload
            </>
          )}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status' as keyof LoadItem,
      sortable: true,
      cell: (load: LoadItem) => (
        <div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[load.status]}`}>
            {load.status === 'LOADING' && 'Loading'}
            {load.status === 'UNLOADING' && 'Unloading'}
            {load.status === 'ARRIVED' && 'Arrived'}
            {load.status === 'CONTINUING' && 'Continuing'}
          </span>
          {load.lastScanTime && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Last scan: {load.lastScanTime}
            </div>
          )}
          {load.arrivalTime && load.status !== 'LOADING' && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Arrived: {load.arrivalTime}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      {/* Header with summary stats */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Active Loads</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Trailers currently loading, unloading, or continuing
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <ArrowDownToLine className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{loadingCount} Loading</span>
            </div>
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <ArrowUpFromLine className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{unloadingCount} Unloading</span>
            </div>
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{continuingCount} Continuing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64">
            <Search
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search trailers, manifests..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | 'LOAD' | 'UNLOAD')}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
            >
              <option value="ALL">All Types</option>
              <option value="LOAD">Loading Only</option>
              <option value="UNLOAD">Unloading Only</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="LOADING">Loading</option>
            <option value="UNLOADING">Unloading</option>
            <option value="ARRIVED">Arrived</option>
            <option value="CONTINUING">Continuing</option>
          </select>

          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredLoads.length} load{filteredLoads.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={sortedLoads}
        loading={loading}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
};
