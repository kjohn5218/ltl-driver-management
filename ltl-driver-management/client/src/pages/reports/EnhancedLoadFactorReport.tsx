import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks, subMonths } from 'date-fns';
import { advancedReportService } from '../../services/advancedReportService';
import { GaugeChart } from '../../components/charts/GaugeChart';
import { TerminalLoadFactor, LaneLoadFactor } from '../../types/reports';

export const EnhancedLoadFactorReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 0 }));
  const [expandedTerminals, setExpandedTerminals] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'headhaul' | 'backhaul'>('headhaul');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['enhanced-load-factor', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => advancedReportService.getEnhancedLoadFactor({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
  });

  const toggleTerminal = (terminal: string) => {
    const newExpanded = new Set(expandedTerminals);
    if (newExpanded.has(terminal)) {
      newExpanded.delete(terminal);
    } else {
      newExpanded.add(terminal);
    }
    setExpandedTerminals(newExpanded);
  };

  const setQuickDateRange = (range: 'thisWeek' | 'lastWeek' | 'last4Weeks' | 'thisMonth') => {
    const now = new Date();
    switch (range) {
      case 'thisWeek':
        setStartDate(startOfWeek(now, { weekStartsOn: 0 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 0 }));
        break;
      case 'lastWeek':
        setStartDate(startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }));
        setEndDate(endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }));
        break;
      case 'last4Weeks':
        setStartDate(startOfWeek(subWeeks(now, 3), { weekStartsOn: 0 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 0 }));
        break;
      case 'thisMonth':
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        break;
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const terminals = activeTab === 'headhaul' ? data.headhaulByTerminal : data.backhaulByTerminal;

    const headers = [
      'Terminal',
      'Weight (lbs)',
      'Capacity (lbs)',
      'Load Factor %',
      'WoW Variance',
      'MoM Variance',
      'YoY Variance',
    ];

    const rows = terminals.map((t: TerminalLoadFactor) => [
      t.terminal,
      t.weight.toFixed(0),
      t.capacity.toFixed(0),
      t.loadFactorPercent.toFixed(2),
      t.wowVariance?.toFixed(2) ?? '',
      t.momVariance?.toFixed(2) ?? '',
      t.yoyVariance?.toFixed(2) ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `load-factor-${activeTab}-${format(startDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return 'text-gray-400';
    // For load factor, higher is better
    if (variance > 0) return 'text-green-600 dark:text-green-400';
    if (variance < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600';
  };

  const formatVariance = (variance: number | null) => {
    if (variance === null) return '-';
    const prefix = variance > 0 ? '+' : '';
    return `${prefix}${variance.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Failed to load enhanced load factor data</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const terminals = activeTab === 'headhaul' ? data?.headhaulByTerminal : data?.backhaulByTerminal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            to="/reports"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Reports
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Enhanced Load Factor Analysis
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Load factor by terminal with variance tracking (WoW, MoM, YoY)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From:</label>
            <input
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To:</label>
            <input
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickDateRange('thisWeek')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              This Week
            </button>
            <button
              onClick={() => setQuickDateRange('lastWeek')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              Last Week
            </button>
            <button
              onClick={() => setQuickDateRange('last4Weeks')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              Last 4 Weeks
            </button>
            <button
              onClick={() => setQuickDateRange('thisMonth')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* Gauge Charts */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Overall Load Factor
            </h3>
            <GaugeChart
              value={data.gauges.overall}
              min={0}
              max={100}
              unit="%"
              label={`${data.gauges.overall.toFixed(1)}%`}
              thresholds={{ warning: 60, good: 80 }}
              size="lg"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Headhaul Load Factor
            </h3>
            <GaugeChart
              value={data.gauges.headhaul}
              min={0}
              max={100}
              unit="%"
              label={`${data.gauges.headhaul.toFixed(1)}%`}
              thresholds={{ warning: 60, good: 80 }}
              size="lg"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Backhaul Load Factor
            </h3>
            <GaugeChart
              value={data.gauges.backhaul}
              min={0}
              max={100}
              unit="%"
              label={`${data.gauges.backhaul.toFixed(1)}%`}
              thresholds={{ warning: 40, good: 60 }}
              size="lg"
            />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('headhaul')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'headhaul'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Headhaul by Terminal
          </button>
          <button
            onClick={() => setActiveTab('backhaul')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'backhaul'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Backhaul by Terminal
          </button>
        </nav>
      </div>

      {/* Data Table */}
      {terminals && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Terminal
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Load Factor
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  WoW
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  MoM
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  YoY
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {terminals.map((terminal: TerminalLoadFactor) => (
                <React.Fragment key={terminal.terminal}>
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => toggleTerminal(terminal.terminal)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {expandedTerminals.has(terminal.terminal) ? (
                          <ChevronDown className="w-4 h-4 mr-2 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />
                        )}
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {terminal.terminal}
                          </span>
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            {terminal.terminalName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(terminal.weight)} lbs
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(terminal.capacity)} lbs
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          terminal.loadFactorPercent >= 80
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : terminal.loadFactorPercent >= 60
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {terminal.loadFactorPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${getVarianceColor(terminal.wowVariance)}`}>
                      {formatVariance(terminal.wowVariance)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${getVarianceColor(terminal.momVariance)}`}>
                      {formatVariance(terminal.momVariance)}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${getVarianceColor(terminal.yoyVariance)}`}>
                      {formatVariance(terminal.yoyVariance)}
                    </td>
                  </tr>
                  {expandedTerminals.has(terminal.terminal) && terminal.lanes.length > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td colSpan={7} className="px-8 py-3">
                        <table className="min-w-full">
                          <thead>
                            <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                              <th className="text-left pb-2">Lane</th>
                              <th className="text-right pb-2">Weight</th>
                              <th className="text-right pb-2">Capacity</th>
                              <th className="text-right pb-2">Load Factor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {terminal.lanes.map((lane: LaneLoadFactor) => (
                              <tr key={lane.lane}>
                                <td className="py-2 text-sm text-gray-900 dark:text-gray-100">
                                  {lane.originCode} → {lane.destinationCode}
                                </td>
                                <td className="py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                                  {formatNumber(lane.weight)} lbs
                                </td>
                                <td className="py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                                  {formatNumber(lane.capacity)} lbs
                                </td>
                                <td className="py-2 text-right">
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                      lane.loadFactorPercent >= 80
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : lane.loadFactorPercent >= 60
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}
                                  >
                                    {lane.loadFactorPercent.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {terminals.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No load factor data available for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnhancedLoadFactorReport;
