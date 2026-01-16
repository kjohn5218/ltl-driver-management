import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Truck,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  XCircle,
  Shield,
  LayoutGrid,
  QrCode,
  Printer,
  DollarSign
} from 'lucide-react';

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

    </div>
  );
};