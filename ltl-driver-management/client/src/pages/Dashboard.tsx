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
  XCircle
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

  const metrics = [
    {
      name: 'Unbooked Routes',
      value: data.metrics.unbookedRoutes || 0,
      icon: XCircle,
      color: 'bg-yellow-500',
      onClick: () => navigate('/bookings?status=PENDING')
    },
    {
      name: 'Booked Routes',
      value: data.metrics.bookedRoutes || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      onClick: () => navigate('/bookings?status=CONFIRMED')
    },
    {
      name: 'Pending Invoices',
      value: data.metrics.pendingInvoices || 0,
      icon: FileText,
      color: 'bg-blue-500',
      onClick: () => navigate('/invoices?status=PENDING')
    },
    {
      name: 'Pending Rate Cons',
      value: data.metrics.pendingRateConfirmations || 0,
      icon: Clock,
      color: 'bg-red-500',
      onClick: () => navigate('/bookings?rateConfirmation=pending')
    }
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Track carrier expenses and route coverage for your LTL operations
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {metrics.map((metric) => (
          <div 
            key={metric.name} 
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
            onClick={metric.onClick}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${metric.color}`}>
                  <metric.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {metric.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {metric.value}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Expense Overview</h2>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </div>
          <dl className="space-y-4">
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Pending Payments</dt>
              <dd className="text-sm font-semibold text-gray-900">{data.metrics.pendingInvoices}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Monthly Expenses</dt>
              <dd className="text-sm font-semibold text-gray-900">
                ${(data.metrics.monthlyExpenses || 0).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Average Cost per Trip</dt>
              <dd className="text-sm font-semibold text-gray-900">
                ${data.metrics.completedBookings > 0 
                  ? Math.round((data.metrics.totalExpenses || 0) / data.metrics.completedBookings).toLocaleString()
                  : 0}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Route Coverage</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {data.metrics.totalRoutes > 0 
                  ? Math.round((data.metrics.completedBookings / data.metrics.totalRoutes) * 100) 
                  : 0}%
              </dd>
            </div>
          </dl>
        </div>

        {/* Recent Carrier Bookings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Carrier Bookings</h2>
          <div className="space-y-3">
            {data.recentActivities.length > 0 ? (
              data.recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-3 text-sm">
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                    activity.status === 'COMPLETED' ? 'bg-green-400' : 
                    activity.status === 'CONFIRMED' ? 'bg-blue-400' : 
                    activity.status === 'PENDING' ? 'bg-yellow-400' :
                    'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate">
                      <span className="font-medium">{activity.carrier?.name || 'Unassigned'}</span>
                      {' - '}
                      {activity.route?.name}
                    </p>
                    <p className="text-gray-500">
                      {format(new Date(activity.bookingDate), 'MMM d, yyyy')}
                      {' • '}
                      <span className="capitalize">{activity.status.toLowerCase().replace('_', ' ')}</span>
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-red-600 font-medium">
                    -${activity.rate}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent carrier bookings</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};