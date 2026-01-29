import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { lateDepartureReasonService, LATE_REASON_LABELS, LateReasonType, LateDepartureReason } from '../services/lateDepartureReasonService';
import { locationService } from '../services/locationService';
import { Location } from '../types';
import { LateReasonViewModal } from '../components/dispatch/LateReasonViewModal';
import {
  Clock,
  AlertTriangle,
  Building2,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  TrendingUp,
  XCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';

export const LateLinehaulReport: React.FC = () => {
  // Date range defaults to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reasonFilter, setReasonFilter] = useState<LateReasonType | ''>('');
  const [serviceFailureFilter, setServiceFailureFilter] = useState<'' | 'true' | 'false'>('');
  const [terminalFilter, setTerminalFilter] = useState<number | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  // View modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewTripId, setViewTripId] = useState<number | null>(null);
  const [viewTripNumber, setViewTripNumber] = useState<string>('');

  // Fetch locations for filter dropdown
  const { data: locations = [] } = useQuery({
    queryKey: ['locations-list'],
    queryFn: () => locationService.getLocationsList(),
    staleTime: 5 * 60 * 1000
  });

  // Fetch late departure reasons
  const { data: reasonsData, isLoading, refetch } = useQuery({
    queryKey: ['late-departure-reasons-report', startDate, endDate, reasonFilter, serviceFailureFilter, terminalFilter],
    queryFn: () => lateDepartureReasonService.getLateDepartureReasons({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      reason: reasonFilter || undefined,
      willCauseServiceFailure: serviceFailureFilter ? serviceFailureFilter === 'true' : undefined,
      accountableTerminalId: terminalFilter || undefined,
      limit: 100
    })
  });

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ['late-departure-stats', startDate, endDate],
    queryFn: () => lateDepartureReasonService.getStats(startDate || undefined, endDate || undefined)
  });

  const reasons = reasonsData?.reasons || [];
  const stats = statsData;

  // Quick date filters
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  // Handle view late reason
  const handleViewReason = (reason: LateDepartureReason) => {
    if (reason.trip) {
      setViewTripId(reason.tripId);
      setViewTripNumber(reason.trip.tripNumber);
      setViewModalOpen(true);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Trip #', 'Date', 'Linehaul', 'Late Reason', 'Minutes Late', 'Service Failure', 'Accountable Terminal', 'Notes', 'Recorded By', 'Recorded At'];
    const rows = reasons.map(r => [
      r.trip?.tripNumber || '',
      r.trip?.dispatchDate ? format(parseISO(r.trip.dispatchDate), 'MM/dd/yyyy') : '',
      r.trip?.linehaulProfile?.profileCode || '',
      LATE_REASON_LABELS[r.reason],
      r.minutesLate?.toString() || '',
      r.willCauseServiceFailure ? 'Yes' : 'No',
      r.accountableTerminal?.code || r.accountableTerminalCode || '',
      r.notes || '',
      r.creator?.name || '',
      format(parseISO(r.createdAt), 'MM/dd/yyyy HH:mm')
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `late-linehaul-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Late Linehaul Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and analyze late departure reasons
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            disabled={reasons.length === 0}
            className="inline-flex items-center px-3 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Late Departures</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Service Failures</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.byServiceFailure.find(s => s.willCauseServiceFailure)?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">No Service Failure</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.byServiceFailure.find(s => !s.willCauseServiceFailure)?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Minutes Late</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.avgMinutesLate !== null ? Math.round(stats.avgMinutesLate) : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown by Reason */}
      {stats && stats.byReason.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Breakdown by Reason
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.byReason.map(item => (
              <div
                key={item.reason}
                className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">{LATE_REASON_LABELS[item.reason]}</span>
                <span className="ml-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-medium">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Quick Date Filters */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="flex gap-1">
                <button
                  onClick={() => setDateRange(7)}
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  7 Days
                </button>
                <button
                  onClick={() => setDateRange(30)}
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  30 Days
                </button>
                <button
                  onClick={setThisMonth}
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  This Month
                </button>
              </div>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            {/* Toggle More Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
            </button>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Reason Filter */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Late Reason</label>
                <select
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value as LateReasonType | '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">All Reasons</option>
                  {Object.entries(LATE_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Service Failure Filter */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Service Failure</label>
                <select
                  value={serviceFailureFilter}
                  onChange={(e) => setServiceFailureFilter(e.target.value as '' | 'true' | 'false')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">All</option>
                  <option value="true">Yes - Service Failure</option>
                  <option value="false">No - No Service Failure</option>
                </select>
              </div>

              {/* Terminal Filter */}
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Accountable Terminal</label>
                <select
                  value={terminalFilter}
                  onChange={(e) => setTerminalFilter(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="">All Terminals</option>
                  {locations.map((location: Location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} - {location.name || location.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Late Departures
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {reasons.length} records
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading late departure data...</div>
        ) : reasons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No late departures found for the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trip #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Linehaul
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Late Reason
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Minutes Late
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Service Failure
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Accountable Terminal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Recorded
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {reasons.map((reason) => (
                  <tr key={reason.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {reason.trip?.tripNumber || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {reason.trip?.dispatchDate
                        ? format(parseISO(reason.trip.dispatchDate), 'MM/dd/yyyy')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {reason.trip?.linehaulProfile?.profileCode || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        {LATE_REASON_LABELS[reason.reason]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-red-600 dark:text-red-400">
                      {reason.minutesLate !== null && reason.minutesLate !== undefined
                        ? `+${reason.minutesLate}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {reason.willCauseServiceFailure ? (
                        <span className="inline-flex items-center text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {reason.accountableTerminal?.code || reason.accountableTerminalCode || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div>
                        {format(parseISO(reason.createdAt), 'MM/dd HH:mm')}
                      </div>
                      {reason.creator && (
                        <div className="text-xs text-gray-400">
                          by {reason.creator.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewReason(reason)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewTripId && (
        <LateReasonViewModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setViewTripId(null);
            setViewTripNumber('');
          }}
          tripId={viewTripId}
          tripNumber={viewTripNumber}
        />
      )}
    </div>
  );
};
