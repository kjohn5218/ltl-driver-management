import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { Modal } from '../components/common/Modal';
import {
  mileageMatrixService,
  MileageEntry,
  MileageFilters
} from '../services/mileageMatrixService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MapPin,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  Search,
  Loader2,
  Zap
} from 'lucide-react';

export const MileageMatrix: React.FC = () => {
  const { user } = useAuth();

  // Data states
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 50;

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAutoPopulateModalOpen, setIsAutoPopulateModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MileageEntry | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Auto-populate states
  const [autoPopulateLoading, setAutoPopulateLoading] = useState(false);
  const [roadFactor, setRoadFactor] = useState('1.3');
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    originCode: '',
    destinationCode: '',
    miles: '',
    notes: ''
  });

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  useEffect(() => {
    fetchEntries();
  }, [currentPage, searchTerm, activeFilter]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const filters: MileageFilters = {
        page: currentPage,
        limit: pageSize
      };

      if (searchTerm) {
        filters.search = searchTerm;
      }

      if (activeFilter !== '') {
        filters.active = activeFilter;
      }

      const response = await mileageMatrixService.getEntries(filters);
      setEntries(response.entries);
      setTotalPages(response.pagination.totalPages);
      setTotalRecords(response.pagination.total);
    } catch (error) {
      console.error('Failed to fetch mileage entries:', error);
      toast.error('Failed to load mileage matrix data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.originCode || !formData.destinationCode || !formData.miles) {
      toast.error('Please fill in all required fields');
      return;
    }

    setFormLoading(true);
    try {
      await mileageMatrixService.create({
        originCode: formData.originCode.toUpperCase(),
        destinationCode: formData.destinationCode.toUpperCase(),
        miles: parseFloat(formData.miles),
        notes: formData.notes || undefined
      });
      toast.success('Mileage entry created successfully');
      setIsCreateModalOpen(false);
      resetForm();
      fetchEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create mileage entry');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEntry || !formData.miles) {
      toast.error('Please fill in all required fields');
      return;
    }

    setFormLoading(true);
    try {
      await mileageMatrixService.update(selectedEntry.id, {
        originCode: formData.originCode.toUpperCase(),
        destinationCode: formData.destinationCode.toUpperCase(),
        miles: parseFloat(formData.miles),
        notes: formData.notes || undefined
      });
      toast.success('Mileage entry updated successfully');
      setIsEditModalOpen(false);
      setSelectedEntry(null);
      resetForm();
      fetchEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update mileage entry');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;

    setFormLoading(true);
    try {
      await mileageMatrixService.delete(selectedEntry.id);
      toast.success('Mileage entry deleted successfully');
      setIsDeleteModalOpen(false);
      setSelectedEntry(null);
      fetchEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete mileage entry');
    } finally {
      setFormLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setImportLoading(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Skip header row
      const dataLines = lines.slice(1);

      const entries = dataLines.map(line => {
        const [originCode, destinationCode, miles, notes] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return {
          originCode,
          destinationCode,
          miles: parseFloat(miles),
          notes: notes || undefined
        };
      }).filter(e => e.originCode && e.destinationCode && !isNaN(e.miles));

      if (entries.length === 0) {
        toast.error('No valid entries found in the file');
        return;
      }

      const result = await mileageMatrixService.bulkUpsert(entries);
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated`);

      if (result.errors && result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }

      setIsImportModalOpen(false);
      setImportFile(null);
      fetchEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to import mileage data');
    } finally {
      setImportLoading(false);
    }
  };

  const handleAutoPopulate = async () => {
    setAutoPopulateLoading(true);
    try {
      const result = await mileageMatrixService.autoPopulate({
        roadFactor: parseFloat(roadFactor),
        overwriteExisting
      });

      toast.success(
        `Auto-populate complete: ${result.created} created, ${result.updated} updated` +
        (result.skipped > 0 ? `, ${result.skipped} skipped` : '')
      );

      if (result.errors && result.errors.length > 0) {
        console.warn('Auto-populate errors:', result.errors);
      }

      setIsAutoPopulateModalOpen(false);
      fetchEntries();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to auto-populate mileage data');
    } finally {
      setAutoPopulateLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Origin Code', 'Destination Code', 'Miles', 'Notes'];
    const rows = entries.map(e => [
      e.originCode,
      e.destinationCode,
      e.miles.toString(),
      e.notes || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mileage_matrix.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const template = 'Origin Code,Destination Code,Miles,Notes\nABQ,DEN,450.5,Via I-25\nDEN,SLC,525.0,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mileage_matrix_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      originCode: '',
      destinationCode: '',
      miles: '',
      notes: ''
    });
  };

  const openEditModal = (entry: MileageEntry) => {
    setSelectedEntry(entry);
    setFormData({
      originCode: entry.originCode,
      destinationCode: entry.destinationCode,
      miles: entry.miles.toString(),
      notes: entry.notes || ''
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (entry: MileageEntry) => {
    setSelectedEntry(entry);
    setIsDeleteModalOpen(true);
  };

  const columns = [
    {
      key: 'route',
      header: 'Route',
      render: (entry: MileageEntry) => (
        <div className="flex items-center text-sm">
          <MapPin className="h-4 w-4 text-gray-400 mr-1" />
          <span className="font-medium">{entry.originCode}</span>
          <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
          <span className="font-medium">{entry.destinationCode}</span>
        </div>
      )
    },
    {
      key: 'miles',
      header: 'Miles',
      render: (entry: MileageEntry) => (
        <span className="text-sm font-medium">{Number(entry.miles).toFixed(1)}</span>
      )
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (entry: MileageEntry) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {entry.notes || '-'}
        </span>
      )
    },
    {
      key: 'active',
      header: 'Status',
      render: (entry: MileageEntry) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
          entry.active
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }`}>
          {entry.active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    ...(isAdmin ? [{
      key: 'actions',
      header: 'Actions',
      render: (entry: MileageEntry) => (
        <div className="flex space-x-2">
          <button
            onClick={() => openEditModal(entry)}
            className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => openDeleteModal(entry)}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mileage Matrix"
        subtitle="Manage standard mileage between terminal pairs for trip arrivals"
      />

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by terminal code..."
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full sm:w-64"
            />
          </div>

          {/* Active Filter */}
          <select
            value={activeFilter === '' ? '' : activeFilter.toString()}
            onChange={(e) => setActiveFilter(e.target.value === '' ? '' : e.target.value === 'true')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              title="Download CSV Template"
            >
              <Download className="h-4 w-4 mr-1" />
              Template
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </button>
            <button
              onClick={() => setIsAutoPopulateModalOpen(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              title="Calculate mileage from location GPS coordinates"
            >
              <Zap className="h-4 w-4 mr-1" />
              Auto-Populate
            </button>
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Entry
            </button>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <DataTable
          columns={columns}
          data={entries}
          loading={loading}
          emptyMessage="No mileage entries found"
        />
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={totalRecords}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedEntry(null);
          resetForm();
        }}
        title={isEditModalOpen ? 'Edit Mileage Entry' : 'Add Mileage Entry'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Origin Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.originCode}
                onChange={(e) => setFormData({ ...formData, originCode: e.target.value.toUpperCase() })}
                placeholder="e.g., ABQ"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destination Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.destinationCode}
                onChange={(e) => setFormData({ ...formData, destinationCode: e.target.value.toUpperCase() })}
                placeholder="e.g., DEN"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Miles <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.miles}
              onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
              placeholder="e.g., 450.5"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes (e.g., via I-25)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedEntry(null);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={isEditModalOpen ? handleEdit : handleCreate}
              disabled={formLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditModalOpen ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedEntry(null);
        }}
        title="Delete Mileage Entry"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete the mileage entry for{' '}
            <span className="font-medium">{selectedEntry?.originCode}</span> to{' '}
            <span className="font-medium">{selectedEntry?.destinationCode}</span>?
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedEntry(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={formLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            >
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportFile(null);
        }}
        title="Import Mileage Data"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload a CSV file with mileage data. The file should have the following columns:
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-md p-3 text-sm font-mono">
            Origin Code, Destination Code, Miles, Notes
          </div>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary-50 file:text-primary-700
                dark:file:bg-primary-900/30 dark:file:text-primary-400
                hover:file:bg-primary-100 dark:hover:file:bg-primary-900/50"
            />
            {importFile && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Selected: {importFile.name}
              </p>
            )}
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!importFile || importLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
            >
              {importLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </button>
          </div>
        </div>
      </Modal>

      {/* Auto-Populate Modal */}
      <Modal
        isOpen={isAutoPopulateModalOpen}
        onClose={() => {
          setIsAutoPopulateModalOpen(false);
          setRoadFactor('1.3');
          setOverwriteExisting(false);
        }}
        title="Auto-Populate from Locations"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automatically calculate mileage between all terminal locations using their GPS coordinates.
            This uses the Haversine formula with a road factor to approximate driving distance.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> All active locations with GPS coordinates will be used.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Road Factor
            </label>
            <input
              type="number"
              step="0.1"
              min="1.0"
              max="2.0"
              value={roadFactor}
              onChange={(e) => setRoadFactor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Multiplier applied to straight-line distance (1.3 = 30% longer roads). Typical values: 1.2-1.4
            </p>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="overwriteExisting"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="overwriteExisting" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Overwrite existing entries
            </label>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => {
                setIsAutoPopulateModalOpen(false);
                setRoadFactor('1.3');
                setOverwriteExisting(false);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAutoPopulate}
              disabled={autoPopulateLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {autoPopulateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Zap className="h-4 w-4 mr-1" />
              Auto-Populate
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
