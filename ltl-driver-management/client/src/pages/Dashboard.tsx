import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Truck, 
  Route, 
  Calendar, 
  DollarSign,
  TrendingDown,
  AlertCircle,
  CreditCard,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  MapPin,
  Shield,
  BarChart3,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { Booking } from '../types';

interface DashboardMetrics {
  totalCarriers: number;
  activeCarriers: number;
  totalRoutes: number;
  totalBookings: number;
  completedBookings: number;
  pendingInvoices: number;
  totalExpenses: number;
  monthlyExpenses: number;
  unbookedRoutes: number;
  bookedRoutes: number;
  pendingRateConfirmations: number;
}

interface DashboardData {
  metrics: DashboardMetrics;
  recentActivities: Booking[];
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/reports/dashboard');
      return response.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <p className="text-sm text-red-800">Failed to load dashboard data</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate key performance indicators
  const carriersOnboardingRate = data.metrics.totalCarriers > 0 
    ? ((data.metrics.activeCarriers / data.metrics.totalCarriers) * 100).toFixed(1)
    : '0';
  
  const routeCoverageRate = data.metrics.totalRoutes > 0 
    ? ((data.metrics.bookedRoutes / data.metrics.totalRoutes) * 100).toFixed(1)
    : '0';

  const operationalMetrics = [
    {
      name: 'Active Carriers',
      value: data.metrics.activeCarriers || 0,
      total: data.metrics.totalCarriers || 0,
      icon: Truck,
      color: 'bg-blue-600',
      percentage: carriersOnboardingRate,
      trend: 'up',
      onClick: () => navigate('/carriers?status=ACTIVE')
    },
    {
      name: 'Route Coverage',
      value: data.metrics.bookedRoutes || 0,
      total: data.metrics.totalRoutes || 0,
      icon: MapPin,
      color: 'bg-green-600',
      percentage: routeCoverageRate,
      trend: 'up',
      onClick: () => navigate('/bookings')
    },
    {
      name: 'Pending Invoices',
      value: data.metrics.pendingInvoices || 0,
      icon: FileText,
      color: 'bg-orange-600',
      urgent: data.metrics.pendingInvoices > 10,
      onClick: () => navigate('/invoices?status=PENDING')
    },
    {
      name: 'Rate Confirmations',
      value: data.metrics.pendingRateConfirmations || 0,
      icon: Shield,
      color: 'bg-red-600',
      urgent: data.metrics.pendingRateConfirmations > 5,
      onClick: () => navigate('/bookings?rateConfirmation=pending')
    }
  ];

  const actionItems = [
    {
      name: 'Unbooked Routes',
      value: data.metrics.unbookedRoutes || 0,
      icon: XCircle,
      color: 'bg-yellow-500',
      description: 'Routes without carrier assignments',
      priority: 'high',
      onClick: () => navigate('/bookings?status=PENDING')
    },
    {
      name: 'Pending Carriers',
      value: (data.metrics.totalCarriers - data.metrics.activeCarriers) || 0,
      icon: Clock,
      color: 'bg-purple-500',
      description: 'Carriers awaiting onboarding',
      priority: 'medium',
      onClick: () => navigate('/carriers?status=PENDING')
    }
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">CrossCountry Freight Solutions</h1>
        <p className="mt-2 text-lg text-gray-600">
          LTL Carrier Network Management Platform
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Operational overview and key performance indicators
        </p>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {operationalMetrics.map((metric) => (
          <div 
            key={metric.name} 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            onClick={metric.onClick}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-lg p-3 ${metric.color}`}>
                    <metric.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {metric.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">
                        {metric.value}
                        {metric.total && (
                          <span className="text-lg font-normal text-gray-500">/{metric.total}</span>
                        )}
                      </div>
                    </dd>
                    {metric.percentage && (
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-600">{metric.percentage}%</span>
                      </div>
                    )}
                  </div>
                </div>
                {metric.urgent && (
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 mb-8">
        {actionItems.map((item) => (
          <div 
            key={item.name} 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-yellow-400"
            onClick={item.onClick}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-lg p-3 ${item.color}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500">
                      {item.name}
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900">
                      {item.value}
                    </dd>
                    <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.priority} priority
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Business Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
        {/* Financial Performance */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Financial Performance</h3>
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Monthly Expenses</dt>
              <dd className="text-lg font-bold text-gray-900">
                ${(data.metrics.monthlyExpenses || 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Avg Cost/Trip</dt>
              <dd className="text-lg font-bold text-gray-900">
                ${data.metrics.completedBookings > 0 
                  ? Math.round((data.metrics.totalExpenses || 0) / data.metrics.completedBookings).toLocaleString()
                  : 0}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Cost per Mile</dt>
              <dd className="text-lg font-bold text-blue-600">
                $
                {(() => {
                  // Calculate total miles from completed bookings and total expenses
                  // This is a simplified calculation - in practice you'd want to track actual miles
                  const avgMilesPerTrip = 300; // Estimated average miles per LTL trip
                  const totalMiles = data.metrics.completedBookings * avgMilesPerTrip;
                  const costPerMile = totalMiles > 0 
                    ? ((data.metrics.totalExpenses || 0) / totalMiles).toFixed(2)
                    : '0.00';
                  return costPerMile;
                })()}
              </dd>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-500">Pending Payments</dt>
                <dd className={`text-lg font-bold ${data.metrics.pendingInvoices > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                  {data.metrics.pendingInvoices}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Network Coverage */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Network Coverage</h3>
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Total Routes</dt>
              <dd className="text-lg font-bold text-gray-900">{data.metrics.totalRoutes}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Coverage Rate</dt>
              <dd className="text-lg font-bold text-green-600">{routeCoverageRate}%</dd>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${routeCoverageRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {data.metrics.bookedRoutes} of {data.metrics.totalRoutes} routes covered
              </p>
            </div>
          </dl>
        </div>

        {/* Carrier Network */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Carrier Network</h3>
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Active Carriers</dt>
              <dd className="text-lg font-bold text-gray-900">{data.metrics.activeCarriers}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500">Onboarding Rate</dt>
              <dd className="text-lg font-bold text-green-600">{carriersOnboardingRate}%</dd>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${carriersOnboardingRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {data.metrics.activeCarriers} of {data.metrics.totalCarriers} carriers active
              </p>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Booking Activity</h3>
          <Activity className="h-5 w-5 text-gray-600" />
        </div>
        <div className="space-y-4">
          {data.recentActivities.length > 0 ? (
            data.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.status === 'COMPLETED' ? 'bg-green-500' : 
                    activity.status === 'CONFIRMED' ? 'bg-blue-500' : 
                    activity.status === 'PENDING' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">
                      {activity.carrier?.name || 'Unassigned Carrier'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {activity.route?.name || activity.routeName || 'Route not specified'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">${activity.rate}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(activity.bookingDate), 'MMM d, yyyy')}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    activity.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                    activity.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.status.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h4 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h4>
              <p className="mt-1 text-sm text-gray-500">
                Booking activity will appear here once carriers start taking routes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};