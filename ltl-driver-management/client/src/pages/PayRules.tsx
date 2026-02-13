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
  ArrowUpDown,
  Settings
} from 'lucide-react';

const RATE_TYPES: { value: RateCardType; label: string; icon: React.ReactNode }[] = [
  { value: 'CARRIER', label: 'Carrier', icon: <Truck className="w-4 h-4" /> },
  { value: 'DRIVER', label: 'Driver', icon: <User className="w-4 h-4" /> }
];

const RATE_METHODS: { value: RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION'; label: string }[] = [
  { value: 'PER_MILE', label: 'Per Mile' },
  { value: 'LINEHAUL_PROFILE', label: 'Linehaul Profile' },
  { value: 'ORIGIN_DESTINATION', label: 'Origin/Destination' },
  { value: 'HOURLY', label: 'Hourly' }
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
  const [methodFilter, setMethodFilter] = useState<RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION' | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');

  // Sort states
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
    rateType: 'CARRIER',
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
        if (methodFilter === 'LINEHAUL_PROFILE') {
          // Filter rate cards that have a linehaul profile linked
          filteredCards = filteredCards.filter(rc => rc.linehaulProfileId != null);
        } else if (methodFilter === 'ORIGIN_DESTINATION') {
          // Filter rate cards that have both origin and destination terminals
          filteredCards = filteredCards.filter(rc => rc.originTerminalId != null && rc.destinationTerminalId != null);
        } else {
          filteredCards = filteredCards.filter(rc => rc.rateMethod === methodFilter);
        }
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
      rateType: 'CARRIER',
      rateMethod: 'PER_MILE',
      rateAmount: 0,
      effectiveDate: new Date().toISOString().split('T')[0]
    });
    setIsRateModalOpen(true);
  };

  const openEditModal = (rateCard: RateCard) => {
    setModalMode('edit');
    setSelectedRateCard(rateCard);

    // Try to find entityId from rate card or match from available data
    let entityId: number | undefined = undefined;

    if (rateCard.rateType === 'DRIVER') {
      // For DRIVER type, try multiple methods to find the correct driver
      // 1. First try entityId if it exists and matches a driver in our list
      if (rateCard.entityId) {
        const driverExists = drivers.find(d => d.id === rateCard.entityId);
        if (driverExists) {
          entityId = rateCard.entityId;
        }
      }

      // 2. If not found, try driver.id from enriched data (if it's a valid ID > 0)
      if (!entityId && rateCard.driver?.id && rateCard.driver.id > 0) {
        const driverExists = drivers.find(d => d.id === rateCard.driver!.id);
        if (driverExists) {
          entityId = rateCard.driver.id;
        }
      }

      // 3. If still not found, try to match by driver name from enriched data
      if (!entityId && rateCard.driver?.name) {
        const matchedDriver = drivers.find(d =>
          d.name?.toLowerCase() === rateCard.driver!.name.toLowerCase()
        );
        if (matchedDriver) {
          entityId = matchedDriver.id;
        }
      }

      // 4. Finally, try to match from notes
      if (!entityId) {
        const notesInfo = parseNotesInfo(rateCard.notes);
        if (notesInfo.driverName) {
          const matchedDriver = drivers.find(d =>
            d.name?.toLowerCase() === notesInfo.driverName?.toLowerCase() ||
            d.name?.toLowerCase().includes(notesInfo.driverName?.toLowerCase() || '') ||
            notesInfo.driverName?.toLowerCase().includes(d.name?.toLowerCase() || '')
          );
          if (matchedDriver) {
            entityId = matchedDriver.id;
          }
        }
      }
    }

    if (rateCard.rateType === 'CARRIER') {
      // For CARRIER type, try multiple methods to find the correct carrier
      // 1. First try entityId if it exists and matches a carrier in our list
      if (rateCard.entityId) {
        const carrierExists = carriers.find(c => c.id === rateCard.entityId);
        if (carrierExists) {
          entityId = rateCard.entityId;
        }
      }

      // 2. If not found, try carrier.id from enriched data (if it's a valid ID > 0)
      if (!entityId && rateCard.carrier?.id && rateCard.carrier.id > 0) {
        const carrierExists = carriers.find(c => c.id === rateCard.carrier!.id);
        if (carrierExists) {
          entityId = rateCard.carrier.id;
        }
      }

      // 3. If still not found, try to match by carrier name from enriched data
      if (!entityId && rateCard.carrier?.name) {
        const matchedCarrier = carriers.find(c =>
          c.name?.toLowerCase() === rateCard.carrier!.name.toLowerCase()
        );
        if (matchedCarrier) {
          entityId = matchedCarrier.id;
        }
      }

      // 4. Finally, try to match from notes
      if (!entityId) {
        const notesInfo = parseNotesInfo(rateCard.notes);
        if (notesInfo.employer) {
          const matchedCarrier = carriers.find(c =>
            c.name?.toLowerCase() === notesInfo.employer?.toLowerCase() ||
            c.name?.toLowerCase().includes(notesInfo.employer?.toLowerCase() || '') ||
            notesInfo.employer?.toLowerCase().includes(c.name?.toLowerCase() || '')
          );
          if (matchedCarrier) {
            entityId = matchedCarrier.id;
          }
        }
      }
    }

    // Determine rate method - check if it's actually LINEHAUL_PROFILE or ORIGIN_DESTINATION based on linked data
    let rateMethod = rateCard.rateMethod;
    if (rateCard.linehaulProfileId && rateMethod === 'PER_MILE') {
      rateMethod = 'LINEHAUL_PROFILE' as RateMethod;
    } else if (rateCard.originTerminalId && rateCard.destinationTerminalId && rateMethod === 'PER_MILE') {
      rateMethod = 'ORIGIN_DESTINATION' as RateMethod;
    }

    setRateFormData({
      rateType: rateCard.rateType,
      entityId: entityId || undefined,
      linehaulProfileId: rateCard.linehaulProfileId || undefined,
      originTerminalId: rateCard.originTerminalId || undefined,
      destinationTerminalId: rateCard.destinationTerminalId || undefined,
      rateMethod: rateMethod,
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
      // Convert UI-only rate methods back to valid backend values
      const getActualRateMethod = (method: RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION'): RateMethod => {
        if (method === 'LINEHAUL_PROFILE' || method === 'ORIGIN_DESTINATION') {
          return 'PER_MILE'; // These are determined by linked data, not rate method
        }
        return method as RateMethod;
      };

      if (modalMode === 'create') {
        const createData = {
          ...rateFormData,
          rateMethod: getActualRateMethod(rateFormData.rateMethod as RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION')
        };
        await payRulesService.createRateCard(createData);
        toast.success('Rate card created successfully');
      } else if (selectedRateCard) {
        const updateData: UpdateRateCardData = {
          // Include entity linkage fields so we can update/fix driver/carrier links
          rateType: rateFormData.rateType,
          entityId: rateFormData.entityId,
          linehaulProfileId: rateFormData.linehaulProfileId,
          originTerminalId: rateFormData.originTerminalId,
          destinationTerminalId: rateFormData.destinationTerminalId,
          rateMethod: getActualRateMethod(rateFormData.rateMethod as RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION'),
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

  // Helper to format rate value
  const formatRate = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return `$${num.toFixed(2)}`;
  };

  // Helper to parse driver/employer/fsc info from notes (fallback when not linked)
  const parseNotesInfo = (notes: string | undefined | null) => {
    if (!notes) return { driverName: null, employer: null, fuelSurcharge: null };
    // Match both formats: "Driver: Name", "driverName: Name", "Driver Name: Name"
    const driverMatch = notes.match(/(?:Driver|driverName|Driver Name):\s*([^;.]+)/i);
    const employerMatch = notes.match(/(?:Employer|employer):\s*([^;.]+)/i);
    const fscMatch = notes.match(/Fuel\s*Surcharge:\s*([^;.\n]+)/i);
    return {
      driverName: driverMatch ? driverMatch[1].trim() : null,
      employer: employerMatch ? employerMatch[1].trim() : null,
      fuelSurcharge: fscMatch ? fscMatch[1].trim() : null
    };
  };

  // Helper to parse O/D info from notes
  const parseODFromNotes = (notes: string | undefined | null) => {
    if (!notes) return { origin: null, dest: null };
    const origMatch = notes.match(/dispatchOrig:\s*([^;\s]+)/i);
    const destMatch = notes.match(/dest:\s*([^;\s]+)/i);
    return {
      origin: origMatch ? origMatch[1].trim() : null,
      dest: destMatch ? destMatch[1].trim() : null
    };
  };

  // Handle column sort click
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      // Toggle direction or clear sort
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Get sortable value from rate card for a given column
  const getSortValue = (rc: RateCard, key: string): string | number | boolean | null => {
    switch (key) {
      case 'rateType':
        return rc.rateType;
      case 'driverName':
        return rc.driver?.name || parseNotesInfo(rc.notes).driverName || '';
      case 'driverNumber':
        return rc.driver?.number || '';
      case 'employer':
        if (rc.rateType === 'DRIVER') {
          return rc.driver?.carrier?.name || parseNotesInfo(rc.notes).employer || '';
        }
        return rc.carrier?.name || parseNotesInfo(rc.notes).employer || '';
      case 'origin':
        return rc.originTerminal?.code || parseODFromNotes(rc.notes).origin || '';
      case 'dest':
        return rc.destinationTerminal?.code || parseODFromNotes(rc.notes).dest || '';
      case 'linehaulProfile':
        return rc.linehaulProfile?.profileCode || rc.linehaulProfile?.name || '';
      case 'perTrip':
        return rc.perTrip ? Number(rc.perTrip) : 0;
      case 'perMile':
        return rc.perSingleMile ? Number(rc.perSingleMile) : 0;
      case 'perHour':
        return rc.perWorkHour ? Number(rc.perWorkHour) : 0;
      case 'fsc':
        return parseNotesInfo(rc.notes).fuelSurcharge || (rc.fuelSurcharge ? Number(rc.fuelSurcharge) : 0);
      case 'priority':
        return rc.priority ? 1 : 0;
      case 'active':
        return rc.active ? 1 : 0;
      default:
        return '';
    }
  };

  // Sort rate cards
  const sortedRateCards = React.useMemo(() => {
    if (!sortColumn) return rateCards;

    return [...rateCards].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);

      // Handle nulls
      if (aVal === null || aVal === '') return sortDirection === 'asc' ? 1 : -1;
      if (bVal === null || bVal === '') return sortDirection === 'asc' ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rateCards, sortColumn, sortDirection]);

  const columns = [
    {
      header: '',
      accessor: 'id' as keyof RateCard,
      sortKey: null as string | null,
      cell: (rc: RateCard) => (
        <button
          onClick={() => toggleRowExpand(rc.id)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
        >
          {expandedRows.has(rc.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )
    },
    {
      header: 'Type',
      accessor: 'rateType' as keyof RateCard,
      sortKey: 'rateType',
      cell: (rc: RateCard) => {
        const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
          'DRIVER': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'D' },
          'CARRIER': { bg: 'bg-green-100', text: 'text-green-700', label: 'C' },
          'OD_PAIR': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'OD' },
          'LINEHAUL': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'LH' },
          'DEFAULT': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Def' }
        };
        const cfg = typeConfig[rc.rateType] || typeConfig['DEFAULT'];
        return (
          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${cfg.bg} ${cfg.text}`} title={rc.rateType}>
            {cfg.label}
          </span>
        );
      }
    },
    {
      header: 'Driver',
      accessor: 'entityId' as keyof RateCard,
      sortKey: 'driverName',
      cell: (rc: RateCard) => {
        if (rc.rateType === 'DRIVER') {
          const name = rc.driver?.name || parseNotesInfo(rc.notes).driverName;
          const num = rc.driver?.number;
          return (
            <div className="text-xs min-w-[140px]">
              <div className="font-medium text-gray-900 truncate max-w-[180px]" title={name || ''}>{name || '-'}</div>
              {num && <div className="text-gray-500">#{num}</div>}
            </div>
          );
        }
        if (rc.rateType === 'OD_PAIR') {
          const name = parseNotesInfo(rc.notes).driverName;
          if (name) return <span className="text-xs font-medium text-blue-600 truncate max-w-[180px] min-w-[140px]" title={name}>{name}</span>;
        }
        return <span className="text-gray-400 text-xs">-</span>;
      }
    },
    {
      header: 'Carrier',
      accessor: 'carrier' as keyof RateCard,
      sortKey: 'employer',
      cell: (rc: RateCard) => {
        let name = '';
        if (rc.rateType === 'DRIVER') {
          name = rc.driver?.carrier?.name || parseNotesInfo(rc.notes).employer || '';
        } else if ((rc.rateType === 'CARRIER' || rc.rateType === 'OD_PAIR') && rc.carrier?.name) {
          name = rc.carrier.name;
        } else if (rc.rateType === 'OD_PAIR') {
          name = parseNotesInfo(rc.notes).employer || '';
        }
        if (!name) return <span className="text-gray-400 text-xs">-</span>;
        return <span className="text-xs text-gray-700 truncate max-w-[80px]" title={name}>{name}</span>;
      }
    },
    {
      header: 'Profile',
      accessor: 'linehaulProfileId' as keyof RateCard,
      sortKey: 'linehaulProfile',
      cell: (rc: RateCard) => {
        const code = rc.linehaulProfile?.profileCode || rc.linehaulProfile?.name;
        if (code) return <span className="text-xs font-mono text-orange-600">{code}</span>;
        if (rc.linehaulProfileId) {
          const profile = profiles.find(p => p.id === rc.linehaulProfileId);
          if (profile) return <span className="text-xs font-mono text-orange-600">{profile.profileCode || profile.name}</span>;
        }
        return <span className="text-gray-400 text-xs">-</span>;
      }
    },
    {
      header: 'O/D',
      accessor: 'originTerminalId' as keyof RateCard,
      sortKey: 'origin',
      cell: (rc: RateCard) => {
        const origin = rc.originTerminal?.code || parseODFromNotes(rc.notes).origin;
        const dest = rc.destinationTerminal?.code || parseODFromNotes(rc.notes).dest;
        if (!origin && !dest) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <span className="text-xs font-mono text-purple-600">
            {origin || '?'}→{dest || '?'}
          </span>
        );
      }
    },
    {
      header: 'Trip',
      accessor: 'perTrip' as keyof RateCard,
      sortKey: 'perTrip',
      cell: (rc: RateCard) => {
        const trip = rc.perTrip;
        const cutTrip = rc.perCutTrip;
        if (!trip && !cutTrip) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <div className="text-xs">
            {trip && <div className="text-green-600">{formatRate(trip)}</div>}
            {cutTrip && <div className="text-orange-500 text-[10px]">C:{formatRate(cutTrip)}</div>}
          </div>
        );
      }
    },
    {
      header: '$/Mi S/D/T',
      accessor: 'perSingleMile' as keyof RateCard,
      sortKey: 'perMile',
      cell: (rc: RateCard) => {
        const s = rc.perSingleMile;
        const d = rc.perDoubleMile;
        const t = rc.perTripleMile;
        if (!s && !d && !t) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <span className="text-[10px] font-mono text-gray-700">
            {s ? Number(s).toFixed(2) : '-'}/{d ? Number(d).toFixed(2) : '-'}/{t ? Number(t).toFixed(2) : '-'}
          </span>
        );
      }
    },
    {
      header: '$/Hr W/S',
      accessor: 'perWorkHour' as keyof RateCard,
      sortKey: 'perHour',
      cell: (rc: RateCard) => {
        const work = rc.perWorkHour;
        const stop = rc.perStopHour;
        if (!work && !stop) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <span className="text-[10px] font-mono text-blue-600">
            {work ? Number(work).toFixed(0) : '-'}/{stop ? Number(stop).toFixed(0) : '-'}
          </span>
        );
      }
    },
    {
      header: 'D&H S/D/T',
      accessor: 'perSingleDH' as keyof RateCard,
      sortKey: null as string | null,
      cell: (rc: RateCard) => {
        const s = rc.perSingleDH;
        const d = rc.perDoubleDH;
        const t = rc.perTripleDH;
        if (!s && !d && !t) return <span className="text-gray-400 text-xs">-</span>;
        return (
          <span className="text-[10px] font-mono text-purple-600">
            {s ? Number(s).toFixed(0) : '-'}/{d ? Number(d).toFixed(0) : '-'}/{t ? Number(t).toFixed(0) : '-'}
          </span>
        );
      }
    },
    {
      header: 'FSC',
      accessor: 'fuelSurcharge' as keyof RateCard,
      sortKey: 'fsc',
      cell: (rc: RateCard) => {
        const fsc = parseNotesInfo(rc.notes).fuelSurcharge;
        const fscValue = rc.fuelSurcharge;
        if (fsc) return <span className="text-[10px] font-mono text-teal-600">{fsc}</span>;
        if (fscValue) return <span className="text-[10px] text-teal-600">{Number(fscValue).toFixed(1)}%</span>;
        return <span className="text-gray-400 text-xs">-</span>;
      }
    },
    {
      header: '',
      accessor: 'priority' as keyof RateCard,
      sortKey: 'priority',
      cell: (rc: RateCard) => (
        <div className="flex items-center gap-1">
          {rc.priority && <span className="w-2 h-2 rounded-full bg-yellow-400" title="Priority" />}
          <span className={`w-2 h-2 rounded-full ${rc.active ? 'bg-green-500' : 'bg-gray-300'}`} title={rc.active ? 'Active' : 'Inactive'} />
        </div>
      )
    },
    ...(isAdmin ? [{
      header: 'Actions',
      accessor: 'id' as keyof RateCard,
      sortKey: null as string | null,
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

    const notesInfo = parseNotesInfo(rateCard.notes);
    const odInfo = parseODFromNotes(rateCard.notes);

    return (
      <tr key={`expanded-${rateCard.id}`} className="bg-gray-50">
        <td colSpan={columns.length} className="px-3 py-3">
          <div className="ml-4">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Additional Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {rateCard.autoArrive && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-blue-600">Auto Arrive</div>
                  <div className="text-sm font-medium text-blue-800">Yes</div>
                </div>
              )}
              {rateCard.cutMiles && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-orange-600">Cut Miles</div>
                  <div className="text-sm font-medium text-orange-800">{Number(rateCard.cutMiles).toFixed(1)} {rateCard.cutMilesType || ''}</div>
                </div>
              )}
              {rateCard.perChainUp && (
                <div className="bg-white border rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Chain Up</div>
                  <div className="text-sm font-medium">${Number(rateCard.perChainUp).toFixed(2)}</div>
                </div>
              )}
              {(rateCard.fuelSurcharge || notesInfo.fuelSurcharge) && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-teal-600">Fuel Surcharge</div>
                  <div className="text-sm font-medium text-teal-800">
                    {notesInfo.fuelSurcharge || `${Number(rateCard.fuelSurcharge).toFixed(2)}%`}
                  </div>
                </div>
              )}
              {/* Show O/D from notes if not already linked to terminals */}
              {rateCard.rateType === 'OD_PAIR' && !rateCard.originTerminalId && odInfo.origin && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-purple-600">Origin (Notes)</div>
                  <div className="text-sm font-medium text-purple-800">{odInfo.origin}</div>
                </div>
              )}
              {rateCard.rateType === 'OD_PAIR' && !rateCard.destinationTerminalId && odInfo.dest && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-purple-600">Dest (Notes)</div>
                  <div className="text-sm font-medium text-purple-800">{odInfo.dest}</div>
                </div>
              )}
              {/* Show driver from notes for OD_PAIR if present */}
              {rateCard.rateType === 'OD_PAIR' && notesInfo.driverName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <div className="text-xs text-blue-600">Driver (Lane-Specific)</div>
                  <div className="text-sm font-medium text-blue-800">{notesInfo.driverName}</div>
                </div>
              )}
            </div>

            {rateCard.notes && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Notes:</span> {rateCard.notes}
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
            onChange={(e) => setMethodFilter(e.target.value as RateMethod | 'LINEHAUL_PROFILE' | 'ORIGIN_DESTINATION' | '')}
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
                    className={`px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide ${
                      col.sortKey ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                    }`}
                    onClick={() => col.sortKey && handleSort(col.sortKey)}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortKey && (
                        <span className="text-gray-400">
                          {sortColumn === col.sortKey ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-indigo-600" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedRateCards.map(rc => (
                <React.Fragment key={rc.id}>
                  <tr className={`hover:bg-gray-50 ${expandedRows.has(rc.id) ? 'bg-indigo-50' : ''}`}>
                    {columns.map((col, idx) => (
                      <td key={idx} className="px-2 py-2 whitespace-nowrap">
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
        size="4xl"
      >
        <div className="space-y-4">
          {/* Row 1: Rate Type, Entity Selection, Rate Method */}
          <div className="grid grid-cols-3 gap-4">
            {/* Rate Type */}
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

            {/* Entity Selection based on type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {rateFormData.rateType === 'DRIVER' ? 'Driver' : 'Carrier'}
              </label>
              {rateFormData.rateType === 'DRIVER' ? (
                <select
                  value={rateFormData.entityId || ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, entityId: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select driver...</option>
                  {[...drivers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(d => (
                    <option key={d.id} value={d.id}>{d.name} {d.number ? `(#${d.number})` : ''}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={rateFormData.entityId || ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, entityId: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select carrier...</option>
                  {[...carriers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Rate Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Method</label>
              <select
                value={rateFormData.rateMethod}
                onChange={(e) => setRateFormData({
                  ...rateFormData,
                  rateMethod: e.target.value as RateMethod,
                  linehaulProfileId: e.target.value !== 'LINEHAUL_PROFILE' ? undefined : rateFormData.linehaulProfileId
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {RATE_METHODS.map(method => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Linehaul Profile Selection (when rate method is Linehaul Profile) */}
          {rateFormData.rateMethod === 'LINEHAUL_PROFILE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linehaul Profile</label>
              <select
                value={rateFormData.linehaulProfileId || ''}
                onChange={(e) => setRateFormData({ ...rateFormData, linehaulProfileId: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select profile...</option>
                {[...profiles].sort((a, b) => (a.profileCode || '').localeCompare(b.profileCode || '')).map(p => (
                  <option key={p.id} value={p.id}>{p.profileCode} - {p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Origin/Destination Selection (when rate method is Origin/Destination) */}
          {rateFormData.rateMethod === 'ORIGIN_DESTINATION' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Origin Terminal</label>
                <select
                  value={rateFormData.originTerminalId || ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, originTerminalId: parseInt(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select origin...</option>
                  {[...terminals].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(t => (
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
                >
                  <option value="">Select destination...</option>
                  {[...terminals].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(t => (
                    <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Row 2: Dates, Priority, Active, Auto Arrive */}
          <div className="grid grid-cols-5 gap-4">
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
            <div className="flex items-end pb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateFormData.priority ?? false}
                  onChange={(e) => setRateFormData({ ...rateFormData, priority: e.target.checked })}
                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Priority</span>
              </label>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rateFormData.active !== false}
                  onChange={(e) => setRateFormData({ ...rateFormData, active: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
            <div className="flex items-end pb-2">
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

          {/* Rate Fields Section */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-6 gap-3">
              {/* Flat/Trip Rates */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Per Trip ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perTrip ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perTrip: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Per Cut Trip ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perCutTrip ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perCutTrip: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cut Miles</label>
                <input
                  type="number"
                  step="0.1"
                  value={rateFormData.cutMiles ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, cutMiles: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cut Miles Type</label>
                <input
                  type="text"
                  value={rateFormData.cutMilesType ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, cutMilesType: e.target.value || undefined })}
                  placeholder="Type"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chain Up ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rateFormData.perChainUp ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perChainUp: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Mileage Rates */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Mileage Rates ($/mi)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Single</label>
                <input
                  type="number"
                  step="0.0001"
                  value={rateFormData.perSingleMile ?? ''}
                  onChange={(e) => setRateFormData({ ...rateFormData, perSingleMile: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.0000"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Hourly and Drop & Hook Rates */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Hourly Rates ($/hr)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Work Hour</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rateFormData.perWorkHour ?? ''}
                      onChange={(e) => setRateFormData({ ...rateFormData, perWorkHour: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Drop & Hook Rates ($)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Single</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rateFormData.perSingleDH ?? ''}
                      onChange={(e) => setRateFormData({ ...rateFormData, perSingleDH: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              type="text"
              value={rateFormData.notes || ''}
              onChange={(e) => setRateFormData({ ...rateFormData, notes: e.target.value || undefined })}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
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
