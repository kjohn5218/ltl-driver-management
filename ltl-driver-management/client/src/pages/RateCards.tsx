import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Search } from '../components/common/Search';
import { Modal } from '../components/common/Modal';
import { rateCardService } from '../services/rateCardService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { locationService } from '../services/locationService';
import { driverService } from '../services/driverService';
import { carrierService } from '../services/carrierService';
import {
  RateCard,
  RateCardType,
  RateMethod,
  LinehaulProfile,
  Location,
  CarrierDriver,
  Carrier
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Filter
} from 'lucide-react';

const rateTypeLabels: Record<RateCardType, string> = {
  DRIVER: 'Driver Rate',
  CARRIER: 'Carrier Rate',
  LINEHAUL: 'Linehaul Profile',
  OD_PAIR: 'O/D Pair',
  DEFAULT: 'Default'
};

const rateMethodLabels: Record<RateMethod, string> = {
  PER_MILE: 'Per Mile',
  FLAT_RATE: 'Flat Rate',
  HOURLY: 'Hourly',
  PERCENTAGE: 'Percentage'
};

const rateTypeOptions: { value: RateCardType; label: string }[] = [
  { value: 'DRIVER', label: 'Driver Rate' },
  { value: 'CARRIER', label: 'Carrier Rate' },
  { value: 'LINEHAUL', label: 'Linehaul Profile' },
  { value: 'OD_PAIR', label: 'O/D Pair' },
  { value: 'DEFAULT', label: 'Default' }
];

const rateMethodOptions: { value: RateMethod; label: string }[] = [
  { value: 'PER_MILE', label: 'Per Mile' },
  { value: 'FLAT_RATE', label: 'Flat Rate' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'PERCENTAGE', label: 'Percentage' }
];

