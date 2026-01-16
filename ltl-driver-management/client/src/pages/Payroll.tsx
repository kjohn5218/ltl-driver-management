import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { DataTable } from '../components/common/DataTable';
import { TablePagination } from '../components/common/TablePagination';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { payrollService } from '../services/payrollService';
import { driverService } from '../services/driverService';
import {
  PayPeriod,
  TripPay,
  PayPeriodStatus,
  TripPayStatus,
  CarrierDriver
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Calendar,
  DollarSign,
  CheckCircle,
  Lock,
  FileText,
  Download,
  ChevronRight,
  User,
  Filter
} from 'lucide-react';

const payPeriodStatusConfig: Record<PayPeriodStatus, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: 'success' },
  CLOSED: { label: 'Closed', color: 'warning' },
  LOCKED: { label: 'Locked', color: 'danger' },
  EXPORTED: { label: 'Exported', color: 'default' }
};

const tripPayStatusConfig: Record<TripPayStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'default' },
  CALCULATED: { label: 'Calculated', color: 'info' },
  REVIEWED: { label: 'Reviewed', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  PAID: { label: 'Paid', color: 'success' },
  DISPUTED: { label: 'Disputed', color: 'danger' }
};

export const Payroll: React.FC = () => {
  const { user } = useAuth();
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [tripPays, setTripPays] = useState<TripPay[]>([]);
  const [drivers, setDrivers] = useState<CarrierDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripPaysLoading, setTripPaysLoading] = useState(false);

  // Selected pay period
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<PayPeriod | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PayPeriodStatus | ''>('');
  const [driverFilter, setDriverFilter] = useState<number | ''>('');
  const [tripPayStatusFilter, setTripPayStatusFilter] = useState<TripPayStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tripPaysPage, setTripPaysPage] = useState(1);
  const [tripPaysTotalPages, setTripPaysTotalPages] = useState(1);

  // Modals
  const [isCreatePeriodModalOpen, setIsCreatePeriodModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);

  // Form state
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [newStatus, setNewStatus] = useState<PayPeriodStatus>('CLOSED');
  const [selectedTripPayIds, setSelectedTripPayIds] = useState<number[]>([]);

  const isAdmin = user?.role === 'ADMIN';
  const isDispatcher = user?.role === 'DISPATCHER';
  const canManagePayroll = isAdmin || isDispatcher;

  useEffect(() => {
    fetchPayPeriods();
    fetchDrivers();
  }, []);

  useEffect(() => {
    fetchPayPeriods();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (selectedPayPeriod) {
      fetchTripPays(selectedPayPeriod.id);
    }
  }, [selectedPayPeriod, tripPaysPage, driverFilter, tripPayStatusFilter]);

  const fetchPayPeriods = async () => {
    try {
      setLoading(true);
      const response = await payrollService.getPayPeriods({
        status: statusFilter || undefined,
        page: currentPage,
        limit: 10
      });
      setPayPeriods(response.payPeriods);
      setTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch pay periods');
    } finally {
      setLoading(false);
    }
  };

  const fetchTripPays = async (payPeriodId: number) => {
    try {
      setTripPaysLoading(true);
      const response = await payrollService.getTripPays(payPeriodId, {
        driverId: driverFilter || undefined,
        status: tripPayStatusFilter || undefined,
        page: tripPaysPage,
        limit: 20
      });
      setTripPays(response.tripPays);
      setTripPaysTotalPages(response.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to fetch trip pays');
    } finally {
      setTripPaysLoading(false);
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

  const handleCreatePayPeriod = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Please select start and end dates');
      return;
    }

    try {
      await payrollService.createPayPeriod({
        periodStart,
        periodEnd
      });
      toast.success('Pay period created successfully');
      setIsCreatePeriodModalOpen(false);
      setPeriodStart('');
      setPeriodEnd('');
      fetchPayPeriods();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create pay period');
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedPayPeriod) return;

    try {
      await payrollService.updatePayPeriodStatus(selectedPayPeriod.id, newStatus);
      toast.success(`Pay period ${newStatus.toLowerCase()}`);
      setIsStatusModalOpen(false);
      fetchPayPeriods();
      setSelectedPayPeriod({ ...selectedPayPeriod, status: newStatus });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    if (!selectedPayPeriod) return;

    try {
      const data = await payrollService.exportPayPeriod(selectedPayPeriod.id, format);

      if (format === 'csv') {
        const blob = data as Blob;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll-${selectedPayPeriod.id}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll-${selectedPayPeriod.id}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast.success(`Exported as ${format.toUpperCase()}`);
      setIsExportModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export');
    }
  };

  const handleBulkApprove = async () => {
    if (selectedTripPayIds.length === 0) {
      toast.error('Please select trip pays to approve');
      return;
    }

    try {
      const result = await payrollService.bulkApproveTripPays(selectedTripPayIds);
      toast.success(`${result.approved} trip pays approved`);
      setIsBulkApproveModalOpen(false);
      setSelectedTripPayIds([]);
      if (selectedPayPeriod) {
        fetchTripPays(selectedPayPeriod.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve trip pays');
    }
  };

  const handleCalculatePay = async (tripId: number) => {
    try {
      await payrollService.calculateTripPay(tripId);
      toast.success('Pay calculated successfully');
      if (selectedPayPeriod) {
        fetchTripPays(selectedPayPeriod.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to calculate pay');
    }
  };

  const toggleTripPaySelection = (tripPayId: number) => {
    setSelectedTripPayIds(prev =>
      prev.includes(tripPayId)
        ? prev.filter(id => id !== tripPayId)
        : [...prev, tripPayId]
    );
  };

  const selectAllTripPays = () => {
    const approvableTripPays = tripPays.filter(tp => tp.status === 'CALCULATED' || tp.status === 'REVIEWED');
    if (selectedTripPayIds.length === approvableTripPays.length) {
      setSelectedTripPayIds([]);
    } else {
      setSelectedTripPayIds(approvableTripPays.map(tp => tp.id));
    }
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount ?? 0);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString();
  };

  // Pay Period columns
  const payPeriodColumns = [
    {
      header: 'Period',
      accessor: 'periodStart' as keyof PayPeriod,
      cell: (period: PayPeriod) => (
        <button
          onClick={() => setSelectedPayPeriod(period)}
          className="flex items-center text-indigo-600 hover:text-indigo-900"
        >
          <Calendar className="w-4 h-4 mr-2" />
          <span className="font-medium">
            {formatDate(period.periodStart)} - {formatDate(period.periodEnd)}
          </span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      )
    },
    {
      header: 'Status',
      accessor: 'status' as keyof PayPeriod,
      cell: (period: PayPeriod) => {
        const config = payPeriodStatusConfig[period.status];
        return (
          <StatusBadge
            status={config.label}
            variant={config.color as any}
          />
        );
      }
    },
    {
      header: 'Trips',
      accessor: '_count' as keyof PayPeriod,
      cell: (period: PayPeriod) => (
        <span className="text-gray-600">{period._count?.tripPays || 0}</span>
      )
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            accessor: 'id' as keyof PayPeriod,
            cell: (period: PayPeriod) => (
              <div className="flex space-x-2">
                {period.status === 'OPEN' && (
                  <button
                    onClick={() => {
                      setSelectedPayPeriod(period);
                      setNewStatus('CLOSED');
                      setIsStatusModalOpen(true);
                    }}
                    className="text-yellow-600 hover:text-yellow-900"
                    title="Close Period"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                )}
                {period.status === 'CLOSED' && (
                  <button
                    onClick={() => {
                      setSelectedPayPeriod(period);
                      setNewStatus('LOCKED');
                      setIsStatusModalOpen(true);
                    }}
                    className="text-red-600 hover:text-red-900"
                    title="Lock Period"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                )}
                {(period.status === 'LOCKED' || period.status === 'CLOSED') && (
                  <button
                    onClick={() => {
                      setSelectedPayPeriod(period);
                      setIsExportModalOpen(true);
                    }}
                    className="text-green-600 hover:text-green-900"
                    title="Export"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          }
        ]
      : [])
  ];

  // Trip Pay columns
  const tripPayColumns = [
    ...(canManagePayroll
      ? [
          {
            header: '',
            accessor: 'id' as keyof TripPay,
            cell: (tripPay: TripPay) => (
              (tripPay.status === 'CALCULATED' || tripPay.status === 'REVIEWED') && (
                <input
                  type="checkbox"
                  checked={selectedTripPayIds.includes(tripPay.id)}
                  onChange={() => toggleTripPaySelection(tripPay.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              )
            )
          }
        ]
      : []),
    {
      header: 'Trip',
      accessor: 'trip' as keyof TripPay,
      cell: (tripPay: TripPay) => (
        <div>
          <div className="font-medium text-gray-900">{tripPay.trip?.tripNumber}</div>
          <div className="text-xs text-gray-500">
            {tripPay.trip?.linehaulProfile?.profileCode}
          </div>
        </div>
      )
    },
    {
      header: 'Driver',
      accessor: 'driver' as keyof TripPay,
      cell: (tripPay: TripPay) => (
        <div className="flex items-center">
          <User className="w-4 h-4 mr-1 text-gray-400" />
          <span>{tripPay.driver?.name || tripPay.trip?.driver?.name || '-'}</span>
        </div>
      )
    },
    {
      header: 'Base Pay',
      accessor: 'basePay' as keyof TripPay,
      cell: (tripPay: TripPay) => (
        <span className="font-medium">{formatCurrency(tripPay.basePay)}</span>
      )
    },
    {
      header: 'Accessorial',
      accessor: 'accessorialPay' as keyof TripPay,
      cell: (tripPay: TripPay) => (
        <span className="text-gray-600">{formatCurrency(tripPay.accessorialPay)}</span>
      )
    },
    {
      header: 'Total',
      accessor: 'totalGrossPay' as keyof TripPay,
      cell: (tripPay: TripPay) => (
        <span className="font-medium text-green-600">{formatCurrency(tripPay.totalGrossPay)}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status' as keyof TripPay,
      cell: (tripPay: TripPay) => {
        const config = tripPayStatusConfig[tripPay.status];
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
            accessor: 'tripId' as keyof TripPay,
            cell: (tripPay: TripPay) => (
              <div className="flex space-x-2">
                {tripPay.status === 'PENDING' && (
                  <button
                    onClick={() => handleCalculatePay(tripPay.tripId)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Calculate Pay"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                )}
                {(tripPay.status === 'CALCULATED' || tripPay.status === 'REVIEWED') && (
                  <button
                    onClick={() => toggleTripPaySelection(tripPay.id)}
                    className="text-green-600 hover:text-green-900"
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
        subtitle="Manage pay periods and trip pay calculations"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pay Periods Panel */}
        <div className="lg:col-span-1 bg-white shadow rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Pay Periods</h3>
              {isAdmin && (
                <button
                  onClick={() => setIsCreatePeriodModalOpen(true)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="mt-3">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as PayPeriodStatus | '');
                  setCurrentPage(1);
                }}
                className="w-full rounded-md border-gray-300 text-sm"
              >
                <option value="">All Statuses</option>
                {Object.entries(payPeriodStatusConfig).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            columns={payPeriodColumns}
            data={payPeriods}
            loading={loading}
          />

          {!loading && payPeriods.length > 0 && (
            <div className="p-4 border-t border-gray-200">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>

        {/* Trip Pays Panel */}
        <div className="lg:col-span-2 bg-white shadow rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">
                  {selectedPayPeriod
                    ? `Trip Pays - ${formatDate(selectedPayPeriod.periodStart)} to ${formatDate(selectedPayPeriod.periodEnd)}`
                    : 'Select a Pay Period'}
                </h3>
                {selectedPayPeriod && (
                  <StatusBadge
                    status={payPeriodStatusConfig[selectedPayPeriod.status].label}
                    variant={payPeriodStatusConfig[selectedPayPeriod.status].color as any}
                  />
                )}
              </div>

              {selectedPayPeriod && canManagePayroll && selectedTripPayIds.length > 0 && (
                <button
                  onClick={() => setIsBulkApproveModalOpen(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve ({selectedTripPayIds.length})
                </button>
              )}
            </div>

            {selectedPayPeriod && (
              <div className="mt-3 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={driverFilter}
                    onChange={(e) => {
                      setDriverFilter(e.target.value ? parseInt(e.target.value) : '');
                      setTripPaysPage(1);
                    }}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="">All Drivers</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>

                  <select
                    value={tripPayStatusFilter}
                    onChange={(e) => {
                      setTripPayStatusFilter(e.target.value as TripPayStatus | '');
                      setTripPaysPage(1);
                    }}
                    className="rounded-md border-gray-300 text-sm"
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(tripPayStatusConfig).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>

                {canManagePayroll && tripPays.some(tp => tp.status === 'CALCULATED' || tp.status === 'REVIEWED') && (
                  <button
                    onClick={selectAllTripPays}
                    className="text-sm text-indigo-600 hover:text-indigo-900"
                  >
                    {selectedTripPayIds.length === tripPays.filter(tp => tp.status === 'CALCULATED' || tp.status === 'REVIEWED').length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedPayPeriod ? (
            <>
              <DataTable
                columns={tripPayColumns}
                data={tripPays}
                loading={tripPaysLoading}
              />

              {!tripPaysLoading && tripPays.length > 0 && (
                <div className="p-4 border-t border-gray-200">
                  <TablePagination
                    currentPage={tripPaysPage}
                    totalPages={tripPaysTotalPages}
                    onPageChange={setTripPaysPage}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a pay period to view trip pays</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Pay Period Modal */}
      <Modal
        isOpen={isCreatePeriodModalOpen}
        onClose={() => setIsCreatePeriodModalOpen(false)}
        title="Create Pay Period"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Period Start *</label>
            <input
              type="date"
              required
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Period End *</label>
            <input
              type="date"
              required
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsCreatePeriodModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePayPeriod}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Update Pay Period Status"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Change status to <strong>{payPeriodStatusConfig[newStatus]?.label}</strong>?
          </p>

          {newStatus === 'CLOSED' && (
            <p className="text-sm text-yellow-600">
              Closing the period will prevent new trips from being added.
            </p>
          )}

          {newStatus === 'LOCKED' && (
            <p className="text-sm text-red-600">
              Locking the period will prevent any modifications to trip pays.
            </p>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateStatus}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
            >
              Update Status
            </button>
          </div>
        </div>
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Pay Period"
      >
        <div className="space-y-4">
          <p className="text-gray-700">Choose export format:</p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleExport('csv')}
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <FileText className="w-8 h-8 text-green-600 mb-2" />
              <span className="font-medium">CSV</span>
              <span className="text-xs text-gray-500">For Excel/Spreadsheets</span>
            </button>

            <button
              onClick={() => handleExport('json')}
              className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50"
            >
              <FileText className="w-8 h-8 text-blue-600 mb-2" />
              <span className="font-medium">JSON</span>
              <span className="text-xs text-gray-500">For System Integration</span>
            </button>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Approve Modal */}
      <Modal
        isOpen={isBulkApproveModalOpen}
        onClose={() => setIsBulkApproveModalOpen(false)}
        title="Bulk Approve Trip Pays"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Approve <strong>{selectedTripPayIds.length}</strong> trip pays?
          </p>

          <p className="text-sm text-gray-500">
            This will mark all selected trip pays as approved.
          </p>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={() => setIsBulkApproveModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
            >
              Approve All
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
