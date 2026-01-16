import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home,
  Truck,
  Route,
  Calendar,
  FileText,
  BarChart3,
  MapPin,
  X,
  Fuel,
  Edit2,
  Check,
  AlertCircle,
  Users,
  User,
  Package,
  Send,
  DollarSign,
  Wallet,
  QrCode,
  Printer,
  CheckCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState<number>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    // Dispatch & Fleet Management
    { name: 'Dispatch Board', href: '/dispatch', icon: Send, section: 'dispatch' },
    { name: 'Dispatch Trip', href: '/dispatch/trip', icon: Truck, section: 'dispatch' },
    { name: 'Arrive Trip', href: '/arrive-trip', icon: CheckCircle, section: 'dispatch' },
    { name: 'Transfer Scans', href: '/transfer-scans', icon: QrCode, section: 'dispatch' },
    { name: 'Print Hazmat BOL', href: '/print-hazmat-bol', icon: Printer, section: 'dispatch' },
    { name: 'Equipment', href: '/equipment', icon: Package, section: 'dispatch' },
    // Core Management
    { name: 'Drivers', href: '/drivers', icon: User },
    { name: 'Carriers', href: '/carriers', icon: Truck },
    { name: 'Linehaul Profiles', href: '/routes', icon: Route },
    { name: 'Locations', href: '/locations', icon: MapPin },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    // Contract Power
    { name: 'Bookings', href: '/bookings', icon: Calendar, section: 'contractpower' },
    { name: 'Invoices', href: '/invoices', icon: FileText, section: 'contractpower' },
    // Payroll
    { name: 'Rate Cards', href: '/rate-cards', icon: DollarSign, section: 'payroll' },
    { name: 'Payroll', href: '/payroll', icon: Wallet, section: 'payroll' },
    { name: 'Administration', href: '/administration', icon: Users, adminOnly: true },
  ];

  const isAdminOrDispatcher = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';
  const isAdmin = user?.role === 'ADMIN';

  // Load fuel surcharge rate on component mount
  useEffect(() => {
    const loadFuelSurchargeRate = async () => {
      try {
        const response = await api.get('/settings');
        const rate = response.data?.fuelSurchargeRate;
        const numericRate = Number(rate);
        setFuelSurchargeRate(isNaN(numericRate) ? 0 : numericRate);
      } catch (error) {
        console.error('Failed to load fuel surcharge rate:', error);
        setFuelSurchargeRate(0); // Set default value on error
      }
    };

    loadFuelSurchargeRate();
  }, []);

  const handleEditClick = () => {
    setEditValue(Number(fuelSurchargeRate || 0).toString());
    setIsEditing(true);
    setError('');
  };

  const handleSaveClick = async () => {
    if (!editValue || parseFloat(editValue) < 0 || parseFloat(editValue) > 100) {
      setError('Please enter a valid percentage between 0 and 100');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.put('/settings/fuel-surcharge', {
        fuelSurchargeRate: parseFloat(editValue)
      });
      setFuelSurchargeRate(response.data.fuelSurchargeRate);
      setIsEditing(false);
      setError('');
    } catch (error) {
      setError('Failed to update fuel surcharge rate');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelClick = () => {
    setIsEditing(false);
    setError('');
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={clsx(
          'fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden',
          isOpen ? 'opacity-100 z-40' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-56 bg-white dark:bg-gray-800 shadow-lg transform transition-transform lg:translate-x-0 lg:static lg:inset-0 lg:flex-shrink-0 border-r border-gray-200 dark:border-gray-700',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop logo area */}
        <div className="hidden lg:flex items-center px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Linehaul</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Management</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-3 space-y-1">
          {navigation.map((item) => {
            // Hide certain items for non-admin/dispatcher users
            if ((item.name === 'Carriers' || item.name === 'Routes' || item.name === 'Reports') && !isAdminOrDispatcher) {
              return null;
            }

            // Hide admin-only items for non-admin users
            if (item.adminOnly && !isAdmin) {
              return null;
            }

            // Hide dispatch, payroll & contractpower items for non-admin/dispatcher users
            if ((item.section === 'dispatch' || item.section === 'payroll' || item.section === 'contractpower') && !isAdminOrDispatcher) {
              return null;
            }

            // Add section divider before Dispatch section (right after Dashboard)
            const showDispatchDivider = item.name === 'Dispatch Board' && isAdminOrDispatcher;
            // Add section divider before Core Management section
            const showCoreDivider = item.name === 'Drivers';
            // Add section divider before Contract Power section
            const showContractPowerDivider = item.name === 'Bookings' && isAdminOrDispatcher;
            // Add section divider before Payroll section
            const showPayrollDivider = item.name === 'Rate Cards' && isAdminOrDispatcher;

            return (
              <React.Fragment key={item.name}>
                {showDispatchDivider && (
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Dispatch & Fleet
                    </p>
                  </div>
                )}
                {showCoreDivider && (
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Management
                    </p>
                  </div>
                )}
                {showContractPowerDivider && (
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Contract Power
                    </p>
                  </div>
                )}
                {showPayrollDivider && (
                  <div className="pt-4 pb-2">
                    <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Payroll
                    </p>
                  </div>
                )}
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    )
                  }
                >
                  <item.icon
                    className="mr-3 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200"
                    aria-hidden="true"
                  />
                  {item.name}
                </NavLink>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Fuel Surcharge Section - Only visible to Admin/Dispatcher */}
        {isAdminOrDispatcher && (
          <div className="mt-8 px-3">
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center mb-3">
                <Fuel className="h-4 w-4 text-gray-500 mr-2" />
                <h3 className="text-sm font-medium text-gray-700">Fuel Surcharge</h3>
              </div>
              
              <div className="space-y-2">
                {!isEditing ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {Number(fuelSurchargeRate || 0).toFixed(2)}%
                    </span>
                    <button
                      onClick={handleEditClick}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Edit fuel surcharge rate"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={isLoading}
                      />
                      <span className="text-sm text-gray-600">%</span>
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={handleSaveClick}
                          disabled={isLoading}
                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                          title="Save"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={handleCancelClick}
                          disabled={isLoading}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-center text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                Current fuel surcharge percentage applied to Mile+FSC rates
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};