import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Target, Truck, Package, Clock, DollarSign } from 'lucide-react';

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
  unbookedRoutes: number;
  bookedRoutes: number;
  pendingRateConfirmations: number;
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
  const monthlyBookingCosts = [
    { month: 'Jan', ltlBookingCosts: 45000, bookings: 23, internalBudget: 50000, savings: 5000 },
    { month: 'Feb', ltlBookingCosts: 52000, bookings: 28, internalBudget: 60000, savings: 8000 },
    { month: 'Mar', ltlBookingCosts: 48000, bookings: 25, internalBudget: 55000, savings: 7000 },
    { month: 'Apr', ltlBookingCosts: 61000, bookings: 32, internalBudget: 70000, savings: 9000 },
    { month: 'May', ltlBookingCosts: 55000, bookings: 29, internalBudget: 65000, savings: 10000 },
    { month: 'Jun', ltlBookingCosts: 67000, bookings: 35, internalBudget: 80000, savings: 13000 },
  ];

  const carrierCostAnalysis = [
    { name: 'Swift Transport', bookings: 45, totalCost: 78000, avgCostPerMile: 2.45, internalCostSaving: 15200, costEfficiency: 95.2 },
    { name: 'Reliable Freight', bookings: 38, totalCost: 65000, avgCostPerMile: 2.38, internalCostSaving: 13800, costEfficiency: 96.8 },
    { name: 'Express Logistics', bookings: 32, totalCost: 54000, avgCostPerMile: 2.52, internalCostSaving: 11200, costEfficiency: 92.1 },
    { name: 'Prime Carriers', bookings: 29, totalCost: 48000, avgCostPerMile: 2.35, internalCostSaving: 10800, costEfficiency: 97.4 },
  ];

  const statusDistribution = [
    { name: 'Completed', value: 45, color: '#10B981' },
    { name: 'In Progress', value: 23, color: '#8B5CF6' },
    { name: 'Pending', value: 18, color: '#F59E0B' },
    { name: 'Cancelled', value: 14, color: '#EF4444' },
  ];

  const ltlRouteOptimization = [
    { route: 'LA → NYC', bookings: 28, totalCost: 84000, avgCostPerMile: 2.8, resourceUtilization: 85, potentialSavings: 12600 },
    { route: 'Chicago → Miami', bookings: 24, totalCost: 72000, avgCostPerMile: 2.6, resourceUtilization: 75, potentialSavings: 10800 },
    { route: 'Houston → Atlanta', bookings: 21, totalCost: 63000, avgCostPerMile: 2.9, resourceUtilization: 68, potentialSavings: 9450 },
    { route: 'Seattle → Denver', bookings: 19, totalCost: 57000, avgCostPerMile: 2.4, resourceUtilization: 63, potentialSavings: 8550 },
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
          <h1 className="text-2xl font-bold text-gray-900">LTL Resource Management Reports</h1>
          <p className="text-gray-600">Cost analysis and resource booking optimization for LTL operations</p>
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

      {/* Key LTL Resource Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">LTL Booking Costs</p>
              <p className="text-2xl font-semibold text-gray-900">${metrics?.totalExpenses?.toLocaleString() || '0'}</p>
              <p className="text-xs text-gray-400">vs internal resources</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Resource Utilization</p>
              <p className="text-2xl font-semibold text-gray-900">
                {metrics?.completedBookings && metrics?.totalBookings 
                  ? Math.round((metrics.completedBookings / metrics.totalBookings) * 100) 
                  : 0}%
              </p>
              <p className="text-xs text-gray-400">{metrics?.completedBookings || 0} completed bookings</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending Resources</p>
              <p className="text-2xl font-semibold text-gray-900">{metrics?.unbookedRoutes || 0}</p>
              <p className="text-xs text-gray-400">unbooked routes</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Cost Efficiency</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${metrics?.completedBookings > 0 
                  ? Math.round((metrics?.totalExpenses || 0) / metrics.completedBookings).toLocaleString()
                  : '0'}
              </p>
              <p className="text-xs text-gray-400">avg per booking</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTL Booking Costs vs Internal Budget */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LTL Resource Costs vs Internal Budget</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyBookingCosts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value, name) => {
                const formattedValue = `$${Number(value).toLocaleString()}`;
                const nameMap: {[key: string]: string} = {
                  'internalBudget': 'Internal Budget',
                  'ltlBookingCosts': 'LTL Booking Costs',
                  'savings': 'Cost Savings'
                };
                return [formattedValue, nameMap[name] || name];
              }} />
              <Bar dataKey="internalBudget" fill="#E5E7EB" name="internalBudget" />
              <Bar dataKey="ltlBookingCosts" fill="#3B82F6" name="ltlBookingCosts" />
              <Bar dataKey="savings" fill="#10B981" name="savings" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Resource Booking Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LTL Resource Booking Status</h3>
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
              <Tooltip formatter={(value) => [`${value} bookings`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LTL Carrier Cost Efficiency */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LTL Carrier Cost Efficiency</h3>
          <div className="space-y-4">
            {carrierCostAnalysis.map((carrier, index) => (
              <div key={carrier.name} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{carrier.name}</p>
                  <p className="text-sm text-gray-500">{carrier.bookings} bookings • ${carrier.avgCostPerMile}/mile • {carrier.costEfficiency}% efficient</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">${carrier.totalCost.toLocaleString()}</p>
                  <p className="text-sm text-green-600">+${carrier.internalCostSaving.toLocaleString()} saved</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LTL Route Optimization */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">LTL Route Resource Optimization</h3>
          <div className="space-y-4">
            {ltlRouteOptimization.map((route, index) => (
              <div key={route.route} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{route.route}</p>
                  <p className="text-sm text-gray-500">{route.bookings} bookings • ${route.avgCostPerMile}/mile • {route.resourceUtilization}% utilized</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">${route.totalCost.toLocaleString()}</p>
                  <p className="text-sm text-green-600">+${route.potentialSavings.toLocaleString()} potential</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LTL Resource Management Insights */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">LTL Resource Management Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-900">Cost Savings</p>
            <p className="text-xs text-green-700">$52K saved vs internal resources this month</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-blue-900">Best Efficiency</p>
            <p className="text-xs text-blue-700">Prime Carriers - 97.4% cost efficient</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <Package className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-orange-900">Resource Optimization</p>
            <p className="text-xs text-orange-700">{metrics?.pendingRateConfirmations || 0} pending confirmations</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <Truck className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-purple-900">Capacity Planning</p>
            <p className="text-xs text-purple-700">{metrics?.unbookedRoutes || 0} routes need LTL resources</p>
          </div>
        </div>
      </div>
    </div>
  );
};