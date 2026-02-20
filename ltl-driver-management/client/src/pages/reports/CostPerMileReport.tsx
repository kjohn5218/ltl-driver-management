import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { advancedReportService } from '../../services/advancedReportService';
import { GaugeChart } from '../../components/charts/GaugeChart';
import { LaneCPM, EmployerCPM } from '../../types/reports';

export const CostPerMileReport: React.FC = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'byLane' | 'byEmployer'>('byLane');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cost-per-mile', startDate.toISOString(), endDate.toISOString()],
    queryFn: () => advancedReportService.getCostPerMile({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
  });

  const toggleLane = (lane: string) => {
    const newExpanded = new Set(expandedLanes);
    if (newExpanded.has(lane)) {
      newExpanded.delete(lane);
    } else {
      newExpanded.add(lane);
    }
    setExpandedLanes(newExpanded);
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date();
    switch (range) {
      case 'thisMonth':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'lastMonth':
        setStartDate(startOfMonth(subMonths(now, 1)));
        setEndDate(endOfMonth(subMonths(now, 1)));
        break;
      case 'last3Months':
        setStartDate(startOfMonth(subMonths(now, 2)));
        setEndDate(endOfMonth(now));
        break;
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    let csvContent = '';

    if (activeTab === 'byLane') {
      const headers = ['Lane', 'Origin', 'Destination', 'Total Cost', 'Miles', 'Trips', 'CPM', 'Prior Month CPM', 'Variance'];
      csvContent = [
        headers.join(','),
        ...data.byLane.map((lane: LaneCPM) => [
          lane.lane,
          lane.originCode,
          lane.destinationCode,
          lane.totalCost.toFixed(2),
          lane.miles.toFixed(0),
          lane.trips,
          lane.cpm.toFixed(3),
          lane.priorMonthCPM?.toFixed(3) ?? '',
          lane.costVariance?.toFixed(3) ?? '',
        ].join(','))
      ].join('\n');
    } else {
      const headers = ['Employer', 'Total Cost', 'Miles', 'Trips', 'CPM', 'Prior Month CPM', 'Variance'];
      csvContent = [
        headers.join(','),
        ...data.byEmployer.map((emp: EmployerCPM) => [
          `"${emp.employer}"`,
          emp.totalCost.toFixed(2),
          emp.totalMiles.toFixed(0),
          emp.trips,
          emp.cpm.toFixed(3),
          emp.priorMonthCPM?.toFixed(3) ?? '',
          emp.costVariance?.toFixed(3) ?? '',
        ].join(','))
      ].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cost-per-mile-${activeTab}-${format(startDate, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatCPM = (value: number) => {
    return `$${value.toFixed(3)}`;
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return '';
    // For CPM, negative variance is good (lower cost)
    if (variance < 0) return 'text-green-600 dark:text-green-400';
    if (variance > 0) return 'text-red-600 dark:text-red-400';
    return '';
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
        <p className="text-red-600 dark:text-red-400">Failed to load cost per mile data</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cost Per Mile Analysis</h1>
            <p className="text-gray-600 dark:text-gray-400">
              CPM breakdown by lane and employer with variance tracking
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
              onClick={() => setQuickDateRange('thisMonth')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickDateRange('lastMonth')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickDateRange('last3Months')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              Last 3 Months
            </button>
          </div>
        </div>
      </div>

      {/* Gauge Charts */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Overall LH Cost Per Mile
            </h3>
            <GaugeChart
              value={data.gauges.lhCostPerMile}
              min={0}
              max={3}
              unit=""
              label={formatCPM(data.gauges.lhCostPerMile)}
              thresholds={{ warning: 50, good: 75 }}
              invertColors={true}
              size="lg"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              CCFS Cost Per Mile
            </h3>
            <GaugeChart
              value={data.gauges.ccfsCostPerMile}
              min={0}
              max={3}
              unit=""
              label={formatCPM(data.gauges.ccfsCostPerMile)}
              thresholds={{ warning: 50, good: 75 }}
              invertColors={true}
              size="lg"
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
              Contract Power Cost Per Mile
            </h3>
            <GaugeChart
              value={data.gauges.contractedCostPerMile}
              min={0}
              max={3}
              unit=""
              label={formatCPM(data.gauges.contractedCostPerMile)}
              thresholds={{ warning: 50, good: 75 }}
              invertColors={true}
              size="lg"
            />
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Miles</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(data.summary.totalMiles)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(data.summary.totalCost)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Contract Power %</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {data.summary.contractPowerCostPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(data.summary.contractPowerCost)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Contract Miles %</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {data.summary.contractPowerMileagePercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(data.summary.contractPowerMileage)} mi
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('byLane')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'byLane'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            By Lane
          </button>
          <button
            onClick={() => setActiveTab('byEmployer')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'byEmployer'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            By Employer
          </button>
        </nav>
      </div>

      {/* Data Tables */}
      {data && activeTab === 'byLane' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Lane
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Miles
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trips
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  CPM
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prior Month
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Variance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.byLane.map((lane: LaneCPM) => (
                <React.Fragment key={lane.lane}>
                  <tr
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => toggleLane(lane.lane)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        {expandedLanes.has(lane.lane) ? (
                          <ChevronDown className="w-4 h-4 mr-2 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {lane.originCode} → {lane.destinationCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatCurrency(lane.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                      {formatNumber(lane.miles)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                      {lane.trips}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatCPM(lane.cpm)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                      {lane.priorMonthCPM !== null ? formatCPM(lane.priorMonthCPM) : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-medium ${getVarianceColor(lane.costVariance)}`}>
                      {lane.costVariance !== null ? (
                        <>
                          {lane.costVariance > 0 ? '+' : ''}
                          {formatCPM(lane.costVariance)}
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                  {expandedLanes.has(lane.lane) && (
                    <tr className="bg-gray-50 dark:bg-gray-900">
                      <td colSpan={7} className="px-8 py-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Labor Cost:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{formatCurrency(lane.laborCost)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Equipment Cost:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{formatCurrency(lane.equipmentCost)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Fuel Cost:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-100">{formatCurrency(lane.fuelCost)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {data.byLane.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No lane data available for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && activeTab === 'byEmployer' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Employer
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Miles
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Trips
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  CPM
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prior Month
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Variance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {data.byEmployer.map((emp: EmployerCPM) => (
                <tr key={emp.employer} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {emp.employer}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {formatCurrency(emp.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {formatNumber(emp.totalMiles)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-100">
                    {emp.trips}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCPM(emp.cpm)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
                    {emp.priorMonthCPM !== null ? formatCPM(emp.priorMonthCPM) : '-'}
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-medium ${getVarianceColor(emp.costVariance)}`}>
                    {emp.costVariance !== null ? (
                      <>
                        {emp.costVariance > 0 ? '+' : ''}
                        {formatCPM(emp.costVariance)}
                      </>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {data.byEmployer.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No employer data available for the selected period
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

export default CostPerMileReport;
