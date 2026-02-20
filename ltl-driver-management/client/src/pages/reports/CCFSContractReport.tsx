import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { advancedReportService } from '../../services/advancedReportService';

export const CCFSContractReport: React.FC = () => {
  const [months, setMonths] = useState(12);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['ccfs-contract-monthly', months],
    queryFn: () => advancedReportService.getCCFSContractMonthly(months),
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toFixed(0);
  };

  const exportToCSV = () => {
    if (!data) return;

    const headers = [
      'Month',
      'CCFS Cost',
      'Contract Power Cost',
      'Total Cost',
      'Contract Power %',
      'CCFS Miles',
      'Contract Power Miles',
      'Total Miles',
      'Contract Power Miles %',
    ];

    const rows = data.monthly.map((m) => [
      m.monthLabel,
      m.ccfsCost.toFixed(2),
      m.contractPowerCost.toFixed(2),
      m.totalCost.toFixed(2),
      m.contractPowerPercent.toFixed(2),
      m.ccfsMiles.toFixed(0),
      m.contractPowerMiles.toFixed(0),
      m.totalMiles.toFixed(0),
      m.contractPowerMilesPercent.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ccfs-vs-contract-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
        <p className="text-red-600 dark:text-red-400">
          Failed to load CCFS vs Contract data
        </p>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              CCFS vs Contract Power
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monthly cost and miles comparison between CCFS and Contract Power
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
          >
            <option value={6}>Last 6 Months</option>
            <option value={12}>Last 12 Months</option>
            <option value={18}>Last 18 Months</option>
            <option value={24}>Last 24 Months</option>
          </select>
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

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Cost</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(data.summary.totalCost)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Contract Power %</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {data.summary.contractPowerPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatCurrency(data.summary.contractPowerCost)} of total
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Miles</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(data.summary.totalMiles)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Contract Miles %</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {data.summary.contractPowerMilesPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(data.summary.contractPowerMiles)} miles
            </div>
          </div>
        </div>
      )}

      {/* Cost Chart */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Monthly Cost Comparison
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'contractPowerPercent') {
                    return [`${value.toFixed(1)}%`, 'Contract Power %'];
                  }
                  return [formatCurrency(value), name === 'ccfsCost' ? 'CCFS Cost' : 'Contract Power Cost'];
                }}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="ccfsCost"
                name="CCFS Cost"
                fill="#94a3b8"
                stackId="cost"
              />
              <Bar
                yAxisId="left"
                dataKey="contractPowerCost"
                name="Contract Power Cost"
                fill="#3b82f6"
                stackId="cost"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="contractPowerPercent"
                name="Contract Power %"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Miles Chart */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Monthly Miles Comparison
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(value) => formatNumber(value)}
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'contractPowerMilesPercent') {
                    return [`${value.toFixed(1)}%`, 'Contract Power Miles %'];
                  }
                  return [formatNumber(value), name === 'ccfsMiles' ? 'CCFS Miles' : 'Contract Power Miles'];
                }}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="ccfsMiles"
                name="CCFS Miles"
                fill="#94a3b8"
                stackId="miles"
              />
              <Bar
                yAxisId="left"
                dataKey="contractPowerMiles"
                name="Contract Power Miles"
                fill="#8b5cf6"
                stackId="miles"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="contractPowerMilesPercent"
                name="Contract Power Miles %"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data Table */}
      {data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Monthly Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CCFS Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CP Cost
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CP %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CCFS Miles
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CP Miles
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    CP Miles %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data.monthly.map((month) => (
                  <tr key={month.month} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {month.monthLabel}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {formatCurrency(month.ccfsCost)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-blue-600 dark:text-blue-400">
                      {formatCurrency(month.contractPowerCost)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          month.contractPowerPercent >= 20
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : month.contractPowerPercent >= 10
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {month.contractPowerPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                      {formatNumber(month.ccfsMiles)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-purple-600 dark:text-purple-400">
                      {formatNumber(month.contractPowerMiles)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {month.contractPowerMilesPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CCFSContractReport;
