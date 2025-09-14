import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, Target, Truck, Package, Clock, DollarSign, Route, Activity } from 'lucide-react';

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
  totalMiles?: number;
  averageCostPerMile?: number;
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
    { month: 'Jan', ltlBookingCosts: 45000, bookings: 23, internalBudget: 50000, savings: 5000, avgCostPerMile: 2.75 },
    { month: 'Feb', ltlBookingCosts: 52000, bookings: 28, internalBudget: 60000, savings: 8000, avgCostPerMile: 2.68 },
    { month: 'Mar', ltlBookingCosts: 48000, bookings: 25, internalBudget: 55000, savings: 7000, avgCostPerMile: 2.62 },
    { month: 'Apr', ltlBookingCosts: 61000, bookings: 32, internalBudget: 70000, savings: 9000, avgCostPerMile: 2.58 },
    { month: 'May', ltlBookingCosts: 55000, bookings: 29, internalBudget: 65000, savings: 10000, avgCostPerMile: 2.55 },
    { month: 'Jun', ltlBookingCosts: 67000, bookings: 35, internalBudget: 80000, savings: 13000, avgCostPerMile: 2.52 },
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
    { route: 'LA → NYC', bookings: 28, totalCost: 84000, avgCostPerMile: 2.8, resourceUtilization: 85, potentialSavings: 12600, totalMiles: 2800, distance: 2800 },
    { route: 'Chicago → Miami', bookings: 24, totalCost: 72000, avgCostPerMile: 2.6, resourceUtilization: 75, potentialSavings: 10800, totalMiles: 1350, distance: 1350 },
    { route: 'Houston → Atlanta', bookings: 21, totalCost: 63000, avgCostPerMile: 2.9, resourceUtilization: 68, potentialSavings: 9450, totalMiles: 790, distance: 790 },
    { route: 'Seattle → Denver', bookings: 19, totalCost: 57000, avgCostPerMile: 2.4, resourceUtilization: 63, potentialSavings: 8550, totalMiles: 1320, distance: 1320 },
  ];

  // Cost per Mile analysis data
  const costPerMileByCarrier = [
    { name: 'Prime Carriers', costPerMile: 2.35, bookings: 29, totalMiles: 20440, totalCost: 48000, trend: 'down', trendValue: -0.05 },
    { name: 'Reliable Freight', costPerMile: 2.38, bookings: 38, totalMiles: 27310, totalCost: 65000, trend: 'stable', trendValue: 0.02 },
    { name: 'Swift Transport', costPerMile: 2.45, bookings: 45, totalMiles: 31837, totalCost: 78000, trend: 'up', trendValue: 0.08 },
    { name: 'Express Logistics', costPerMile: 2.52, bookings: 32, totalMiles: 21429, totalCost: 54000, trend: 'up', trendValue: 0.12 },
  ];

  const costPerMileByRoute = [
    { route: 'Seattle → Denver', costPerMile: 2.4, bookings: 19, avgDistance: 1320, totalCost: 57000, benchmark: 2.8, performance: 'excellent' },
    { route: 'Chicago → Miami', costPerMile: 2.6, bookings: 24, avgDistance: 1350, totalCost: 72000, benchmark: 3.2, performance: 'good' },
    { route: 'LA → NYC', costPerMile: 2.8, bookings: 28, avgDistance: 2800, totalCost: 84000, benchmark: 3.5, performance: 'good' },
    { route: 'Houston → Atlanta', costPerMile: 2.9, bookings: 21, avgDistance: 790, totalCost: 63000, benchmark: 2.2, performance: 'needs-improvement' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
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

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Route className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Cost per Mile</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${metrics?.averageCostPerMile?.toFixed(2) || 
                  (metrics?.totalExpenses && metrics?.totalMiles 
                    ? (metrics.totalExpenses / metrics.totalMiles).toFixed(2) 
                    : '2.65')}
              </p>
              <p className="text-xs text-gray-400">average across all routes</p>
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
                const formattedValue = name === 'avgCostPerMile' ? `$${Number(value).toFixed(2)}/mile` : `$${Number(value).toLocaleString()}`;
                const nameMap: {[key: string]: string} = {
                  'internalBudget': 'Internal Budget',
                  'ltlBookingCosts': 'LTL Booking Costs',
                  'savings': 'Cost Savings',
                  'avgCostPerMile': 'Avg Cost/Mile'
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
            {carrierCostAnalysis.map((carrier) => (
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
            {ltlRouteOptimization.map((route) => (
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

      {/* Cost per Mile Trend Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Cost per Mile Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={monthlyBookingCosts}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={['dataMin - 0.1', 'dataMax + 0.1']} />
            <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}/mile`, 'Average Cost per Mile']} />
            <Line 
              type="monotone" 
              dataKey="avgCostPerMile" 
              stroke="#8B5CF6" 
              strokeWidth={3} 
              dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-800">
            <strong>Trend Analysis:</strong> Cost per mile has decreased by $0.23 over 6 months, showing improved efficiency in LTL resource procurement.
          </p>
        </div>
      </div>

      {/* Cost per Mile Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost per Mile by Carrier */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Cost per Mile by Carrier
          </h3>
          <div className="space-y-4">
            {costPerMileByCarrier.map((carrier) => (
              <div key={carrier.name} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{carrier.name}</p>
                  <p className="text-sm text-gray-500">
                    {carrier.bookings} bookings • {carrier.totalMiles.toLocaleString()} miles
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-600">${carrier.costPerMile}/mile</p>
                  <p className={`text-sm flex items-center gap-1 ${
                    carrier.trend === 'down' ? 'text-green-600' :
                    carrier.trend === 'up' ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {carrier.trend === 'down' && '↓'}
                    {carrier.trend === 'up' && '↑'}
                    {carrier.trend === 'stable' && '→'}
                    {carrier.trend === 'down' ? '-' : carrier.trend === 'up' ? '+' : ''}${Math.abs(carrier.trendValue).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost per Mile by Route */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Route className="h-5 w-5 text-purple-600" />
            Cost per Mile by Route
          </h3>
          <div className="space-y-4">
            {costPerMileByRoute.map((route) => (
              <div key={route.route} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-gray-900">{route.route}</p>
                  <p className="text-sm text-gray-500">
                    {route.bookings} bookings • {route.avgDistance} miles avg
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-purple-600">${route.costPerMile}/mile</p>
                  <p className={`text-xs px-2 py-1 rounded ${
                    route.performance === 'excellent' ? 'bg-green-100 text-green-800' :
                    route.performance === 'good' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    vs ${route.benchmark} benchmark
                  </p>
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