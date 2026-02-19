import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, SortDirection } from '../common/DataTable';
import { TablePagination } from '../common/TablePagination';
import { Search } from '../common/Search';
import { CarrierDriver, DriverStatus, Carrier } from '../../types';
import { driverService } from '../../services/driverService';
import { carrierService } from '../../services/carrierService';
import { Phone, User, MapPin, Shield, Building2, RefreshCw, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DriversTabProps {
  onDriverSelect?: (driver: CarrierDriver) => void;
  selectedLocations?: number[];
}

// Available endorsement types
const ENDORSEMENT_OPTIONS = ['hazmat', 'tanker', 'lcv', 'doubles', 'triples'];

const driverStatusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  UNAVAILABLE: 'bg-gray-100 text-gray-800',
  DISPATCHED: 'bg-blue-100 text-blue-800'
};

const formatDriverStatus = (status: string): string => {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const DriversTab: React.FC<DriversTabProps> = ({ onDriverSelect: _onDriverSelect, selectedLocations = [] }) => {
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [sortBy, setSortBy] = useState<keyof CarrierDriver | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Filter state
  const [carrierFilter, setCarrierFilter] = useState<number | ''>('');
  const [endorsementFilter, setEndorsementFilter] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<DriverStatus | ''>('');

  const fetchDrivers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await driverService.getDrivers({
        search: searchTerm || undefined,
        carrierId: carrierFilter || undefined,
        active: true,
        page: currentPage,
        limit: 50
      });
      setDrivers(response.drivers);
      setTotalPages(response.pagination.pages);
      setTotalDrivers(response.pagination.total);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
      toast.error('Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, currentPage, carrierFilter]);

  const fetchCarriers = useCallback(async () => {
    try {
      const response = await carrierService.getCarriers({ limit: 1000 });
      setCarriers(response.carriers);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await driverService.syncDrivers();
      if (result.success) {
        toast.success(result.message);
        fetchDrivers();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to sync drivers';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSort = (column: keyof CarrierDriver) => {
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

  // Client-side filtering for location, endorsements, and availability (after server-side search)
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      // Filter by location
      if (selectedLocations.length > 0) {
        if (!d.locationId || !selectedLocations.includes(d.locationId)) return false;
      }
      // Filter by endorsement
      if (endorsementFilter) {
        if (!d.endorsements?.toLowerCase().includes(endorsementFilter.toLowerCase())) return false;
      }
      // Filter by availability
      if (availabilityFilter && d.driverStatus !== availabilityFilter) return false;
      return true;
    });
  }, [drivers, selectedLocations, endorsementFilter, availabilityFilter]);

  // Sort filtered drivers
  const sortedDrivers = useMemo(() => {
    if (!sortBy || !sortDirection) return filteredDrivers;

    return [...filteredDrivers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortBy === 'carrierId') {
        aValue = a.carrier?.name || '';
        bValue = b.carrier?.name || '';
      } else if (sortBy === 'locationId') {
        aValue = a.location?.code || '';
        bValue = b.location?.code || '';
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

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
  }, [filteredDrivers, sortBy, sortDirection]);

  const clearFilters = () => {
    setCarrierFilter('');
    setEndorsementFilter('');
    setAvailabilityFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = carrierFilter !== '' || endorsementFilter !== '' || availabilityFilter !== '';

  const columns = [
    {
      header: 'Driver',
      accessor: 'name' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center">
          <User className="w-4 h-4 mr-2 text-gray-400" />
          <div>
            <div className="font-medium text-gray-900">{driver.name}</div>
            {driver.number && (
              <div className="text-xs text-gray-500">#{driver.number}</div>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Carrier',
      accessor: 'carrierId' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center text-gray-600">
          {driver.carrier?.name ? (
            <>
              <Building2 className="w-4 h-4 mr-1" />
              {driver.carrier.name}
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Phone',
      accessor: 'phoneNumber' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center text-gray-600">
          {driver.phoneNumber ? (
            <>
              <Phone className="w-4 h-4 mr-1" />
              {driver.phoneNumber}
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Endorsements',
      accessor: 'endorsements' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center">
          {driver.endorsements ? (
            <div className="flex flex-wrap gap-1">
              {driver.endorsements.split(',').map((e, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {e.trim()}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">None</span>
          )}
        </div>
      )
    },
    {
      header: 'Availability',
      accessor: 'driverStatus' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => {
        const status = driver.driverStatus || 'AVAILABLE';
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            driverStatusColors[status] || 'bg-gray-100 text-gray-800'
          }`}>
            {formatDriverStatus(status)}
          </span>
        );
      }
    },
    {
      header: 'Location',
      accessor: 'locationId' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center text-gray-600">
          {driver.location ? (
            <>
              <MapPin className="w-4 h-4 mr-1" />
              <span title={driver.location.name || driver.location.code}>
                {driver.location.code}
                {driver.location.city && driver.location.state && (
                  <span className="text-gray-400 ml-1 text-xs">
                    ({driver.location.city}, {driver.location.state})
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b border-gray-200">
        {/* Search Row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="w-72">
            <Search
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search by name, number, or carrier..."
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Drivers'}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          {/* Carrier Filter */}
          <select
            value={carrierFilter}
            onChange={(e) => {
              setCarrierFilter(e.target.value ? parseInt(e.target.value) : '');
              setCurrentPage(1);
            }}
            className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Carriers</option>
            {[...carriers].sort((a, b) => a.name.localeCompare(b.name)).map(carrier => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>

          {/* Endorsement Filter */}
          <select
            value={endorsementFilter}
            onChange={(e) => setEndorsementFilter(e.target.value)}
            className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Endorsements</option>
            {ENDORSEMENT_OPTIONS.map(endorsement => (
              <option key={endorsement} value={endorsement}>
                {endorsement.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Availability Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as DriverStatus | '')}
            className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
            <option value="DISPATCHED">Dispatched</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Clear filters
            </button>
          )}

          {/* Results Count */}
          <div className="ml-auto text-sm text-gray-500">
            {sortedDrivers.length} of {totalDrivers} drivers
          </div>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={sortedDrivers}
        loading={loading}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
      {!loading && totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};
