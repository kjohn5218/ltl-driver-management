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
  X,
  Fuel,
  Settings,
  Edit2,
  Check,
  AlertCircle
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
    { name: 'Carriers', href: '/carriers', icon: Truck },
    { name: 'Routes', href: '/routes', icon: Route },
    { name: 'Bookings', href: '/bookings', icon: Calendar },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  const isAdminOrDispatcher = user?.role === 'ADMIN' || user?.role === 'DISPATCHER';

  // Load fuel surcharge rate on component mount
  useEffect(() => {
    const loadFuelSurchargeRate = async () => {
      try {
        const response = await api.get('/settings');
        setFuelSurchargeRate(response.data.fuelSurchargeRate);
      } catch (error) {
        console.error('Failed to load fuel surcharge rate:', error);
      }
    };

    loadFuelSurchargeRate();
  }, []);

  const handleEditClick = () => {
    setEditValue(fuelSurchargeRate.toString());
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
          'fixed inset-y-0 left-0 z-50 w-56 bg-white shadow-lg transform transition-transform lg:translate-x-0 lg:static lg:inset-0 lg:flex-shrink-0 border-r border-gray-200',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Desktop logo area */}
        <div className="hidden lg:flex items-center px-4 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <h1 className="text-lg font-bold text-gray-900">LTL Driver</h1>
              <p className="text-xs text-gray-500">Management</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-3 space-y-2">
          {navigation.map((item) => {
            // Hide certain items for non-admin/dispatcher users
            if ((item.name === 'Carriers' || item.name === 'Routes' || item.name === 'Reports') && !isAdminOrDispatcher) {
              return null;
            }

            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-gray-500 group-hover:text-gray-700"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
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
                      {fuelSurchargeRate.toFixed(2)}%
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