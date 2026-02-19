import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, Target, Truck, Package, Clock, DollarSign, Route, Activity, AlertTriangle, Star, Smile, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { linehaulTripService, MoraleReportResponse } from '../services/linehaulTripService';

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

  // Morale report query - last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: moraleReport } = useQuery({
    queryKey: ['morale-report', dateRange],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));
      return linehaulTripService.getMoraleReport({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 100
      });
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
          <Link
            to="/reports/load-factor"
            className="inline-flex items-center px-3 py-2 border border-blue-300 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm font-medium"
          >
            <Percent className="w-4 h-4 mr-2" />
            Load Factor Report
          </Link>
          <Link
            to="/reports/late-linehaul"
            className="inline-flex items-center px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100 text-sm font-medium"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Late Linehaul Report
          </Link>
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
                ${(metrics?.completedBookings ?? 0) > 0
                  ? Math.round((metrics?.totalExpenses || 0) / (metrics?.completedBookings ?? 1)).toLocaleString()
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

      {/* Driver Morale Report */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Smile className="h-5 w-5 text-yellow-500" />
          Driver Morale Report
        </h3>

        {moraleReport && moraleReport.summary.totalRatings > 0 ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {moraleReport.summary.averageRating?.toFixed(1) || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {moraleReport.summary.totalRatings}
                </p>
                <p className="text-sm text-gray-600">Total Responses</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="flex justify-center items-center mb-2">
                  <Smile className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {moraleReport.summary.ratingDistribution[4] || 0 + (moraleReport.summary.ratingDistribution[5] || 0)}
                </p>
                <p className="text-sm text-gray-600">Positive Ratings (4-5 Stars)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rating Distribution */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Rating Distribution</h4>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = moraleReport.summary.ratingDistribution[rating] || 0;
                    const percentage = moraleReport.summary.totalRatings > 0
                      ? (count / moraleReport.summary.totalRatings) * 100
                      : 0;
                    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Great'];

                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-24">
                          {[...Array(rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          ))}
                          {[...Array(5 - rating)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 text-gray-200" />
                          ))}
                        </div>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rating >= 4 ? 'bg-green-500' :
                              rating === 3 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-16 text-right">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top/Bottom Drivers */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Driver Morale Rankings</h4>
                <div className="space-y-3">
                  {moraleReport.summary.driverAverages.slice(0, 5).map((driver, index) => (
                    <div key={driver.driverId} className="flex items-center justify-between p-2 border border-gray-100 rounded">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                          index === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{driver.driverName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                          <span className="ml-1 text-sm font-medium text-gray-900">
                            {driver.averageRating?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">({driver.ratingCount} ratings)</span>
                      </div>
                    </div>
                  ))}
                  {moraleReport.summary.driverAverages.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No driver ratings yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Ratings Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h4 className="text-sm font-medium text-gray-700">Recent Feedback</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {moraleReport.ratings.slice(0, 10).map((rating) => (
                      <tr key={rating.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(rating.arrivedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {rating.driver?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {rating.trip?.tripNumber || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {rating.trip?.linehaulProfile?.originTerminal?.code && rating.trip?.linehaulProfile?.destinationTerminal?.code
                            ? `${rating.trip.linehaulProfile.originTerminal.code} → ${rating.trip.linehaulProfile.destinationTerminal.code}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {[...Array(rating.rating)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                            ))}
                            {[...Array(5 - rating.rating)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 text-gray-200" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Smile className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No morale ratings collected yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Ratings are collected when drivers complete their second arrival in a 24-hour period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};