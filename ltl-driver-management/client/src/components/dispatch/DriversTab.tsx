import React, { useState, useMemo } from 'react';
import { DataTable, SortDirection } from '../common/DataTable';
import { Search } from '../common/Search';
import { LocationMultiSelect } from '../LocationMultiSelect';
import { CarrierDriver, DriverStatus } from '../../types';
import { Phone, User, MapPin, Shield, Building2 } from 'lucide-react';

interface DriversTabProps {
  drivers: CarrierDriver[];
  loading?: boolean;
}

const driverStatusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  UNAVAILABLE: 'bg-gray-100 text-gray-800',
  DISPATCHED: 'bg-blue-100 text-blue-800'
};

const formatDriverStatus = (status: string): string => {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const DriversTab: React.FC<DriversTabProps> = ({ drivers, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus | ''>('');
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<keyof CarrierDriver | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  // Filter active drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      if (!d.active) return false;
      if (searchTerm && !d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (statusFilter && d.driverStatus !== statusFilter) return false;
      // Filter by selected locations
      if (selectedLocations.length > 0) {
        if (!d.locationId || !selectedLocations.includes(d.locationId)) return false;
      }
      return true;
    });
  }, [drivers, searchTerm, statusFilter, selectedLocations]);

  // Sort filtered drivers
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (!sortBy || !sortDirection) return 0;

    let aValue: any;
    let bValue: any;

    // Handle special cases for nested properties
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-64">
            <Search
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search drivers..."
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DriverStatus | '')}
            className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="UNAVAILABLE">Unavailable</option>
            <option value="DISPATCHED">Dispatched</option>
          </select>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <LocationMultiSelect
              value={selectedLocations}
              onChange={setSelectedLocations}
              placeholder="Filter by location..."
              className="w-56"
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredDrivers.length} active driver{filteredDrivers.length !== 1 ? 's' : ''}
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
    </div>
  );
};
