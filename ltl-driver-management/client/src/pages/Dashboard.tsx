import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Truck,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  Clock,
  XCircle,
  Users,
  Shield,
  BarChart3,
  Activity,
  LayoutGrid,
  QrCode,
  Printer
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
  openBookings: number;
  outstandingRateConfirmations: number;
  rateConfirmationsNotSent: number;
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
      name: 'Open Bookings',
      value: data.metrics.openBookings || 0,
      icon: Calendar,
      color: 'bg-blue-600',
      description: 'Bookings not completed or cancelled',
      onClick: () => navigate('/bookings?status=PENDING,CONFIRMED')
    },
    {
      name: 'Outstanding Rate Confirmations',
      value: data.metrics.outstandingRateConfirmations || 0,
      icon: Shield,
      color: 'bg-orange-600',
      description: 'Sent confirmations awaiting signatures',
      urgent: data.metrics.outstandingRateConfirmations > 5,
      onClick: () => navigate('/bookings?rateConfirmation=outstanding')
    },
    {
      name: 'Rate Confirmations not Sent',
      value: data.metrics.rateConfirmationsNotSent || 0,
      icon: FileText,
      color: 'bg-red-600',
      description: 'Bookings without confirmations sent',
      urgent: data.metrics.rateConfirmationsNotSent > 3,
      onClick: () => navigate('/bookings?rateConfirmation=notSent')
    },
    {
      name: 'Pending Invoices',
      value: data.metrics.pendingInvoices || 0,
      icon: DollarSign,
      color: 'bg-green-600',
      urgent: data.metrics.pendingInvoices > 10,
      onClick: () => navigate('/invoices?status=PENDING')
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

  // Quick Navigation Cards
  const quickNavCards = [
    {
      name: 'LineHaul Dispatch',
      icon: LayoutGrid,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      route: '/dispatch'
    },
    {
      name: 'Dispatch Trip',
      icon: Truck,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      route: '/dispatch/trip'
    },
    {
      name: 'Arrive Trip',
      icon: Truck,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      route: '/arrive-trip'
    },
    {
      name: 'Transfer Scans',
      icon: QrCode,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      route: '/transfer-scans'
    },
    {
      name: 'Print Hazmat BOL',
      icon: Printer,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      route: '/print-hazmat-bol'
    }
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CrossCountry Freight Solutions</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
          LTL Carrier Network Management Platform
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Operational overview and key performance indicators
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {quickNavCards.map((card) => (
          <button
            key={card.name}
            onClick={() => navigate(card.route)}
            className={`${card.color} ${card.hoverColor} p-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 flex flex-col items-center justify-center text-white`}
          >
            <card.icon className="h-10 w-10 mb-3" />
            <span className="text-sm font-semibold text-center">{card.name}</span>
          </button>
        ))}
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {operationalMetrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:scale-105"
            onClick={metric.onClick}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-lg p-3 ${metric.color}`}>
                    <metric.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                      {metric.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {metric.value}
                      </div>
                    </dd>
                    {metric.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{metric.description}</p>
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
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-yellow-400"
            onClick={item.onClick}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-lg p-3 ${item.color}`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {item.name}
                    </dt>
                    <dd className="text-2xl font-bold text-gray-900 dark:text-white">
                      {item.value}
                    </dd>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Financial Performance</h3>
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Expenses</dt>
              <dd className="text-lg font-bold text-gray-900 dark:text-white">
                ${(data.metrics.monthlyExpenses || 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Cost/Trip</dt>
              <dd className="text-lg font-bold text-gray-900 dark:text-white">
                ${data.metrics.completedBookings > 0
                  ? Math.round((data.metrics.totalExpenses || 0) / data.metrics.completedBookings).toLocaleString()
                  : 0}
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Cost per Mile</dt>
              <dd className="text-lg font-bold text-blue-600">
                $
                {(() => {
                  const avgMilesPerTrip = 300;
                  const totalMiles = data.metrics.completedBookings * avgMilesPerTrip;
                  const costPerMile = totalMiles > 0
                    ? ((data.metrics.totalExpenses || 0) / totalMiles).toFixed(2)
                    : '0.00';
                  return costPerMile;
                })()}
              </dd>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Payments</dt>
                <dd className={`text-lg font-bold ${data.metrics.pendingInvoices > 10 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                  {data.metrics.pendingInvoices}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        {/* Network Coverage */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Network Coverage</h3>
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Routes</dt>
              <dd className="text-lg font-bold text-gray-900 dark:text-white">{data.metrics.totalRoutes}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Coverage Rate</dt>
              <dd className="text-lg font-bold text-green-600">{routeCoverageRate}%</dd>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${routeCoverageRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {data.metrics.bookedRoutes} of {data.metrics.totalRoutes} routes covered
              </p>
            </div>
          </dl>
        </div>

        {/* Carrier Network */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Carrier Network</h3>
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <dl className="space-y-3">
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Carriers</dt>
              <dd className="text-lg font-bold text-gray-900 dark:text-white">{data.metrics.activeCarriers}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Onboarding Rate</dt>
              <dd className="text-lg font-bold text-green-600">{carriersOnboardingRate}%</dd>
            </div>
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${carriersOnboardingRate}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {data.metrics.activeCarriers} of {data.metrics.totalCarriers} carriers active
              </p>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Booking Activity</h3>
          <Activity className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="space-y-4">
          {data.recentActivities.length > 0 ? (
            data.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${
                    activity.status === 'COMPLETED' ? 'bg-green-500' :
                    activity.status === 'CONFIRMED' ? 'bg-blue-500' :
                    activity.status === 'PENDING' ? 'bg-yellow-500' :
                    'bg-gray-400'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {activity.carrier?.name || 'Unassigned Carrier'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {activity.route?.name || activity.routeName || 'Route not specified'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">${activity.rate}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.bookingDate && !isNaN(new Date(activity.bookingDate).getTime())
                      ? format(new Date(activity.bookingDate), 'MMM d, yyyy')
                      : 'Date not available'}
                  </p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    activity.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    activity.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                    activity.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {activity.status.toLowerCase().replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-gray-400" />
              <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No recent activity</h4>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Booking activity will appear here once carriers start taking routes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};