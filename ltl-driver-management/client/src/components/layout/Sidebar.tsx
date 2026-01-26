import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  CheckCircle,
  FileSpreadsheet,
  Scissors
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../services/api';
import { CutPayModal } from '../dispatch/CutPayModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [fuelSurchargeRate, setFuelSurchargeRate] = useState<number>(0);
  const [fuelSurchargeSource, setFuelSurchargeSource] = useState<string>('manual');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isCutPayModalOpen, setIsCutPayModalOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    // Dispatch & Fleet Management
    { name: 'Dispatch Board', href: '/dispatch', icon: Send, section: 'dispatch' },
    { name: 'Dispatch Trip', href: '/dispatch?action=dispatch-trip', icon: Truck, section: 'dispatch' },
    { name: 'Arrive Trip', href: '/dispatch?action=arrive-trip', icon: CheckCircle, section: 'dispatch' },
    { name: 'Enter Cut Pay', href: '#cut-pay', icon: Scissors, section: 'dispatch', isCutPay: true },
    { name: 'Transfer Scans', href: '/transfer-scans', icon: QrCode, section: 'dispatch' },
    { name: 'Print Hazmat BOL', href: '/print-hazmat-bol', icon: Printer, section: 'dispatch' },
    { name: 'Create Loadsheet', href: '/dispatch?tab=loads&action=create', icon: FileSpreadsheet, section: 'dispatch' },
    { name: 'Equipment', href: '/equipment', icon: Package, section: 'dispatch' },
    // Core Management
    { name: 'Drivers', href: '/drivers', icon: User },
    { name: 'Carriers', href: '/carriers', icon: Truck },
    { name: 'Linehaul Profiles', href: '/routes', icon: Route },
    { name: 'Locations', href: '/locations', icon: MapPin },
    { name: 'Pay Rules', href: '/pay-rules', icon: DollarSign },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    // Contract Power
    { name: 'Contract Power Home', href: '/contract-power', icon: Home, section: 'contractpower' },
    { name: 'Bookings', href: '/bookings', icon: Calendar, section: 'contractpower' },
    { name: 'Invoices', href: '/invoices', icon: FileText, section: 'contractpower' },
    { name: 'Fuel Surcharge', href: '#fuel-surcharge', icon: Fuel, section: 'contractpower', isFuelSurcharge: true },
    // Payroll
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
        setFuelSurchargeSource(response.data?.fuelSurchargeSource || 'manual');
      } catch (error) {
        console.error('Failed to load fuel surcharge rate:', error);
        setFuelSurchargeRate(0); // Set default value on error
        setFuelSurchargeSource('manual');
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
      setFuelSurchargeSource('manual');
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
            if ((item.name === 'Carriers' || item.name === 'Linehaul Profiles' || item.name === 'Pay Rules' || item.name === 'Reports') && !isAdminOrDispatcher) {
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
            const showContractPowerDivider = item.name === 'Contract Power Home' && isAdminOrDispatcher;
            // Add section divider before Payroll section
            const showPayrollDivider = item.name === 'Payroll' && isAdminOrDispatcher;

            // Special rendering for Cut Pay item (opens modal)
            if ((item as any).isCutPay) {
              return (
                <React.Fragment key={item.name}>
                  <button
                    onClick={() => setIsCutPayModalOpen(true)}
                    className="w-full group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                  >
                    <Scissors
                      className="mr-3 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200"
                      aria-hidden="true"
                    />
                    {item.name}
                  </button>
                </React.Fragment>
              );
            }

            // Special rendering for Fuel Surcharge item
            if ((item as any).isFuelSurcharge) {
              return (
                <React.Fragment key={item.name}>
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Fuel className="mr-3 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fuel Surcharge</span>
                      </div>
                    </div>

                    <div className="ml-8 mt-2 space-y-2">
                      {!isEditing ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {Number(fuelSurchargeRate || 0).toFixed(2)}%
                            </span>
                            {fuelSurchargeSource === 'external' && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">External</span>
                            )}
                          </div>
                          <button
                            onClick={handleEditClick}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit fuel surcharge rate (manual entry)"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              max="100"
                              disabled={isLoading}
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                            <div className="flex gap-1 ml-1">
                              <button
                                onClick={handleSaveClick}
                                disabled={isLoading}
                                className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={handleCancelClick}
                                disabled={isLoading}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Applied to Mile+FSC rates
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            }

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
                  className={() => {
                    // Custom active state logic that considers query parameters
                    const [itemPath, itemSearch] = item.href.split('?');
                    const currentPath = location.pathname;
                    const currentSearch = location.search;

                    let isActive = false;
                    if (itemSearch) {
                      // Link has query params - must match both pathname and query params
                      isActive = currentPath === itemPath && currentSearch.includes(`action=${new URLSearchParams(itemSearch).get('action')}`);
                    } else {
                      // Link has no query params - match pathname but NOT if current URL has action param
                      isActive = currentPath === itemPath && !currentSearch.includes('action=');
                    }

                    return clsx(
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-700 dark:border-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    );
                  }}
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
      </div>

      {/* Cut Pay Modal */}
      <CutPayModal
        isOpen={isCutPayModalOpen}
        onClose={() => setIsCutPayModalOpen(false)}
      />
    </>
  );
};