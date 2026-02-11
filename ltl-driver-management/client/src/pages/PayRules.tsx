import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Modal } from '../components/common/Modal';
import {
  payRulesService,
  CreateRateCardData,
  UpdateRateCardData,
  CreateAccessorialRateData,
  ImportRateCardData
} from '../services/payRulesService';
import { terminalService } from '../services/terminalService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { driverService } from '../services/driverService';
import { carrierService } from '../services/carrierService';
import { RateCard, AccessorialRate, RateCardType, RateMethod, AccessorialType, Terminal, LinehaulProfile, CarrierDriver, Carrier } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  DollarSign,
  User,
  Truck,
  MapPin,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  Search,
  FileText,
  Link,
  Filter,
  ChevronDown,
  ChevronUp,
  Settings
} from 'lucide-react';

const RATE_TYPES: { value: RateCardType; label: string; icon: React.ReactNode }[] = [
  { value: 'DRIVER', label: 'Driver', icon: <User className="w-4 h-4" /> },
  { value: 'CARRIER', label: 'Carrier', icon: <Truck className="w-4 h-4" /> },
  { value: 'LINEHAUL', label: 'Linehaul Profile', icon: <FileText className="w-4 h-4" /> },
  { value: 'OD_PAIR', label: 'O/D Pair', icon: <Link className="w-4 h-4" /> },
  { value: 'DEFAULT', label: 'Default', icon: <Settings className="w-4 h-4" /> }
];

const RATE_METHODS: { value: RateMethod; label: string }[] = [
  { value: 'PER_MILE', label: 'Per Mile' },
  { value: 'FLAT_RATE', label: 'Flat Rate' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'PERCENTAGE', label: 'Percentage' }
];

const ACCESSORIAL_TYPES: { value: AccessorialType; label: string }[] = [
  { value: 'DROP_HOOK', label: 'Drop & Hook' },
  { value: 'DROP_HOOK_SINGLE', label: 'Drop & Hook (Single)' },
  { value: 'DROP_HOOK_DOUBLE_TRIPLE', label: 'Drop & Hook (Double/Triple)' },
  { value: 'CHAIN_UP', label: 'Chain Up' },
  { value: 'WAIT_TIME', label: 'Wait Time' },
  { value: 'SINGLE_TRAILER', label: 'Single Trailer' },
  { value: 'DOUBLE_TRAILER', label: 'Double Trailer' },
  { value: 'TRIPLE_TRAILER', label: 'Triple Trailer' },
  { value: 'CUT_PAY', label: 'Cut Pay' },
  { value: 'CUT_PAY_SINGLE_MILES', label: 'Cut Pay Miles (Single)' },
  { value: 'CUT_PAY_DOUBLE_MILES', label: 'Cut Pay Miles (Double)' },
  { value: 'CUT_PAY_TRIPLE_MILES', label: 'Cut Pay Miles (Triple)' },
  { value: 'FUEL_SURCHARGE', label: 'Fuel Surcharge' },
  { value: 'LAYOVER', label: 'Layover' },
  { value: 'DETENTION', label: 'Detention' },
  { value: 'BREAKDOWN', label: 'Breakdown' },
  { value: 'HELPER', label: 'Helper' },
  { value: 'TRAINER', label: 'Trainer' },
  { value: 'HAZMAT', label: 'Hazmat' },
  { value: 'TEAM_DRIVER', label: 'Team Driver' },
  { value: 'STOP_CHARGE', label: 'Stop Charge' },
  { value: 'OTHER', label: 'Other' }
];

