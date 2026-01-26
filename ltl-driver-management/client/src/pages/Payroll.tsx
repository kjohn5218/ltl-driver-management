import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { PayrollEditModal } from '../components/payroll/PayrollEditModal';
import { PayrollExportModal } from '../components/payroll/PayrollExportModal';
import { payrollService } from '../services/payrollService';
import { locationService } from '../services/locationService';
import {
  PayrollLineItem,
  PayrollFilters,
  PayrollSummary,
  PayrollLineItemUpdate,
  PayrollExportOptions,
  Location
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  DollarSign,
  CheckCircle,
  Download,
  Edit,
  Filter,
  Search,
  X,
  Truck,
  Clock,
  FileSpreadsheet
} from 'lucide-react';

type TabType = 'all' | 'trip' | 'cut';

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'default' },
  CALCULATED: { label: 'Calculated', color: 'info' },
  REVIEWED: { label: 'Reviewed', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  PAID: { label: 'Paid', color: 'success' },
  DISPUTED: { label: 'Disputed', color: 'danger' }
};

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PayrollLineItem[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Filters
  const [filters, setFilters] = useState<PayrollFilters>({
    startDate: '',
    endDate: '',
    locationId: undefined,
    statuses: [],
    search: '',
    source: 'all',
    page: 1,
    limit: 50
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PayrollLineItem | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isPayrollAdmin = user?.role === 'PAYROLL_ADMIN';
  const isPayrollClerk = user?.role === 'PAYROLL_CLERK';
  const canManagePayroll = isAdmin || isPayrollAdmin || isPayrollClerk;
  const canApprove = isAdmin || isPayrollAdmin;
  const canExport = isAdmin || isPayrollAdmin;

  // Initialize with last 30 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }));
  }, []);

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      fetchPayrollItems();
    }
  }, [filters, currentPage, activeTab]);

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLocations({ limit: 500 });
      setLocations(response.locations.filter(l => l.isPhysicalTerminal));
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchPayrollItems = async () => {
    try {
      setLoading(true);
      const response = await payrollService.getUnifiedPayrollItems({
        ...filters,
        source: activeTab,
        page: currentPage,
        limit: filters.limit
      });
      setItems(response.items);
      setSummary(response.summary);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch payroll items');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: PayrollLineItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (type: 'trip' | 'cut', id: number, data: PayrollLineItemUpdate) => {
    try {
      await payrollService.updatePayrollLineItem(type, id, data);
      toast.success('Pay item updated successfully');
      fetchPayrollItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update pay item');
      throw error;
    }
  };

  const handleApprove = async (item: PayrollLineItem) => {
    try {
      const type = item.source === 'TRIP_PAY' ? 'trip' : 'cut';
      await payrollService.bulkApprovePayrollItems([{ type, id: item.sourceId }]);
      toast.success('Item approved');
      fetchPayrollItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve item');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select items to approve');
      return;
    }

    try {
      const itemsToApprove = selectedIds.map(id => {
        const [type, sourceId] = id.split('-');
        return { type: type as 'trip' | 'cut', id: parseInt(sourceId, 10) };
      });

      const result = await payrollService.bulkApprovePayrollItems(itemsToApprove);
      toast.success(`${result.approved} items approved`);
      setSelectedIds([]);
      fetchPayrollItems();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve items');
    }
  };

  const handleExport = async (options: PayrollExportOptions) => {
    try {
      const blob = await payrollService.exportPayrollToXls(options);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Payroll exported successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export payroll');
      throw error;
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllApprovable = () => {
    const approvableIds = items
      .filter(i => ['PENDING', 'CALCULATED', 'REVIEWED'].includes(i.status))
      .map(i => i.id);
    if (selectedIds.length === approvableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(approvableIds);
    }
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);
  };

  const handleFilterChange = (key: keyof PayrollFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setFilters({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      locationId: undefined,
      statuses: [],
      search: '',
      source: 'all',
      page: 1,
      limit: 50
    });
    setCurrentPage(1);
  };

  // Table columns
  const columns = [
    ...(canApprove
      ? [
          {
            header: '',
            accessor: 'id' as keyof PayrollLineItem,
            cell: (item: PayrollLineItem) =>
              ['PENDING', 'CALCULATED', 'REVIEWED'].includes(item.status) ? (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              ) : null
          }
        ]
      : []),
    {
      header: 'Type',
      accessor: 'source' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          item.source === 'TRIP_PAY'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
        }`}>
          {item.source === 'TRIP_PAY' ? (
            <>
              <Truck className="w-3 h-3 mr-1" />
              Trip
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 mr-1" />
              Cut Pay
            </>
          )}
        </span>
      )
    },
    {
      header: 'Driver',
      accessor: 'driverName' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{item.driverName}</div>
          {item.driverNumber && (
            <div className="text-xs text-gray-500 dark:text-gray-400">#{item.driverNumber}</div>
          )}
        </div>
      )
    },
    {
      header: 'Date',
      accessor: 'date' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(item.date).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Route',
      accessor: 'origin' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <div className="text-sm">
          {item.source === 'TRIP_PAY' ? (
            <>
              <span className="text-gray-900 dark:text-gray-100">
                {item.origin || '?'} → {item.destination || '?'}
              </span>
              {item.tripNumber && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.tripNumber}</div>
              )}
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {item.cutPayType === 'HOURS'
                ? `${item.cutPayHours}h`
                : `${item.cutPayMiles}mi (${item.trailerConfig})`
              }
            </span>
          )}
        </div>
      )
    },
    {
      header: 'Base + Mileage',
      accessor: 'basePay' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <div className="text-sm text-right">
          {item.source === 'TRIP_PAY' ? (
            <>
              <div>{formatCurrency(item.basePay + item.mileagePay)}</div>
              {item.basePay > 0 && item.mileagePay > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCurrency(item.basePay)} + {formatCurrency(item.mileagePay)}
                </div>
              )}
            </>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Accessorials',
      accessor: 'dropAndHookPay' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => {
        const totalAccessorial = item.dropAndHookPay + item.chainUpPay + item.waitTimePay + item.otherAccessorialPay;
        return (
          <div className="text-sm text-right">
            {item.source === 'TRIP_PAY' && totalAccessorial > 0 ? (
              <div title={`D&H: ${formatCurrency(item.dropAndHookPay)}, Chain: ${formatCurrency(item.chainUpPay)}, Wait: ${formatCurrency(item.waitTimePay)}`}>
                {formatCurrency(totalAccessorial)}
              </div>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Total',
      accessor: 'totalGrossPay' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          {formatCurrency(item.totalGrossPay)}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status' as keyof PayrollLineItem,
      cell: (item: PayrollLineItem) => {
        const config = statusConfig[item.status] || statusConfig.PENDING;
        return (
          <StatusBadge
            status={config.label}
            variant={config.color as any}
          />
        );
      }
    },
    ...(canManagePayroll
      ? [
          {
            header: 'Actions',
            accessor: 'sourceId' as keyof PayrollLineItem,
            cell: (item: PayrollLineItem) => (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {canApprove && ['PENDING', 'CALCULATED', 'REVIEWED'].includes(item.status) && (
                  <button
                    onClick={() => handleApprove(item)}
                    className="text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                    title="Approve"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          }
        ]
      : [])
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Review and approve pay for arrived trips and cut pay requests"
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Records</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary.totalCount}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Unapproved</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary.unapprovedCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Actions */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4">
            <nav className="flex space-x-4" aria-label="Tabs">
              {[
                { key: 'all', label: 'All Items' },
                { key: 'trip', label: 'Trip Pay' },
                { key: 'cut', label: 'Cut Pay' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as TabType);
                    setCurrentPage(1);
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center space-x-2 py-2">
              {canApprove && selectedIds.length > 0 && (
                <button
                  onClick={handleBulkApprove}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve ({selectedIds.length})
                </button>
              )}
              {canExport && (
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Export
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Filters:</span>
            </div>

            {/* Date Range */}
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>

            {/* Location Filter (Driver's assigned location) */}
            <select
              value={filters.locationId || ''}
              onChange={(e) => handleFilterChange('locationId', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.code} - {loc.name || loc.city}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filters.statuses?.[0] || ''}
              onChange={(e) => handleFilterChange('statuses', e.target.value ? [e.target.value] : [])}
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
            >
              <option value="">All Statuses</option>
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search driver..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-9 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
          </div>

          {/* Select All */}
          {canApprove && items.some(i => ['PENDING', 'CALCULATED', 'REVIEWED'].includes(i.status)) && (
            <div className="flex items-center">
              <button
                onClick={selectAllApprovable}
                className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {selectedIds.length === items.filter(i => ['PENDING', 'CALCULATED', 'REVIEWED'].includes(i.status)).length
                  ? 'Deselect All'
                  : 'Select All Approvable'}
              </button>
            </div>
          )}
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
        />

        {/* Pagination */}
        {!loading && items.length > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <PayrollEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        onSave={handleSaveEdit}
      />

      {/* Export Modal */}
      <PayrollExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        summary={summary}
        onExport={handleExport}
      />
    </div>
  );
};
