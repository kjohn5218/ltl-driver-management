import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, SortDirection } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { DriverForm } from '../components/drivers/DriverForm';
import { DriverImport } from '../components/drivers/DriverImport';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { CarrierSelect } from '../components/CarrierSelect';
import { driverService } from '../services/driverService';
import { carrierService } from '../services/carrierService';
import { CarrierDriver, Carrier } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Phone, Truck, Upload, MapPin, Shield, RefreshCw, Filter } from 'lucide-react';
import { usePersistedState } from '../hooks/usePersistedFilters';

// Available endorsement types
const ENDORSEMENT_OPTIONS = ['hazmat', 'tanker', 'lcv', 'doubles', 'triples'];

export const Drivers: React.FC = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = usePersistedState('drivers-search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<CarrierDriver | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter state
  const [carrierFilter, setCarrierFilter] = useState<number | ''>('');
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [endorsementFilter, setEndorsementFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('active');
  const [driverTypeFilter, setDriverTypeFilter] = useState<'E' | 'C' | 'T' | ''>('');

  // Sort state
  const [sortBy, setSortBy] = useState<keyof CarrierDriver | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const isAdminOrDispatcher = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchDrivers();
    fetchCarriers();
  }, [currentPage, searchTerm, carrierFilter, statusFilter, driverTypeFilter]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await driverService.getDrivers({
        search: searchTerm || undefined,
        carrierId: carrierFilter || undefined,
        active: statusFilter === '' ? undefined : statusFilter === 'active',
        driverType: driverTypeFilter || undefined,
        page: currentPage,
        limit: 50
      });
      setDrivers(response.drivers);
      setTotalPages(response.pagination.pages);
      setTotalDrivers(response.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCarriers = async () => {
    try {
      const response = await carrierService.getCarriers({ limit: 5000, status: 'ACTIVE' });
      setCarriers(response.carriers);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
    }
  };

  // Client-side filtering for location and endorsements (after server-side filters)
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
      return true;
    });
  }, [drivers, selectedLocations, endorsementFilter]);

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

      if (typeof aValue === 'boolean') {
        return sortDirection === 'asc'
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDrivers, sortBy, sortDirection]);

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

  const handleCreateDriver = async (data: any) => {
    try {
      await driverService.createDriver(data);
      toast.success('Driver created successfully');
      setIsCreateModalOpen(false);
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to create driver');
    }
  };

  const handleUpdateDriver = async (data: any) => {
    if (!selectedDriver) return;

    try {
      await driverService.updateDriver(selectedDriver.id, data);
      toast.success('Driver updated successfully');
      setIsEditModalOpen(false);
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to update driver');
    }
  };

  const handleDeleteDriver = async () => {
    if (!selectedDriver) return;

    try {
      await driverService.deleteDriver(selectedDriver.id);
      toast.success('Driver deactivated successfully');
      setIsDeleteModalOpen(false);
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to deactivate driver');
    }
  };

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

  const clearFilters = () => {
    setCarrierFilter('');
    setSelectedLocations([]);
    setEndorsementFilter('');
    setStatusFilter('');
    setDriverTypeFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = carrierFilter !== '' || selectedLocations.length > 0 || endorsementFilter !== '' || statusFilter !== '' || driverTypeFilter !== '';

  const columns = [
    {
      header: 'Driver Name',
      accessor: 'name' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div>
          <div className="font-medium text-gray-900">{driver.name}</div>
          {driver.number && (
            <div className="text-xs text-gray-500">#{driver.number}</div>
          )}
        </div>
      )
    },
    {
      header: 'Carrier',
      accessor: 'carrierId' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center">
          <Truck className="w-4 h-4 mr-2 text-gray-400" />
          <span>{driver.carrier?.name || 'Unknown'}</span>
        </div>
      )
    },
    {
      header: 'Phone',
      accessor: 'phoneNumber' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center text-gray-600">
          {driver.phoneNumber ? (
            <>
              <Phone className="w-4 h-4 mr-1" />
              {driver.phoneNumber}
            </>
          ) : (
            '-'
          )}
        </div>
      )
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
                  <span className="text-gray-400 ml-1">
                    ({driver.location.city}, {driver.location.state})
                  </span>
                )}
              </span>
            </>
          ) : (
            '-'
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
      header: 'Type',
      accessor: 'driverType' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => {
        const typeLabels: Record<string, { label: string; color: string }> = {
          'E': { label: 'Employee', color: 'bg-blue-100 text-blue-800' },
          'C': { label: 'Contractor', color: 'bg-purple-100 text-purple-800' },
          'T': { label: 'Temp', color: 'bg-orange-100 text-orange-800' }
        };
        const type = typeLabels[driver.driverType || 'C'] || typeLabels['C'];
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${type.color}`}>
            {type.label}
          </span>
        );
      }
    },
    {
      header: 'HR Status',
      accessor: 'hrStatus' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <StatusBadge
          status={driver.hrStatus === 'Active' ? 'active' : 'inactive'}
          variant={driver.hrStatus === 'Active' ? 'success' : 'default'}
        />
      )
    },
    {
      header: 'Status',
      accessor: 'active' as keyof CarrierDriver,
      sortable: true,
      cell: (driver: CarrierDriver) => (
        <StatusBadge
          status={driver.active ? 'active' : 'inactive'}
          variant={driver.active ? 'success' : 'default'}
        />
      )
    },
    ...(isAdminOrDispatcher ? [{
      header: 'Actions',
      accessor: 'id' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setSelectedDriver(driver);
              setIsEditModalOpen(true);
            }}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedDriver(driver);
              setIsDeleteModalOpen(true);
            }}
            className="text-red-600 hover:text-red-900"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        subtitle="Manage carrier drivers and their information"
      />

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          {/* Search and Actions Row */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1 max-w-md">
              <Search
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search drivers by name, number, or carrier..."
              />
            </div>
            {isAdminOrDispatcher && (
              <div className="ml-4 flex space-x-2">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync Drivers'}
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Driver
                </button>
              </div>
            )}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>

            {/* Carrier Filter */}
            <CarrierSelect
              value={carrierFilter}
              onChange={(value) => {
                setCarrierFilter(value);
                setCurrentPage(1);
              }}
              placeholder="All Carriers"
              className="w-64"
              hasDrivers={true}
            />

            {/* Location Filter */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <LocationMultiSelect
                value={selectedLocations}
                onChange={(locs) => {
                  setSelectedLocations(locs);
                }}
                placeholder="Filter by location..."
                className="w-56"
              />
            </div>

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

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'active' | 'inactive' | '');
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Driver Type Filter */}
            <select
              value={driverTypeFilter}
              onChange={(e) => {
                setDriverTypeFilter(e.target.value as 'E' | 'C' | 'T' | '');
                setCurrentPage(1);
              }}
              className="rounded-md border border-gray-300 shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Types</option>
              <option value="E">Employee</option>
              <option value="C">Contractor</option>
              <option value="T">Temp</option>
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
          <div className="px-6 py-4 border-t border-gray-200">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Driver Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add New Driver"
      >
        <DriverForm
          onSubmit={handleCreateDriver}
          onCancel={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      {/* Edit Driver Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Driver"
      >
        <DriverForm
          driver={selectedDriver}
          onSubmit={handleUpdateDriver}
          onCancel={() => setIsEditModalOpen(false)}
        />
      </Modal>

      {/* Import Drivers Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Drivers"
      >
        <DriverImport
          carriers={carriers}
          onImportComplete={() => {
            setIsImportModalOpen(false);
            fetchDrivers();
          }}
          onCancel={() => setIsImportModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Deactivate Driver"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to deactivate this driver?
          </p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{selectedDriver?.name}</p>
            <p className="text-sm text-gray-600">{selectedDriver?.carrier?.name}</p>
          </div>
          <p className="text-sm text-gray-500">
            This action will mark the driver as inactive. They can be reactivated later if needed.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteDriver}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Deactivate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
