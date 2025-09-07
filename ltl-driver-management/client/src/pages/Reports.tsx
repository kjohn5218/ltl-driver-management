import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, TrendingDown, CreditCard, Users, MapPin, AlertTriangle, Target } from 'lucide-react';

interface DashboardMetrics {
  totalCarriers: number;
  activeCarriers: number;
  totalRoutes: number;
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  totalExpenses: number;
  monthlyExpenses: number;
  averageRate: number;
}

export const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState('30');
  
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard');
      return response.data as DashboardMetrics;
    }
  });

  // Mock data for charts - in a real app, this would come from API
  const monthlyExpenses = [
    { month: 'Jan', expenses: 45000, bookings: 23, budget: 50000 },
    { month: 'Feb', expenses: 52000, bookings: 28, budget: 50000 },
    { month: 'Mar', expenses: 48000, bookings: 25, budget: 50000 },
    { month: 'Apr', expenses: 61000, bookings: 32, budget: 60000 },
    { month: 'May', expenses: 55000, bookings: 29, budget: 60000 },
    { month: 'Jun', expenses: 67000, bookings: 35, budget: 65000 },
  ];

  const carrierCostAnalysis = [
    { name: 'Swift Transport', bookings: 45, totalCost: 78000, avgCost: 1733, efficiency: 4.8 },
    { name: 'Reliable Freight', bookings: 38, totalCost: 65000, avgCost: 1711, efficiency: 4.6 },
    { name: 'Express Logistics', bookings: 32, totalCost: 54000, avgCost: 1688, efficiency: 4.7 },
    { name: 'Prime Carriers', bookings: 29, totalCost: 48000, avgCost: 1655, efficiency: 4.5 },
  ];

  const statusDistribution = [
    { name: 'Completed', value: 45, color: '#10B981' },
    { name: 'In Progress', value: 23, color: '#8B5CF6' },
    { name: 'Pending', value: 18, color: '#F59E0B' },
    { name: 'Cancelled', value: 14, color: '#EF4444' },
  ];

  const routeCostAnalysis = [
    { route: 'LA → NYC', bookings: 28, totalCost: 84000, avgCost: 3000, utilization: 85 },
    { route: 'Chicago → Miami', bookings: 24, totalCost: 72000, avgCost: 3000, utilization: 75 },
    { route: 'Houston → Atlanta', bookings: 21, totalCost: 63000, avgCost: 3000, utilization: 68 },
    { route: 'Seattle → Denver', bookings: 19, totalCost: 57000, avgCost: 3000, utilization: 63 },
  ];

  if (metricsLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Expense analysis and carrier cost management insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 3 months</option>
            <option value="365">Last year</option>
          </select>
          <button className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CreditCard className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Expenses</p>
              <p className="text-2xl font-semibold text-gray-900">${metrics?.totalExpenses?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDown className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Monthly Expenses</p>
              <p className="text-2xl font-semibold text-gray-900">${metrics?.monthlyExpenses?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Carriers</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics?.activeCarriers || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Cost per Trip</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${metrics?.completedBookings > 0 
                  ? Math.round((metrics?.totalExpenses || 0) / metrics.completedBookings).toLocaleString()
                  : '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense vs Budget Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Expenses vs Budget</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyExpenses}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="budget" fill="#E5E7EB" name="Budget ($)" />
              <Bar dataKey="expenses" fill="#EF4444" name="Expenses ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carrier Cost Analysis */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Carrier Cost Analysis</h3>
          <div className="space-y-4">
            {carrierCostAnalysis.map((carrier, index) => (
              <div key={carrier.name} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{carrier.name}</p>
                  <p className="text-sm text-gray-500">{carrier.bookings} trips • Avg: ${carrier.avgCost}/trip</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">${carrier.totalCost.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total Cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Cost Efficiency */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Route Cost Efficiency</h3>
          <div className="space-y-4">
            {routeCostAnalysis.map((route, index) => (
              <div key={route.route} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{route.route}</p>
                  <p className="text-sm text-gray-500">{route.bookings} trips • {route.utilization}% utilization</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">${route.totalCost.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total Cost</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Insights */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Management Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-900">Over Budget</p>
            <p className="text-xs text-red-700">April expenses exceeded budget by $1,000</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900">Most Efficient</p>
            <p className="text-xs text-green-700">Prime Carriers - $1,655 avg cost per trip</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <TrendingDown className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900">Cost Trend</p>
            <p className="text-xs text-blue-700">3% increase in monthly expenses</p>
          </div>
        </div>
      </div>
    </div>
  );
};