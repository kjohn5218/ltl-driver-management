import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { advancedReportService } from '../../services/advancedReportService';
import { KPIMetricRow } from '../../components/reports/KPIVarianceCard';

export const KPIDashboard: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpi-dashboard'],
    queryFn: () => advancedReportService.getKPIDashboard(),
  });

  const exportToCSV = () => {
    if (!data) return;

    const headers = ['Metric', 'Current Week', 'Last Week', 'Variance', 'YTD', 'YTD Variance'];
    const rows = [
      ['Total Miles', data.metrics.totalMiles.currentWeek, data.metrics.totalMiles.lastWeek, data.metrics.totalMiles.weekVariance, data.metrics.totalMiles.ytd, data.metrics.totalMiles.ytdVariance],
      ['Total Cost', data.metrics.totalCost.currentWeek, data.metrics.totalCost.lastWeek, data.metrics.totalCost.weekVariance, data.metrics.totalCost.ytd, data.metrics.totalCost.ytdVariance],
      ['Cost Per Mile', data.metrics.costPerMile.currentWeek?.toFixed(3), data.metrics.costPerMile.lastWeek?.toFixed(3), data.metrics.costPerMile.weekVariance?.toFixed(3), data.metrics.costPerMile.ytd?.toFixed(3), data.metrics.costPerMile.ytdVariance?.toFixed(3)],
      ['Headhaul Load Factor', `${data.metrics.headhaulLoadFactor.currentWeek?.toFixed(2)}%`, `${data.metrics.headhaulLoadFactor.lastWeek?.toFixed(2)}%`, `${data.metrics.headhaulLoadFactor.weekVariance?.toFixed(2)}%`, `${data.metrics.headhaulLoadFactor.ytd?.toFixed(2)}%`, data.metrics.headhaulLoadFactor.ytdVariance?.toFixed(2)],
      ['Backhaul Load Factor', `${data.metrics.backhaulLoadFactor.currentWeek?.toFixed(2)}%`, `${data.metrics.backhaulLoadFactor.lastWeek?.toFixed(2)}%`, `${data.metrics.backhaulLoadFactor.weekVariance?.toFixed(2)}%`, `${data.metrics.backhaulLoadFactor.ytd?.toFixed(2)}%`, data.metrics.backhaulLoadFactor.ytdVariance?.toFixed(2)],
      ['Overall Load Factor', `${data.metrics.overallLoadFactor.currentWeek?.toFixed(2)}%`, `${data.metrics.overallLoadFactor.lastWeek?.toFixed(2)}%`, `${data.metrics.overallLoadFactor.weekVariance?.toFixed(2)}%`, `${data.metrics.overallLoadFactor.ytd?.toFixed(2)}%`, data.metrics.overallLoadFactor.ytdVariance?.toFixed(2)],
      ['Linehaul On-Time', `${data.metrics.linehaulOnTime.currentWeek?.toFixed(2)}%`, `${data.metrics.linehaulOnTime.lastWeek?.toFixed(2)}%`, `${data.metrics.linehaulOnTime.weekVariance?.toFixed(2)}%`, `${data.metrics.linehaulOnTime.ytd?.toFixed(2)}%`, data.metrics.linehaulOnTime.ytdVariance?.toFixed(2)],
      ['Avg Outbound Delay (min)', data.metrics.avgOutboundDelay.currentWeek?.toFixed(2), data.metrics.avgOutboundDelay.lastWeek?.toFixed(2), data.metrics.avgOutboundDelay.weekVariance?.toFixed(2), data.metrics.avgOutboundDelay.ytd?.toFixed(2), data.metrics.avgOutboundDelay.ytdVariance?.toFixed(2)],
    ];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell ?? ''}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kpi-dashboard-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
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
        <p className="text-red-600 dark:text-red-400">Failed to load KPI dashboard data</p>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">KPI Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Week-over-week and year-to-date performance metrics
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

      {/* Date Range Info */}
      {data?.dateRange && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-900 dark:text-blue-200">Current Week:</span>
              <span className="ml-2 text-blue-700 dark:text-blue-300">
                {format(new Date(data.dateRange.currentWeekStart), 'MMM d')} - {format(new Date(data.dateRange.currentWeekEnd), 'MMM d, yyyy')}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-900 dark:text-blue-200">Last Week:</span>
              <span className="ml-2 text-blue-700 dark:text-blue-300">
                {format(new Date(data.dateRange.lastWeekStart), 'MMM d')} - {format(new Date(data.dateRange.lastWeekEnd), 'MMM d, yyyy')}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-900 dark:text-blue-200">YTD:</span>
              <span className="ml-2 text-blue-700 dark:text-blue-300">
                {format(new Date(data.dateRange.ytdStart), 'MMM d')} - {format(new Date(data.dateRange.ytdEnd), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-5 gap-3">
            {/* Header Row */}
            <div className="col-span-5 grid grid-cols-5 gap-3 mb-2">
              <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Current Week</div>
              <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Last Week</div>
              <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">WoW Variance</div>
              <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">YTD</div>
              <div className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">YTD Variance</div>
            </div>

            {/* Total Miles Row */}
            <KPIMetricRow
              metricName="Total Miles"
              currentValue={data.metrics.totalMiles.currentWeek}
              lastWeekValue={data.metrics.totalMiles.lastWeek}
              variance={data.metrics.totalMiles.weekVariance}
              ytdValue={data.metrics.totalMiles.ytd}
              ytdVariance={data.metrics.totalMiles.ytdVariance}
              format="miles"
              varianceType="positive-good"
            />

            {/* Total Cost Row */}
            <KPIMetricRow
              metricName="Total Cost"
              currentValue={data.metrics.totalCost.currentWeek}
              lastWeekValue={data.metrics.totalCost.lastWeek}
              variance={data.metrics.totalCost.weekVariance}
              ytdValue={data.metrics.totalCost.ytd}
              ytdVariance={data.metrics.totalCost.ytdVariance}
              format="currency"
              varianceType="negative-good"
            />

            {/* Cost Per Mile Row */}
            <KPIMetricRow
              metricName="Cost Per Mile"
              currentValue={data.metrics.costPerMile.currentWeek}
              lastWeekValue={data.metrics.costPerMile.lastWeek}
              variance={data.metrics.costPerMile.weekVariance}
              ytdValue={data.metrics.costPerMile.ytd}
              ytdVariance={data.metrics.costPerMile.ytdVariance}
              format="currency"
              varianceType="negative-good"
            />

            {/* Headhaul Load Factor Row */}
            <KPIMetricRow
              metricName="Headhaul Load Factor"
              currentValue={data.metrics.headhaulLoadFactor.currentWeek}
              lastWeekValue={data.metrics.headhaulLoadFactor.lastWeek}
              variance={data.metrics.headhaulLoadFactor.weekVariance}
              ytdValue={data.metrics.headhaulLoadFactor.ytd}
              ytdVariance={data.metrics.headhaulLoadFactor.ytdVariance}
              format="percent"
              varianceType="positive-good"
            />

            {/* Backhaul Load Factor Row */}
            <KPIMetricRow
              metricName="Backhaul Load Factor"
              currentValue={data.metrics.backhaulLoadFactor.currentWeek}
              lastWeekValue={data.metrics.backhaulLoadFactor.lastWeek}
              variance={data.metrics.backhaulLoadFactor.weekVariance}
              ytdValue={data.metrics.backhaulLoadFactor.ytd}
              ytdVariance={data.metrics.backhaulLoadFactor.ytdVariance}
              format="percent"
              varianceType="positive-good"
            />

            {/* Overall Load Factor Row */}
            <KPIMetricRow
              metricName="Overall Load Factor"
              currentValue={data.metrics.overallLoadFactor.currentWeek}
              lastWeekValue={data.metrics.overallLoadFactor.lastWeek}
              variance={data.metrics.overallLoadFactor.weekVariance}
              ytdValue={data.metrics.overallLoadFactor.ytd}
              ytdVariance={data.metrics.overallLoadFactor.ytdVariance}
              format="percent"
              varianceType="positive-good"
            />

            {/* Linehaul On-Time Row */}
            <KPIMetricRow
              metricName="Linehaul On-Time"
              currentValue={data.metrics.linehaulOnTime.currentWeek}
              lastWeekValue={data.metrics.linehaulOnTime.lastWeek}
              variance={data.metrics.linehaulOnTime.weekVariance}
              ytdValue={data.metrics.linehaulOnTime.ytd}
              ytdVariance={data.metrics.linehaulOnTime.ytdVariance}
              format="percent"
              varianceType="positive-good"
            />

            {/* Avg Outbound Delay Row */}
            <KPIMetricRow
              metricName="Avg Outbound Delay (min)"
              currentValue={data.metrics.avgOutboundDelay.currentWeek}
              lastWeekValue={data.metrics.avgOutboundDelay.lastWeek}
              variance={data.metrics.avgOutboundDelay.weekVariance}
              ytdValue={data.metrics.avgOutboundDelay.ytd}
              ytdVariance={data.metrics.avgOutboundDelay.ytdVariance}
              format="minutes"
              varianceType="negative-good"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KPIDashboard;