export const PayRules: React.FC = () => {
  const { user } = useAuth();

  // Data states
  const [rateCards, setRateCards] = useState<RateCard[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [profiles, setProfiles] = useState<LinehaulProfile[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<RateCardType | ''>('');
  const [methodFilter, setMethodFilter] = useState<RateMethod | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal states
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [isAccessorialModalOpen, setIsAccessorialModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Form states
  const [rateFormData, setRateFormData] = useState<CreateRateCardData>({
    rateType: 'DRIVER',
    rateMethod: 'PER_MILE',
    rateAmount: 0,
    effectiveDate: new Date().toISOString().split('T')[0]
  });
  const [accessorialFormData, setAccessorialFormData] = useState<CreateAccessorialRateData>({
    type: 'DROP_HOOK',
    rateAmount: 0,
    rateMethod: 'FLAT_RATE'
  });

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PAYROLL_ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchReferenceData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, methodFilter, activeFilter]);

  useEffect(() => {
    fetchRateCards();
  }, [currentPage, searchTerm, typeFilter, methodFilter, activeFilter]);

  const fetchReferenceData = async () => {
    try {
      const [terminalsRes, profilesRes, driversRes, carriersRes] = await Promise.all([
        terminalService.getTerminals({ limit: 500 }),
        linehaulProfileService.getProfilesList(),
        driverService.getDrivers({ limit: 1000 }),
        carrierService.getCarriers({ limit: 500 })
      ]);
      setTerminals(terminalsRes.terminals || []);
      setProfiles(profilesRes || []);
      setDrivers(driversRes.drivers || []);
      setCarriers(carriersRes.carriers || carriersRes || []);
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    }
  };

  const fetchRateCards = async () => {
    setLoading(true);
    try {
      const response = await payRulesService.getRateCards({
        search: searchTerm || undefined,
        type: typeFilter || undefined,
        active: activeFilter !== '' ? activeFilter : undefined,
        page: currentPage,
        limit: 25
      });

      // Filter by rate method client-side if needed
      let filteredCards = response.rateCards;
      if (methodFilter) {
        filteredCards = filteredCards.filter(rc => rc.rateMethod === methodFilter);
      }

      setRateCards(filteredCards);
      setTotalPages(response.pagination.totalPages);
      setTotalRecords(response.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch rate cards');
      console.error('Failed to fetch rate cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string | undefined) => {
    if (amount === undefined || amount === null) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${num.toFixed(2)}`;
  };

  const formatRateMethod = (method: RateMethod) => {
    return RATE_METHODS.find(m => m.value === method)?.label || method;
  };

  const formatRateType = (type: RateCardType) => {
    return RATE_TYPES.find(t => t.value === type)?.label || type;
  };

  const formatAccessorialType = (type: AccessorialType) => {
    return ACCESSORIAL_TYPES.find(t => t.value === type)?.label || type;
  };

  const getRateTypeIcon = (type: RateCardType) => {
    return RATE_TYPES.find(t => t.value === type)?.icon || <DollarSign className="w-4 h-4" />;
  };

  const getEntityName = (rateCard: RateCard): string => {
    switch (rateCard.rateType) {
      case 'DRIVER':
        // Use driver data from API response, fallback to client-side lookup
        if (rateCard.driver?.name) return rateCard.driver.name;
        const driver = drivers.find(d => d.id === rateCard.entityId);
        return driver?.name || `Driver #${rateCard.entityId}`;
      case 'CARRIER':
        // Use carrier data from API response, fallback to client-side lookup
        if (rateCard.carrier?.name) return rateCard.carrier.name;
        const carrier = carriers.find(c => c.id === rateCard.entityId);
        return carrier?.name || `Carrier #${rateCard.entityId}`;
      case 'LINEHAUL':
        return rateCard.linehaulProfile?.profileCode || rateCard.linehaulProfile?.name || `Profile #${rateCard.linehaulProfileId}`;
      case 'OD_PAIR':
        const origin = rateCard.originTerminal?.code || '?';
        const dest = rateCard.destinationTerminal?.code || '?';
        return `${origin} → ${dest}`;
      case 'DEFAULT':
        return 'Default Rate';
      default:
        return '-';
    }
  };

  const toggleRowExpand = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedRateCard(null);
    setRateFormData({
      rateType: 'DRIVER',
      rateMethod: 'PER_MILE',
      rateAmount: 0,
      effectiveDate: new Date().toISOString().split('T')[0]
    });
    setIsRateModalOpen(true);
  };

  const openEditModal = (rateCard: RateCard) => {
    setModalMode('edit');
    setSelectedRateCard(rateCard);
    setRateFormData({
      rateType: rateCard.rateType,
      entityId: rateCard.entityId || undefined,
      linehaulProfileId: rateCard.linehaulProfileId || undefined,
      originTerminalId: rateCard.originTerminalId || undefined,
      destinationTerminalId: rateCard.destinationTerminalId || undefined,
      rateMethod: rateCard.rateMethod,
      rateAmount: parseFloat(String(rateCard.rateAmount)),
      minimumAmount: rateCard.minimumAmount ? parseFloat(String(rateCard.minimumAmount)) : undefined,
      maximumAmount: rateCard.maximumAmount ? parseFloat(String(rateCard.maximumAmount)) : undefined,
      effectiveDate: rateCard.effectiveDate.split('T')[0],
      expirationDate: rateCard.expirationDate ? rateCard.expirationDate.split('T')[0] : undefined,
      equipmentType: rateCard.equipmentType || undefined,
      priority: rateCard.priority,
      notes: rateCard.notes || undefined,
      active: rateCard.active,
      // Flattened pay rule fields
      autoArrive: rateCard.autoArrive || false,
      perTrip: rateCard.perTrip ? parseFloat(String(rateCard.perTrip)) : undefined,
      perCutTrip: rateCard.perCutTrip ? parseFloat(String(rateCard.perCutTrip)) : undefined,
      cutMiles: rateCard.cutMiles ? parseFloat(String(rateCard.cutMiles)) : undefined,
      cutMilesType: rateCard.cutMilesType || undefined,
      perSingleMile: rateCard.perSingleMile ? parseFloat(String(rateCard.perSingleMile)) : undefined,
      perDoubleMile: rateCard.perDoubleMile ? parseFloat(String(rateCard.perDoubleMile)) : undefined,
      perTripleMile: rateCard.perTripleMile ? parseFloat(String(rateCard.perTripleMile)) : undefined,
      perWorkHour: rateCard.perWorkHour ? parseFloat(String(rateCard.perWorkHour)) : undefined,
      perStopHour: rateCard.perStopHour ? parseFloat(String(rateCard.perStopHour)) : undefined,
      perSingleDH: rateCard.perSingleDH ? parseFloat(String(rateCard.perSingleDH)) : undefined,
      perDoubleDH: rateCard.perDoubleDH ? parseFloat(String(rateCard.perDoubleDH)) : undefined,
      perTripleDH: rateCard.perTripleDH ? parseFloat(String(rateCard.perTripleDH)) : undefined,
      perChainUp: rateCard.perChainUp ? parseFloat(String(rateCard.perChainUp)) : undefined,
      fuelSurcharge: rateCard.fuelSurcharge ? parseFloat(String(rateCard.fuelSurcharge)) : undefined
    });
    setIsRateModalOpen(true);
  };

  const handleSaveRate = async () => {
    try {
      if (modalMode === 'create') {
        await payRulesService.createRateCard(rateFormData);
        toast.success('Rate card created successfully');
      } else if (selectedRateCard) {
        const updateData: UpdateRateCardData = {
          rateMethod: rateFormData.rateMethod,
          rateAmount: rateFormData.rateAmount,
          minimumAmount: rateFormData.minimumAmount,
          maximumAmount: rateFormData.maximumAmount,
          effectiveDate: rateFormData.effectiveDate,
          expirationDate: rateFormData.expirationDate,
          equipmentType: rateFormData.equipmentType,
          priority: rateFormData.priority,
          notes: rateFormData.notes,
          active: rateFormData.active,
          // Flattened pay rule fields
          autoArrive: rateFormData.autoArrive,
          perTrip: rateFormData.perTrip,
          perCutTrip: rateFormData.perCutTrip,
          cutMiles: rateFormData.cutMiles,
          cutMilesType: rateFormData.cutMilesType,
          perSingleMile: rateFormData.perSingleMile,
          perDoubleMile: rateFormData.perDoubleMile,
          perTripleMile: rateFormData.perTripleMile,
          perWorkHour: rateFormData.perWorkHour,
          perStopHour: rateFormData.perStopHour,
          perSingleDH: rateFormData.perSingleDH,
          perDoubleDH: rateFormData.perDoubleDH,
          perTripleDH: rateFormData.perTripleDH,
          perChainUp: rateFormData.perChainUp,
          fuelSurcharge: rateFormData.fuelSurcharge
        };
        await payRulesService.updateRateCard(selectedRateCard.id, updateData);
        toast.success('Rate card updated successfully');
      }
      setIsRateModalOpen(false);
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save rate card');
    }
  };

  const handleDeleteRate = async () => {
    if (!selectedRateCard) return;
    try {
      await payRulesService.deleteRateCard(selectedRateCard.id);
      toast.success('Rate card deleted successfully');
      setIsDeleteModalOpen(false);
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete rate card');
    }
  };

  const openAccessorialModal = (rateCard: RateCard, accessorial?: AccessorialRate) => {
    setSelectedRateCard(rateCard);
    if (accessorial) {
      setModalMode('edit');
      setAccessorialFormData({
        type: accessorial.accessorialType,
        description: accessorial.description,
        rateAmount: parseFloat(String(accessorial.rateAmount)),
        rateMethod: accessorial.rateMethod,
        minimumCharge: accessorial.minimumCharge ? parseFloat(String(accessorial.minimumCharge)) : undefined,
        maximumCharge: accessorial.maximumCharge ? parseFloat(String(accessorial.maximumCharge)) : undefined
      });
    } else {
      setModalMode('create');
      setAccessorialFormData({
        type: 'DROP_HOOK',
        rateAmount: 0,
        rateMethod: 'FLAT_RATE'
      });
    }
    setIsAccessorialModalOpen(true);
  };

  const handleSaveAccessorial = async () => {
    if (!selectedRateCard) return;
    try {
      if (modalMode === 'create') {
        await payRulesService.addAccessorialRate(selectedRateCard.id, accessorialFormData);
        toast.success('Accessorial rate added successfully');
      } else {
        const existingRates = await payRulesService.getAccessorialRates(selectedRateCard.id);
        const updatedRates = existingRates.map(r =>
          r.accessorialType === accessorialFormData.type
            ? { ...accessorialFormData }
            : { type: r.accessorialType, rateAmount: parseFloat(String(r.rateAmount)), rateMethod: r.rateMethod }
        );
        await payRulesService.bulkUpdateAccessorialRates(selectedRateCard.id, updatedRates);
        toast.success('Accessorial rate updated successfully');
      }
      setIsAccessorialModalOpen(false);
      fetchRateCards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save accessorial rate');
    }
  };

  const columns = [
    {
      header: '',
      accessor: 'id' as keyof RateCard,
      cell: (rc: RateCard) => (
        <button
          onClick={() => toggleRowExpand(rc.id)}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {expandedRows.has(rc.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )
    },
    {
      header: 'Type',
      accessor: 'rateType' as keyof RateCard,
      cell: (rc: RateCard) => (
        <div className="flex items-center space-x-2">
          <span className="text-gray-500">{getRateTypeIcon(rc.rateType)}</span>
          <span className="font-medium">{formatRateType(rc.rateType)}</span>
        </div>
      )
    },
    {
      header: 'Entity / Lane',
      accessor: 'entityId' as keyof RateCard,
      cell: (rc: RateCard) => (
        <div>
          <div className="font-medium text-gray-900">{getEntityName(rc)}</div>
          {rc.rateType === 'DRIVER' && rc.driver?.number && (
            <div className="text-xs text-gray-500">#{rc.driver.number}</div>
          )}
          {rc.rateType === 'LINEHAUL' && rc.linehaulProfile && (
            <div className="text-sm text-gray-500 flex items-center">
              {rc.linehaulProfile.originTerminal?.code}
              <ArrowRight className="w-3 h-3 mx-1" />
              {rc.linehaulProfile.destinationTerminal?.code}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Rate Method',
      accessor: 'rateMethod' as keyof RateCard,
      cell: (rc: RateCard) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
          {formatRateMethod(rc.rateMethod)}
        </span>
      )
    },
    {
      header: 'Rate',
      accessor: 'rateAmount' as keyof RateCard,
      cell: (rc: RateCard) => {
        const amount = formatCurrency(rc.rateAmount);
        if (rc.rateMethod === 'PER_MILE') return <span className="font-semibold text-green-600">{amount}/mi</span>;
        if (rc.rateMethod === 'HOURLY') return <span className="font-semibold text-blue-600">{amount}/hr</span>;
        if (rc.rateMethod === 'PERCENTAGE') return <span className="font-semibold text-purple-600">{rc.rateAmount}%</span>;
        return <span className="font-semibold">{amount}</span>;
      }
    },
    {
      header: 'Min / Max',
      accessor: 'minimumAmount' as keyof RateCard,
      cell: (rc: RateCard) => {
        if (!rc.minimumAmount && !rc.maximumAmount) return <span className="text-gray-400">-</span>;
        return (
          <span className="text-sm text-gray-600">
            {rc.minimumAmount ? formatCurrency(rc.minimumAmount) : '-'} / {rc.maximumAmount ? formatCurrency(rc.maximumAmount) : '-'}
          </span>
        );
      }
    },
    {
      header: 'Effective',
      accessor: 'effectiveDate' as keyof RateCard,
      cell: (rc: RateCard) => (
        <div className="text-sm">
          <div>{new Date(rc.effectiveDate).toLocaleDateString()}</div>
          {rc.expirationDate && (
            <div className="text-gray-500">to {new Date(rc.expirationDate).toLocaleDateString()}</div>
          )}
        </div>
      )
    },
    {
      header: 'Accessorials',
      accessor: '_count' as keyof RateCard,
      cell: (rc: RateCard) => (
        <span className="text-sm text-gray-600">
          {rc._count?.accessorialRates || rc.accessorialRates?.length || 0}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'active' as keyof RateCard,
      cell: (rc: RateCard) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          rc.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {rc.active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    ...(isAdmin ? [{
      header: 'Actions',
      accessor: 'id' as keyof RateCard,
      cell: (rc: RateCard) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={() => openEditModal(rc)}
            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
            title="Edit Rate"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => openAccessorialModal(rc)}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Add Accessorial"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedRateCard(rc);
              setIsDeleteModalOpen(true);
            }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Delete Rate"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }] : [])
  ];

  const renderExpandedRow = (rateCard: RateCard) => {
    if (!expandedRows.has(rateCard.id)) return null;

    const accessorials = rateCard.accessorialRates || [];

    return (
      <tr key={`expanded-${rateCard.id}`} className="bg-gray-50">
        <td colSpan={columns.length} className="px-6 py-4">
          <div className="ml-8">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Accessorial Rates</h4>
              {isAdmin && (
                <button
                  onClick={() => openAccessorialModal(rateCard)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Accessorial
                </button>
              )}
            </div>
            {accessorials.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {accessorials.map(ar => (
                  <div
                    key={ar.id}
                    className="bg-white border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{formatAccessorialType(ar.accessorialType)}</div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(ar.rateAmount)}
                        {ar.rateMethod === 'HOURLY' && '/hr'}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => openAccessorialModal(rateCard, ar)}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No accessorial rates configured</p>
            )}

            {rateCard.notes && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Notes:</span> {rateCard.notes}
              </div>
            )}

            {/* Flattened Pay Rule Fields */}
            {(rateCard.perSingleMile || rateCard.perDoubleMile || rateCard.perTripleMile ||
              rateCard.perSingleDH || rateCard.perDoubleDH || rateCard.perTripleDH ||
              rateCard.perChainUp || rateCard.perWorkHour || rateCard.perStopHour ||
              rateCard.perTrip || rateCard.perCutTrip || rateCard.cutMiles ||
              rateCard.priority || rateCard.autoArrive || rateCard.fuelSurcharge) && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Pay Rule Rates</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {rateCard.priority && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                      <div className="text-xs text-green-600">Priority</div>
                      <div className="text-sm font-medium text-green-800">Yes</div>
                    </div>
                  )}
                  {rateCard.autoArrive && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                      <div className="text-xs text-blue-600">Auto Arrive</div>
                      <div className="text-sm font-medium text-blue-800">Yes</div>
                    </div>
                  )}
                  {rateCard.perTrip && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Per Trip</div>
                      <div className="text-sm font-medium">${Number(rateCard.perTrip).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.perCutTrip && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                      <div className="text-xs text-orange-600">Per Cut Trip</div>
                      <div className="text-sm font-medium text-orange-800">${Number(rateCard.perCutTrip).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.cutMiles && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Cut Miles</div>
                      <div className="text-sm font-medium">{Number(rateCard.cutMiles).toFixed(1)} {rateCard.cutMilesType || ''}</div>
                    </div>
                  )}
                  {rateCard.perSingleMile && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Single Mile</div>
                      <div className="text-sm font-medium">${Number(rateCard.perSingleMile).toFixed(4)}/mi</div>
                    </div>
                  )}
                  {rateCard.perDoubleMile && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Double Mile</div>
                      <div className="text-sm font-medium">${Number(rateCard.perDoubleMile).toFixed(4)}/mi</div>
                    </div>
                  )}
                  {rateCard.perTripleMile && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Triple Mile</div>
                      <div className="text-sm font-medium">${Number(rateCard.perTripleMile).toFixed(4)}/mi</div>
                    </div>
                  )}
                  {rateCard.perWorkHour && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Work Hour</div>
                      <div className="text-sm font-medium">${Number(rateCard.perWorkHour).toFixed(2)}/hr</div>
                    </div>
                  )}
                  {rateCard.perStopHour && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Stop Hour</div>
                      <div className="text-sm font-medium">${Number(rateCard.perStopHour).toFixed(2)}/hr</div>
                    </div>
                  )}
                  {rateCard.perSingleDH && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Single D/H</div>
                      <div className="text-sm font-medium">${Number(rateCard.perSingleDH).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.perDoubleDH && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Double D/H</div>
                      <div className="text-sm font-medium">${Number(rateCard.perDoubleDH).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.perTripleDH && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Triple D/H</div>
                      <div className="text-sm font-medium">${Number(rateCard.perTripleDH).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.perChainUp && (
                    <div className="bg-white border rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Chain Up</div>
                      <div className="text-sm font-medium">${Number(rateCard.perChainUp).toFixed(2)}</div>
                    </div>
                  )}
                  {rateCard.fuelSurcharge && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                      <div className="text-xs text-purple-600">Fuel Surcharge</div>
                      <div className="text-sm font-medium text-purple-800">{(Number(rateCard.fuelSurcharge) * 100).toFixed(2)}%</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay Rules"
        subtitle="Manage driver rates, carrier rates, linehaul profile rates, O/D pair rates, and accessorial charges"
      />

      {/* Filters and Actions Bar */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as RateCardType | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              {RATE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as RateMethod | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Methods</option>
            {RATE_METHODS.map(method => (
              <option key={method.value} value={method.value}>{method.label}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={activeFilter === '' ? '' : activeFilter.toString()}
            onChange={(e) => setActiveFilter(e.target.value === '' ? '' : e.target.value === 'true')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {isAdmin && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </button>
              <button
                onClick={openCreateModal}
                className="flex items-center px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rate
              </button>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-500">
          {totalRecords} rate card{totalRecords !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Rate Cards Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : rateCards.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No rate cards found</p>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Rate Card
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rateCards.map(rc => (
                <React.Fragment key={rc.id}>
                  <tr className={`hover:bg-gray-50 ${expandedRows.has(rc.id) ? 'bg-indigo-50' : ''}`}>
                    {columns.map((col, idx) => (
                      <td key={idx} className="px-6 py-4 whitespace-nowrap">
                        {col.cell(rc)}
                      </td>
                    ))}
                  </tr>
                  {renderExpandedRow(rc)}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Rate Card Modal */}
      <Modal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        title={`${modalMode === 'create' ? 'Create' : 'Edit'} Rate Card`}
      >
        <div className="space-y-4">
          {/* Rate Type (only editable on create) */}
          {modalMode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
              <select
                value={rateFormData.rateType}
                onChange={(e) => setRateFormData({
                  ...rateFormData,
                  rateType: e.target.value as RateCardType,
                  entityId: undefined,
                  linehaulProfileId: undefined,
                  originTerminalId: undefined,
                  destinationTerminalId: undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {RATE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Entity Selection based on type */}
          {rateFormData.rateType === 'DRIVER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <select
                value={rateFormData.entityId || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, entityId: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={modalMode === 'edit'}
              >
                <option value="">Select driver...</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.number ? `(#${d.number})` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {rateFormData.rateType === 'CARRIER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              <select
                value={rateFormData.entityId || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, entityId: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={modalMode === 'edit'}
              >
                <option value="">Select carrier...</option>
                {carriers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {rateFormData.rateType === 'LINEHAUL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linehaul Profile</label>
              <select
                value={rateFormData.linehaulProfileId || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, linehaulProfileId: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                disabled={modalMode === 'edit'}
              >
                <option value="">Select profile...</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.profileCode} - {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {rateFormData.rateType === 'OD_PAIR' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin Terminal</label>
                <select
                  value={rateFormData.originTerminalId || ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, originTerminalId: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={modalMode === 'edit'}
                >
                  <option value="">Select origin...</option>
                  {terminals.map(t => (
                    <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Terminal</label>
                <select
                  value={rateFormData.destinationTerminalId || ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, destinationTerminalId: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  disabled={modalMode === 'edit'}
                >
                  <option value="">Select destination...</option>
                  {terminals.map(t => (
                    <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Rate Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Method</label>
              <select
                value={rateFormData.rateMethod}
                onChange={(e) => setRateFormData({ ...rateFormData, rateMethod: e.target.value as RateMethod })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {RATE_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Amount</label>
              <input
                type="number"
                step="0.01"
                value={rateFormData.rateAmount}
                onChange={(e) => setRateFormData({ ...rateFormData, rateAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Amount</label>
              <input
                type="number"
                step="0.01"
                value={rateFormData.minimumAmount || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, minimumAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Amount</label>
              <input
                type="number"
                step="0.01"
                value={rateFormData.maximumAmount || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, maximumAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
              <input
                type="date"
                value={rateFormData.effectiveDate}
                onChange={(e) => setRateFormData({ ...rateFormData, effectiveDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={rateFormData.expirationDate || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, expirationDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateFormData.priority ?? false}
                  onChange={(e) => setRateFormData({ ...rateFormData, priority: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">Priority (use this rate if multiple apply)</span>
              </label>
            </div>
            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateFormData.active !== false}
                  onChange={(e) => setRateFormData({ ...rateFormData, active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={rateFormData.notes || ''}
              onChange={(e) => setRateFormData({ ...rateFormData, notes: e.target.value || undefined })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Flattened Pay Rule Fields */}
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Behavioral Flags</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateFormData.autoArrive ?? false}
                  onChange={(e) => setRateFormData({ ...rateFormData, autoArrive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Auto Arrive</span>
              </label>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Flat/Trip Rates</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Per Trip ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perTrip ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perTrip: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Per Cut Trip ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perCutTrip ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perCutTrip: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Cut Miles</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cut Miles Threshold</label>
                <input
                  type="number"
                  step="0.1"
                  value={rateFormData.cutMiles ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, cutMiles: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cut Miles Type</label>
                <input
                  type="text"
                  value={rateFormData.cutMilesType ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, cutMilesType: e.target.value || undefined })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Mileage Rates ($/mi)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Single</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateFormData.perSingleMile ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perSingleMile: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Double</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateFormData.perDoubleMile ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perDoubleMile: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Triple</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateFormData.perTripleMile ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perTripleMile: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Hourly Rates ($/hr)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Work Hour</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perWorkHour ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perWorkHour: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stop Hour</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perStopHour ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perStopHour: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Drop & Hook Rates ($)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Single</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perSingleDH ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perSingleDH: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Double</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perDoubleDH ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perDoubleDH: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Triple</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perTripleDH ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perTripleDH: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Other Rates</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chain Up ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perChainUp ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perChainUp: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fuel Surcharge (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.fuelSurcharge != null ? rateFormData.fuelSurcharge * 100 : ''}
                  onChange={(e) => setRateFormData({
                    ...rateFormData,
                    fuelSurcharge: e.target.value ? parseFloat(e.target.value) / 100 : undefined
                  })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsRateModalOpen(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRate}
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Accessorial Modal */}
      <Modal
        isOpen={isAccessorialModalOpen}
        onClose={() => setIsAccessorialModalOpen(false)}
        title={`${modalMode === 'create' ? 'Add' : 'Edit'} Accessorial Rate`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accessorial Type</label>
            <select
              value={accessorialFormData.type}
              onChange={(e) => setAccessorialFormData({ ...accessorialFormData, type: e.target.value as AccessorialType })}
              disabled={modalMode === 'edit'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            >
              {ACCESSORIAL_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Amount</label>
              <input
                type="number"
                step="0.01"
                value={accessorialFormData.rateAmount}
                onChange={(e) => setAccessorialFormData({ ...accessorialFormData, rateAmount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Method</label>
              <select
                value={accessorialFormData.rateMethod}
                onChange={(e) => setAccessorialFormData({ ...accessorialFormData, rateMethod: e.target.value as RateMethod })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {RATE_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={accessorialFormData.description || ''}
              onChange={(e) => setAccessorialFormData({ ...accessorialFormData, description: e.target.value || undefined })}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsAccessorialModalOpen(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAccessorial}
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Rate Card"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete this rate card? This will also delete all associated accessorial rates. This action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRate}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Pay Rules"
      >
        <div className="space-y-6">
          {/* Step 1: Download Template */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">
                1
              </div>
              <h3 className="text-sm font-medium text-gray-900">Download Template</h3>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-3">
                Download the CSV template to ensure your data is formatted correctly for import.
              </p>
              <button
                onClick={() => {
                  const headers = [
                    'rateType', 'entityId', 'linehaulProfileId', 'originTerminalId', 'destinationTerminalId',
                    'rateMethod', 'rateAmount', 'minimumAmount', 'maximumAmount', 'effectiveDate', 'expirationDate',
                    'equipmentType', 'priority', 'notes', 'externalRateId',
                    // Flattened pay rule fields
                    'autoArrive', 'perTrip', 'perCutTrip', 'cutMiles', 'cutMilesType',
                    'perSingleMile', 'perDoubleMile', 'perTripleMile', 'perWorkHour', 'perStopHour',
                    'perSingleDH', 'perDoubleDH', 'perTripleDH', 'perChainUp', 'fuelSurcharge'
                  ];
                  const exampleRows = [
                    ['DRIVER', '123', '', '', '', 'PER_MILE', '0.55', '', '', '2026-01-01', '', '', 'false', 'Driver rate example', 'EXT-001', 'false', '', '250', '', '', '0.55', '0.65', '0.75', '', '', '25', '35', '45', '50', ''],
                    ['CARRIER', '456', '', '', '', 'FLAT_RATE', '350.00', '300.00', '500.00', '2026-01-01', '2026-12-31', '', 'true', 'Carrier rate', 'EXT-002', 'true', '400', '', '150', 'single', '', '', '', '35', '25', '', '', '', '75', '0.05']
                  ];
                  const csvContent = [headers.join(','), ...exampleRows.map(row => row.join(','))].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'pay_rules_import_template.csv';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                  toast.success('Template downloaded');
                }}
                className="inline-flex items-center px-4 py-2 text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Download CSV Template
              </button>
            </div>
          </div>

          {/* Step 2: Upload File */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-medium">
                2
              </div>
              <h3 className="text-sm font-medium text-gray-900">Upload File</h3>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 mb-2">Drop your file here or click to browse</p>
              <input
                type="file"
                accept=".csv,.json"
                className="hidden"
                id="import-file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    const text = await file.text();
                    let rateCards: ImportRateCardData[];

                    if (file.name.endsWith('.json')) {
                      const data = JSON.parse(text);
                      rateCards = Array.isArray(data) ? data : data.rateCards;
                    } else {
                      const lines = text.split('\n');
                      const headers = lines[0].split(',').map(h => h.trim());
                      rateCards = lines.slice(1).filter(line => line.trim()).map(line => {
                        const values = line.split(',');
                        const obj: any = {};
                        headers.forEach((h, i) => {
                          obj[h] = values[i]?.trim();
                        });
                        return {
                          rateType: obj.rateType || 'DRIVER',
                          entityId: obj.entityId ? parseInt(obj.entityId) : undefined,
                          linehaulProfileId: obj.linehaulProfileId ? parseInt(obj.linehaulProfileId) : undefined,
                          originTerminalId: obj.originTerminalId ? parseInt(obj.originTerminalId) : undefined,
                          destinationTerminalId: obj.destinationTerminalId ? parseInt(obj.destinationTerminalId) : undefined,
                          rateMethod: obj.rateMethod || 'PER_MILE',
                          rateAmount: parseFloat(obj.rateAmount) || 0,
                          minimumAmount: obj.minimumAmount ? parseFloat(obj.minimumAmount) : undefined,
                          maximumAmount: obj.maximumAmount ? parseFloat(obj.maximumAmount) : undefined,
                          effectiveDate: obj.effectiveDate || new Date().toISOString().split('T')[0],
                          expirationDate: obj.expirationDate || undefined,
                          equipmentType: obj.equipmentType || undefined,
                          priority: obj.priority === 'true' || obj.priority === 'Yes' || obj.priority === '1',
                          notes: obj.notes || undefined,
                          externalRateId: obj.externalRateId,
                          // Flattened pay rule fields
                          autoArrive: obj.autoArrive === 'true' || obj.autoArrive === 'Yes' || obj.autoArrive === '1',
                          perTrip: obj.perTrip ? parseFloat(obj.perTrip) : undefined,
                          perCutTrip: obj.perCutTrip ? parseFloat(obj.perCutTrip) : undefined,
                          cutMiles: obj.cutMiles ? parseFloat(obj.cutMiles) : undefined,
                          cutMilesType: obj.cutMilesType || undefined,
                          perSingleMile: obj.perSingleMile ? parseFloat(obj.perSingleMile) : undefined,
                          perDoubleMile: obj.perDoubleMile ? parseFloat(obj.perDoubleMile) : undefined,
                          perTripleMile: obj.perTripleMile ? parseFloat(obj.perTripleMile) : undefined,
                          perWorkHour: obj.perWorkHour ? parseFloat(obj.perWorkHour) : undefined,
                          perStopHour: obj.perStopHour ? parseFloat(obj.perStopHour) : undefined,
                          perSingleDH: obj.perSingleDH ? parseFloat(obj.perSingleDH) : undefined,
                          perDoubleDH: obj.perDoubleDH ? parseFloat(obj.perDoubleDH) : undefined,
                          perTripleDH: obj.perTripleDH ? parseFloat(obj.perTripleDH) : undefined,
                          perChainUp: obj.perChainUp ? parseFloat(obj.perChainUp) : undefined,
                          fuelSurcharge: obj.fuelSurcharge ? parseFloat(obj.fuelSurcharge) : undefined
                        };
                      });
                    }

                    const result = await payRulesService.importRateCards(rateCards);
                    toast.success(result.message);
                    setIsImportModalOpen(false);
                    fetchRateCards();
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to import file');
                  }
                }}
              />
              <label
                htmlFor="import-file"
                className="inline-block px-4 py-2 text-indigo-600 border border-indigo-600 rounded-lg cursor-pointer hover:bg-indigo-50"
              >
                Select File
              </label>
            </div>
          </div>

          {/* Supported formats info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 mb-2">Supported Rate Types:</p>
            <ul className="text-sm text-blue-700 grid grid-cols-2 gap-1">
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">DRIVER</span> - Driver-specific rate</li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">CARRIER</span> - Carrier rate</li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">LINEHAUL</span> - Linehaul profile rate</li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">OD_PAIR</span> - Origin/Destination pair</li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">DEFAULT</span> - Default fallback rate</li>
            </ul>
            <p className="text-sm font-medium text-blue-800 mt-3 mb-2">Supported Rate Methods:</p>
            <ul className="text-sm text-blue-700 grid grid-cols-2 gap-1">
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">PER_MILE</span></li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">FLAT_RATE</span></li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">HOURLY</span></li>
              <li><span className="font-mono text-xs bg-blue-100 px-1 rounded">PERCENTAGE</span></li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PayRules;
