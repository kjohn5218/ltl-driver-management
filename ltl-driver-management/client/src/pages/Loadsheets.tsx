import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Search } from '../components/common/Search';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { CreateLoadsheetModal } from '../components/loadsheet/CreateLoadsheetModal';
import { loadsheetService } from '../services/loadsheetService';
import { Loadsheet, LoadsheetStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Plus,
  Edit,
  Trash2,
  Download,
  Printer,
  Filter,
  FileSpreadsheet
} from 'lucide-react';

const statusFilterOptions: { value: LoadsheetStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DISPATCHED', label: 'Dispatched' }
];

const getStatusVariant = (status: LoadsheetStatus): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case 'DRAFT':
      return 'default';
    case 'OPEN':
      return 'info';
    case 'CLOSED':
      return 'success';
    case 'DISPATCHED':
      return 'warning';
    default:
      return 'default';
  }
};

export const Loadsheets: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadsheets, setLoadsheets] = useState<Loadsheet[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoadsheetStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLoadsheet, setSelectedLoadsheet] = useState<Loadsheet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    fetchLoadsheets();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchLoadsheets = async () => {
    try {
      setLoading(true);
      const response = await loadsheetService.getLoadsheets({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
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

  const columns = [
    {
      key: 'manifestNumber',
      label: 'Manifest #',
      render: (loadsheet: Loadsheet) => (
        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
          {loadsheet.manifestNumber}
        </span>
      )
    },
    {
      key: 'trailerNumber',
      label: 'Trailer',
      render: (loadsheet: Loadsheet) => (
        <span className="font-mono">{loadsheet.trailerNumber}</span>
      )
    },
    {
      key: 'linehaulName',
      label: 'Linehaul Name',
      render: (loadsheet: Loadsheet) => (
        <span className="font-semibold">{loadsheet.linehaulName}</span>
      )
    },
    {
      key: 'originTerminalCode',
      label: 'Origin',
      render: (loadsheet: Loadsheet) => (
        <span>{loadsheet.originTerminalCode || loadsheet.originTerminal?.code || '-'}</span>
      )
    },
    {
      key: 'loadDate',
      label: 'Load Date',
      render: (loadsheet: Loadsheet) => (
        <span>{format(new Date(loadsheet.loadDate), 'MM/dd/yyyy')}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (loadsheet: Loadsheet) => (
        <StatusBadge
          status={loadsheet.status}
          variant={getStatusVariant(loadsheet.status)}
        />
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (loadsheet: Loadsheet) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/loadsheets/${loadsheet.id}`)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDownload(loadsheet)}
            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          {loadsheet.status === 'DRAFT' && isAdmin && (
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
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Search
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by manifest #, trailer, or linehaul name..."
            />
          </div>
          <div className="flex gap-4">
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
            <DataTable data={loadsheets} columns={columns} />
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
    </div>
  );
};
