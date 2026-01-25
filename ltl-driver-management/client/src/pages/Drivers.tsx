import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { DriverForm } from '../components/drivers/DriverForm';
import { DriverImport } from '../components/drivers/DriverImport';
import { driverService } from '../services/driverService';
import { carrierService } from '../services/carrierService';
import { CarrierDriver, Carrier } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Phone, Mail, Truck, Upload, MapPin, AlertTriangle } from 'lucide-react';
import { usePersistedState } from '../hooks/usePersistedFilters';

export const Drivers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = usePersistedState('drivers-search', '');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<CarrierDriver | null>(null);

  const isAdminOrDispatcher = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchDrivers();
    fetchCarriers();
  }, [currentPage, searchTerm]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await driverService.getDrivers({
        search: searchTerm,
        page: currentPage,
        limit: 20
      });
      setDrivers(response.drivers);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      toast.error('Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCarriers = async () => {
    try {
      const response = await carrierService.getCarriers({ limit: 1000 });
      setCarriers(response.carriers);
    } catch (error) {
      console.error('Failed to fetch carriers:', error);
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

  const columns = [
    {
      header: 'Driver Name',
      accessor: 'name' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="font-medium text-gray-900">{driver.name}</div>
      )
    },
    {
      header: 'Number',
      accessor: 'number' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="text-gray-600">
          {driver.number || '-'}
        </div>
      )
    },
    {
      header: 'Carrier',
      accessor: 'carrier' as keyof CarrierDriver,
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
      header: 'Email',
      accessor: 'email' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center text-gray-600">
          {driver.email ? (
            <>
              <Mail className="w-4 h-4 mr-1" />
              {driver.email}
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
      header: 'Hazmat',
      accessor: 'hazmatEndorsement' as keyof CarrierDriver,
      cell: (driver: CarrierDriver) => (
        <div className="flex items-center">
          {driver.hazmatEndorsement ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Hazmat
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'active' as keyof CarrierDriver,
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
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-md">
              <Search
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search drivers by name, phone, or carrier..."
              />
            </div>
            {isAdminOrDispatcher && (
              <div className="ml-4 flex space-x-2">
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
        </div>

        <DataTable
          columns={columns}
          data={drivers}
          loading={loading}
        />

        {!loading && drivers.length > 0 && (
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
          carriers={carriers}
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
          carriers={carriers}
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