export const RateCards: React.FC = () => {
  const { user } = useAuth();
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<RateCardType | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    rateType: 'DEFAULT' as RateCardType,
    entityId: '',
    linehaulProfileId: '',
    originTerminalId: '',
    destinationTerminalId: '',
    rateMethod: 'PER_MILE' as RateMethod,
    rateAmount: '',
    minimumAmount: '',
    maximumAmount: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expirationDate: '',
    equipmentType: '',
    priority: '5',
    notes: '',
    active: true
  });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchProfiles();
    fetchLocations();
    fetchDrivers();
    fetchCarriers();
  }, []);

  useEffect(() => {
    fetchRateCards();
  }, [currentPage, searchTerm, typeFilter, activeFilter]);

  const fetchProfiles = async () => {
    try {
      const data = await linehaulProfileService.getProfilesList();
      setProfiles(data);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
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

  const fetchDrivers = async () => {
    try {
      const response = await driverService.getDrivers({ limit: 1000 });
      setDrivers(response.drivers);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
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

  const fetchRateCards = async () => {
    try {
      setLoading(true);
      const response = await rateCardService.getRateCards({
        search: searchTerm || undefined,
        rateType: typeFilter || undefined,
        active: activeFilter === '' ? undefined : activeFilter,
        page: currentPage,
        limit: 20
      });
      setRateCards(response.rateCards);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch rate cards');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      rateType: 'DEFAULT' as RateCardType,
      entityId: '',
      linehaulProfileId: '',
      originTerminalId: '',
      destinationTerminalId: '',
      rateMethod: 'PER_MILE' as RateMethod,
      rateAmount: '',
      minimumAmount: '',
      maximumAmount: '',
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: '',
      equipmentType: '',
      priority: '5',
      notes: '',
      active: true
    });
  };

  const handleCreate = async () => {
    try {
      await rateCardService.createRateCard({
        rateType: formData.rateType,
        entityId: formData.entityId ? parseInt(formData.entityId) : undefined,
        linehaulProfileId: formData.linehaulProfileId ? parseInt(formData.linehaulProfileId) : undefined,
        originTerminalId: formData.originTerminalId ? parseInt(formData.originTerminalId) : undefined,
        destinationTerminalId: formData.destinationTerminalId ? parseInt(formData.destinationTerminalId) : undefined,
        rateMethod: formData.rateMethod,
        rateAmount: parseFloat(formData.rateAmount),
        minimumAmount: formData.minimumAmount ? parseFloat(formData.minimumAmount) : undefined,
        maximumAmount: formData.maximumAmount ? parseFloat(formData.maximumAmount) : undefined,
        effectiveDate: formData.effectiveDate,
        expirationDate: formData.expirationDate || undefined,
        equipmentType: formData.equipmentType || undefined,
        priority: parseInt(formData.priority),
        notes: formData.notes || undefined,
        active: formData.active
      });
      toast.success('Rate card created successfully');
      setIsCreateModalOpen(false);
      resetForm();
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create rate card');
    }
  };

  const handleUpdate = async () => {
    if (!selectedRateCard) return;
    try {
      await rateCardService.updateRateCard(selectedRateCard.id, {
        rateMethod: formData.rateMethod,
        rateAmount: parseFloat(formData.rateAmount),
        minimumAmount: formData.minimumAmount ? parseFloat(formData.minimumAmount) : undefined,
        maximumAmount: formData.maximumAmount ? parseFloat(formData.maximumAmount) : undefined,
        effectiveDate: formData.effectiveDate || undefined,
        expirationDate: formData.expirationDate || undefined,
        equipmentType: formData.equipmentType || undefined,
        priority: parseInt(formData.priority),
        notes: formData.notes || undefined,
        active: formData.active
      });
      toast.success('Rate card updated successfully');
      setIsEditModalOpen(false);
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update rate card');
    }
  };

  const handleDelete = async () => {
    if (!selectedRateCard) return;
    try {
      await rateCardService.deleteRateCard(selectedRateCard.id);
      toast.success('Rate card deleted successfully');
      setIsDeleteModalOpen(false);
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete rate card');
    }
  };

  const openEditModal = (rateCard: RateCard) => {
    setSelectedRateCard(rateCard);
    setFormData({
      rateType: rateCard.rateType,
      entityId: rateCard.entityId?.toString() || '',
      linehaulProfileId: rateCard.linehaulProfileId?.toString() || '',
      originTerminalId: rateCard.originTerminalId?.toString() || '',
      destinationTerminalId: rateCard.destinationTerminalId?.toString() || '',
      rateMethod: rateCard.rateMethod,
      rateAmount: rateCard.rateAmount.toString(),
      minimumAmount: rateCard.minimumAmount?.toString() || '',
      maximumAmount: rateCard.maximumAmount?.toString() || '',
      effectiveDate: rateCard.effectiveDate ? new Date(rateCard.effectiveDate).toISOString().split('T')[0] : '',
      expirationDate: rateCard.expirationDate ? new Date(rateCard.expirationDate).toISOString().split('T')[0] : '',
      equipmentType: rateCard.equipmentType || '',
      priority: rateCard.priority?.toString() || '5',
      notes: rateCard.notes || '',
      active: rateCard.active
    });
    setIsEditModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getEntityName = (rateCard: RateCard) => {
    switch (rateCard.rateType) {
      case 'DRIVER':
        const driver = drivers.find(d => d.id === rateCard.entityId);
        return driver?.name || '-';
      case 'CARRIER':
        const carrier = carriers.find(c => c.id === rateCard.entityId);
        return carrier?.name || '-';
      case 'LINEHAUL':
        return rateCard.linehaulProfile?.profileCode || '-';
      case 'OD_PAIR':
        return `${rateCard.originTerminal?.code} - ${rateCard.destinationTerminal?.code}`;
      default:
        return 'Default';
    }
  };

  const columns = [
    {
      header: 'Type',
      accessor: 'rateType' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {rateTypeLabels[rateCard.rateType]}
        </span>
      )
    },
    {
      header: 'Entity',
      accessor: 'entityId' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <div className="font-medium text-gray-900">{getEntityName(rateCard)}</div>
      )
    },
    {
      header: 'Rate',
      accessor: 'rateAmount' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <div className="flex items-center">
          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
          <span className="font-medium">{formatCurrency(rateCard.rateAmount)}</span>
          <span className="ml-1 text-xs text-gray-500">
            {rateMethodLabels[rateCard.rateMethod]}
          </span>
        </div>
      )
    },
    {
      header: 'Min/Max',
      accessor: 'minimumAmount' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <div className="text-sm text-gray-600">
          {rateCard.minimumAmount && <span>Min: {formatCurrency(rateCard.minimumAmount)}</span>}
          {rateCard.minimumAmount && rateCard.maximumAmount && ' / '}
          {rateCard.maximumAmount && <span>Max: {formatCurrency(rateCard.maximumAmount)}</span>}
          {!rateCard.minimumAmount && !rateCard.maximumAmount && '-'}
        </div>
      )
    },
    {
      header: 'Effective',
      accessor: 'effectiveDate' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <div className="text-sm">
          <div className="flex items-center text-gray-600">
            <Calendar className="w-3 h-3 mr-1" />
            {new Date(rateCard.effectiveDate).toLocaleDateString()}
          </div>
          {rateCard.expirationDate && (
            <div className="text-gray-500 text-xs">
              Expires: {new Date(rateCard.expirationDate).toLocaleDateString()}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Priority',
      accessor: 'priority' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <span className="text-gray-600">{rateCard.priority}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'active' as keyof RateCard,
      cell: (rateCard: RateCard) => (
        <StatusBadge
          status={rateCard.active ? 'Active' : 'Inactive'}
          variant={rateCard.active ? 'success' : 'default'}
        />
      )
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof RateCard,
            cell: (rateCard: RateCard) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(rateCard)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedRateCard(rateCard);
                    setIsDeleteModalOpen(true);
                  }}
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

  const renderForm = () => (
    <div className="space-y-4">
      {!selectedRateCard && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Rate Type *</label>
            <select
              required
              value={formData.rateType}
              onChange={(e) => setFormData({ ...formData, rateType: e.target.value as RateCardType, entityId: '' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {rateTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {formData.rateType === 'DRIVER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Driver</label>
              <select
                value={formData.entityId}
                onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select Driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.rateType === 'CARRIER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Carrier</label>
              <select
                value={formData.entityId}
                onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select Carrier</option>
                {carriers.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.rateType === 'LINEHAUL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Linehaul Profile</label>
              <select
                value={formData.linehaulProfileId}
                onChange={(e) => setFormData({ ...formData, linehaulProfileId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select Profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.profileCode} - {profile.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.rateType === 'OD_PAIR' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Origin Location</label>
                <select
                  value={formData.originTerminalId}
                  onChange={(e) => setFormData({ ...formData, originTerminalId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select Origin</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Destination Location</label>
                <select
                  value={formData.destinationTerminalId}
                  onChange={(e) => setFormData({ ...formData, destinationTerminalId: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select Destination</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.code} - {location.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Rate Method *</label>
          <select
            required
            value={formData.rateMethod}
            onChange={(e) => setFormData({ ...formData, rateMethod: e.target.value as RateMethod })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {rateMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Rate Amount *</label>
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={formData.rateAmount}
            onChange={(e) => setFormData({ ...formData, rateAmount: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Minimum Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.minimumAmount}
            onChange={(e) => setFormData({ ...formData, minimumAmount: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Maximum Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.maximumAmount}
            onChange={(e) => setFormData({ ...formData, maximumAmount: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Effective Date *</label>
          <input
            type="date"
            required
            value={formData.effectiveDate}
            onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Expiration Date</label>
          <input
            type="date"
            value={formData.expirationDate}
            onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority (1-10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Higher priority rates are applied first</p>
        </div>

        <div className="flex items-center pt-6">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          rows={2}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(false);
            setIsEditModalOpen(false);
            resetForm();
          }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={selectedRateCard ? handleUpdate : handleCreate}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
        >
          {selectedRateCard ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Cards"
        subtitle="Manage driver and carrier pay rates"
      />

      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 flex-1">
              <div className="flex-1 max-w-md">
                <Search
                  value={searchTerm}
                  onChange={(value) => {
                    setSearchTerm(value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search rate cards..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as RateCardType | '');
                    setCurrentPage(1);
                  }}
                  className="rounded-md border-gray-300 text-sm"
                >
                  <option value="">All Types</option>
                  {rateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select
                  value={activeFilter === '' ? '' : activeFilter.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setActiveFilter(value === '' ? '' : value === 'true');
                    setCurrentPage(1);
                  }}
                  className="rounded-md border-gray-300 text-sm"
                >
                  <option value="">All Status</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setSelectedRateCard(null);
                  setIsCreateModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rate Card
              </button>
            )}
          </div>
        </div>

        <DataTable columns={columns} data={rateCards} loading={loading} />

        {!loading && rateCards.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          resetForm();
        }}
        title="Create Rate Card"
      >
        {renderForm()}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        title="Edit Rate Card"
      >
        {renderForm()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Rate Card"
      >
        <div className="space-y-4">
          <p className="text-gray-700">Are you sure you want to delete this rate card?</p>
          <div className="bg-gray-50 p-4 rounded">
            <p className="font-medium">{rateTypeLabels[selectedRateCard?.rateType || 'DEFAULT']}</p>
            <p className="text-sm text-gray-600">{getEntityName(selectedRateCard as RateCard)}</p>
            <p className="text-sm text-gray-600">
              {formatCurrency(selectedRateCard?.rateAmount || 0)} {rateMethodLabels[selectedRateCard?.rateMethod || 'PER_MILE']}
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
