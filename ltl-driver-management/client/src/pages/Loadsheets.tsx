import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable, SortDirection } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Search } from '../components/common/Search';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CreateLoadsheetModal } from '../components/loadsheet/CreateLoadsheetModal';
import { LoadsheetShipmentsModal } from '../components/loadsheet/LoadsheetShipmentsModal';
import { loadsheetService } from '../services/loadsheetService';
import { terminalService } from '../services/terminalService';
import { equipmentService } from '../services/equipmentService';
import { linehaulProfileService } from '../services/linehaulProfileService';
import { Loadsheet, LoadsheetStatus, Terminal, EquipmentTrailer, LinehaulProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  Printer,
  Filter,
  MapPin,
  Calendar,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

const statusFilterOptions: { value: LoadsheetStatus | ''; label: string }[] = [
  { value: '', label: 'Available (Open/Loading)' },
  { value: 'OPEN', label: 'Open Only' },
  { value: 'LOADING', label: 'Loading Only' }
];

const getStatusVariant = (status: LoadsheetStatus): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case 'OPEN':
      return 'info';
    case 'LOADING':
      return 'warning';
    case 'CLOSED':
      return 'success';
    case 'DISPATCHED':
      return 'default';
    default:
      return 'default';
  }
};

export const Loadsheets: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadsheets, setLoadsheets] = useState<Loadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminals, setTerminals] = useState<Terminal[]>([]);

  // Filters - persisted to localStorage
  const [filters, , updateFilter] = usePersistedFilters('loadsheets-filters', {
    searchTerm: '',
    statusFilter: '' as LoadsheetStatus | '',
    locationFilter: '',
    startDate: '',
    endDate: '',
    sortBy: 'loadDate' as keyof Loadsheet | null,
    sortDirection: 'desc' as SortDirection,
  });
  const { searchTerm, statusFilter, locationFilter, startDate, endDate, sortBy, sortDirection } = filters;
  const setSearchTerm = (v: string) => updateFilter('searchTerm', v);
  const setStatusFilter = (v: LoadsheetStatus | '') => updateFilter('statusFilter', v);
  const setLocationFilter = (v: string) => updateFilter('locationFilter', v);
  const setStartDate = (v: string) => updateFilter('startDate', v);
  const setEndDate = (v: string) => updateFilter('endDate', v);
  const setSortBy = (v: keyof Loadsheet | null) => updateFilter('sortBy', v);
  const setSortDirection = (v: SortDirection) => updateFilter('sortDirection', v);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShipmentsModalOpen, setIsShipmentsModalOpen] = useState(false);
  const [selectedLoadsheet, setSelectedLoadsheet] = useState<Loadsheet | null>(null);
  const [shipmentsLoadsheet, setShipmentsLoadsheet] = useState<Loadsheet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit modal form state
  const [editLinehaulName, setEditLinehaulName] = useState('');
  const [editTrailerNumber, setEditTrailerNumber] = useState('');
  const [editStatus, setEditStatus] = useState<LoadsheetStatus>('OPEN');
  const [editDoNotLoadHazmat, setEditDoNotLoadHazmat] = useState(false);
  const [editDoorNumber, setEditDoorNumber] = useState('');

  // Data for dropdowns
  const [trailers, setTrailers] = useState<EquipmentTrailer[]>([]);
  const [linehaulProfiles, setLinehaulProfiles] = useState<LinehaulProfile[]>([]);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchTerminals();
    fetchTrailers();
    fetchLinehaulProfiles();
  }, []);

  useEffect(() => {
    fetchLoadsheets();
  }, [currentPage, searchTerm, statusFilter, locationFilter, startDate, endDate, terminals]);

  const fetchTerminals = async () => {
    try {
      const terminalsList = await terminalService.getTerminalsList();
      setTerminals(terminalsList);
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  };

  const fetchTrailers = async () => {
    try {
      const response = await equipmentService.getTrailers({ limit: 500 });
      setTrailers(response.trailers || []);
    } catch (error) {
      console.error('Failed to fetch trailers:', error);
    }
  };

  const fetchLinehaulProfiles = async () => {
    try {
      const profiles = await linehaulProfileService.getProfilesList();
      setLinehaulProfiles(profiles);
    } catch (error) {
      console.error('Failed to fetch linehaul profiles:', error);
    }
  };

  // Find terminal ID and code from the typed location filter
  const getTerminalFromFilter = (): { id?: number; code?: string } => {
    if (!locationFilter) return {};
    const terminal = terminals.find(
      t => t.code.toLowerCase() === locationFilter.toLowerCase() ||
           `${t.code} - ${t.name}`.toLowerCase() === locationFilter.toLowerCase()
    );
    if (terminal) {
      return { id: terminal.id, code: terminal.code };
    }
    // If no exact match, use the filter value as a code
    return { code: locationFilter.toUpperCase() };
  };

  const fetchLoadsheets = async () => {
    try {
      setLoading(true);
      const terminalFilter = getTerminalFromFilter();
      const response = await loadsheetService.getLoadsheets({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        originTerminalId: terminalFilter.id,
        originTerminalCode: terminalFilter.code,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        limit: 20
      });
      setLoadsheets(response.loadsheets);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (error) {
      toast.error('Failed to fetch loadsheets');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (loadsheet: Loadsheet) => {
    try {
      const blob = await loadsheetService.downloadLoadsheet(loadsheet.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loadsheet-${loadsheet.manifestNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Loadsheet downloaded');
    } catch (error) {
      toast.error('Failed to download loadsheet');
    }
  };

  const handleDelete = async () => {
    if (!selectedLoadsheet) return;
    try {
      setDeleting(true);
      await loadsheetService.deleteLoadsheet(selectedLoadsheet.id);
      toast.success('Loadsheet deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedLoadsheet(null);
      fetchLoadsheets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete loadsheet');
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (loadsheet: Loadsheet) => {
    setSelectedLoadsheet(loadsheet);
    setEditLinehaulName(loadsheet.linehaulName || '');
    setEditTrailerNumber(loadsheet.trailerNumber || '');
    setEditStatus(loadsheet.status);
    setEditDoNotLoadHazmat(loadsheet.doNotLoadPlacardableHazmat || false);
    setEditDoorNumber(loadsheet.doorNumber || '');
    setIsEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedLoadsheet) return;

    if (!editTrailerNumber || !editLinehaulName) {
      toast.error('Trailer number and linehaul name are required');
      return;
    }

    try {
      setSaving(true);
      await loadsheetService.updateLoadsheet(selectedLoadsheet.id, {
        trailerNumber: editTrailerNumber,
        linehaulName: editLinehaulName,
        status: editStatus,
        doNotLoadPlacardableHazmat: editDoNotLoadHazmat,
        doorNumber: editDoorNumber || undefined
      });
      toast.success('Loadsheet updated successfully');
      setIsEditModalOpen(false);
      setSelectedLoadsheet(null);
      fetchLoadsheets();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update loadsheet');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async (loadsheet: Loadsheet) => {
    try {
      toast.loading('Preparing print...', { id: 'print-loading' });
      const blob = await loadsheetService.downloadLoadsheet(loadsheet.id);
      const url = window.URL.createObjectURL(blob);

      // Create a hidden iframe for printing
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
            // If iframe print fails (cross-origin), open in new tab
            window.open(url, '_blank');
          }
          // Clean up after a delay to allow print dialog to open
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        }, 500); // Give PDF time to render in iframe
      };

      document.body.appendChild(iframe);
    } catch (error) {
      toast.dismiss('print-loading');
      toast.error('Failed to print loadsheet');
    }
  };

  const handleSort = (column: keyof Loadsheet) => {
    if (sortBy === column) {
      // Cycle through: asc -> desc -> null
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

  const sortedLoadsheets = React.useMemo(() => {
    if (!sortBy || !sortDirection) {
      return loadsheets;
    }

    return [...loadsheets].sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      // Handle date fields
      if (sortBy === 'loadDate' || sortBy === 'lastScanAt' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle number comparison
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [loadsheets, sortBy, sortDirection]);

  const columns = [
    {
      accessor: 'manifestNumber' as keyof Loadsheet,
      header: 'Manifest #',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span
          role="button"
          tabIndex={0}
          onClick={() => {
            console.log('Manifest clicked:', loadsheet.manifestNumber);
            setShipmentsLoadsheet(loadsheet);
            setIsShipmentsModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setShipmentsLoadsheet(loadsheet);
              setIsShipmentsModalOpen(true);
            }
          }}
          style={{ cursor: 'pointer' }}
          className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
        >
          {loadsheet.manifestNumber}
        </span>
      )
    },
    {
      accessor: 'trailerNumber' as keyof Loadsheet,
      header: 'Trailer',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span className="font-mono">{loadsheet.trailerNumber}</span>
      )
    },
    {
      accessor: 'linehaulName' as keyof Loadsheet,
      header: 'Linehaul Name',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span className="font-semibold">{loadsheet.linehaulName}</span>
      )
    },
    {
      accessor: 'originTerminalCode' as keyof Loadsheet,
      header: 'Origin',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span>{loadsheet.originTerminalCode || loadsheet.originTerminal?.code || '-'}</span>
      )
    },
    {
      accessor: 'doorNumber' as keyof Loadsheet,
      header: 'Door #',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span className="font-mono">{loadsheet.doorNumber || '-'}</span>
      )
    },
    {
      accessor: 'loadDate' as keyof Loadsheet,
      header: 'Load Date',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span>{format(new Date(loadsheet.loadDate), 'MM/dd/yyyy')}</span>
      )
    },
    {
      accessor: 'status' as keyof Loadsheet,
      header: 'Status',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <StatusBadge
          status={loadsheet.status}
          variant={getStatusVariant(loadsheet.status)}
        />
      )
    },
    {
      accessor: 'lastScanAt' as keyof Loadsheet,
      header: 'Last Scan',
      sortable: true,
      cell: (loadsheet: Loadsheet) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {loadsheet.lastScanAt
            ? format(new Date(loadsheet.lastScanAt), 'MM/dd/yyyy HH:mm')
            : '-'}
        </span>
      )
    },
    {
      accessor: 'id' as keyof Loadsheet,
      header: 'Actions',
      cell: (loadsheet: Loadsheet) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(loadsheet)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handlePrint(loadsheet)}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDownload(loadsheet)}
            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          {loadsheet.status === 'OPEN' && isAdmin && (
            <button
              onClick={() => {
                setSelectedLoadsheet(loadsheet);
                setIsDeleteModalOpen(true);
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loadsheets"
        subtitle="Create and manage linehaul loadsheet manifests"
      />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          {/* First row: Search and New button */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Search
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search by manifest #, trailer, or linehaul name..."
              />
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Loadsheet</span>
              </button>
            )}
          </div>

          {/* Second row: Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Location filter with type-to-filter */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                list="terminal-options"
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by location..."
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
              />
              <datalist id="terminal-options">
                {terminals.map((terminal) => (
                  <option key={terminal.id} value={terminal.code}>
                    {terminal.code} - {terminal.name}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as LoadsheetStatus | '');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Start date"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="End date"
              />
            </div>

            {/* Clear filters button */}
            {(locationFilter || statusFilter || startDate || endDate) && (
              <button
                onClick={() => {
                  setLocationFilter('');
                  setStatusFilter('');
                  setStartDate('');
                  setEndDate('');
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : loadsheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileSpreadsheet className="w-12 h-12 mb-4 text-gray-400" />
            <p className="text-lg font-medium">No loadsheets found</p>
            <p className="text-sm">Create a new loadsheet to get started</p>
          </div>
        ) : (
          <>
            <DataTable
              data={sortedLoadsheets}
              columns={columns}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={total}
                itemsPerPage={20}
              />
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedLoadsheet(null);
        }}
        title="Delete Loadsheet"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Are you sure you want to delete loadsheet{' '}
            <span className="font-semibold">{selectedLoadsheet?.manifestNumber}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedLoadsheet(null);
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

      {/* Create Loadsheet Modal */}
      <CreateLoadsheetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchLoadsheets()}
      />

      {/* Edit Loadsheet Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLoadsheet(null);
        }}
        title={`Edit Loadsheet ${selectedLoadsheet?.manifestNumber || ''}`}
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Loading door location for scanners
            </p>
          </div>

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
                    Check this box to alert the scanning application that quantities of hazardous materials
                    which require a hazmat endorsement to transport may not be loaded on this trailer.
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
                setSelectedLoadsheet(null);
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

      {/* Shipments Modal */}
      <LoadsheetShipmentsModal
        isOpen={isShipmentsModalOpen}
        onClose={() => {
          setIsShipmentsModalOpen(false);
          setShipmentsLoadsheet(null);
        }}
        loadsheet={shipmentsLoadsheet}
      />
    </div>
  );
};
