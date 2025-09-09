import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Route } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Clock, DollarSign, Filter, X, Calculator, Copy } from 'lucide-react';
import { calculateRoute, calculateArrivalTime, formatRunTime, hasAddressInfo } from '../utils/routeCalculations';
import { LocationWithTooltip, RouteDetails } from '../components/LocationDisplay';


export const Routes: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewingRoute, setViewingRoute] = useState<Route | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copyFromRoute, setCopyFromRoute] = useState<Route | null>(null);

  const { data: routesData, isLoading, error } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      try {
        const response = await api.get('/routes?limit=1500'); // Fetch all routes
        console.log('Routes API response:', response.data);
        return response.data;
      } catch (error) {
        console.error('Routes API error:', error);
        throw error;
      }
    }
  });

  const routes = routesData?.routes || [];
  
  console.log('Routes data:', { routesData, routes, isLoading, error });

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600">Error loading routes: {error.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredRoutes = routes?.filter(route => {
    const matchesSearch = route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.destination.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOrigin = originFilter === '' || route.origin === originFilter;
    
    const matchesActive = activeFilter === 'all' || 
      (activeFilter === 'active' && route.active) ||
      (activeFilter === 'inactive' && !route.active);
    
    return matchesSearch && matchesOrigin && matchesActive;
  }) || [];

  // Get unique origins for filter
  const uniqueOrigins = [...new Set(routes.map(route => route.origin))].sort();

  const handleViewRoute = (route: Route) => {
    setViewingRoute(route);
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
  };

  const handleDeleteRoute = (route: Route) => {
    setDeletingRoute(route);
  };

  const handleCloseView = () => {
    setViewingRoute(null);
  };

  const handleCloseEdit = () => {
    setEditingRoute(null);
  };

  const handleCloseDelete = () => {
    setDeletingRoute(null);
  };

  const handleOpenAddModal = () => {
    setCopyFromRoute(null);
    setShowAddModal(true);
  };

  const handleCopyRoute = (route: Route) => {
    setCopyFromRoute(route);
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setCopyFromRoute(null);
  };

  const confirmDelete = async () => {
    if (!deletingRoute) return;
    
    try {
      await api.delete(`/routes/${deletingRoute.id}`);
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      setDeletingRoute(null);
    } catch (error) {
      console.error('Error deleting route:', error);
      // Handle error (show notification, etc.)
    }
  };

  if (isLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Routes</h1>
          <p className="text-gray-600">Manage routes and schedules</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search routes..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
        >
          <option value="">All Origins</option>
          {uniqueOrigins.map(origin => (
            <option key={origin} value={origin}>{origin}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="all">All Routes</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Routes Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Origin → Destination
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Miles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Schedule
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredRoutes.map((route) => (
              <tr key={route.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{route.name}</div>
                  <div className="text-xs text-gray-500">ID: {route.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                    <LocationWithTooltip location={route.origin} address={route.originAddress} city={route.originCity} state={route.originState} zipCode={route.originZipCode} contact={route.originContact} /> → <LocationWithTooltip location={route.destination} address={route.destinationAddress} city={route.destinationCity} state={route.destinationState} zipCode={route.destinationZipCode} contact={route.destinationContact} />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-medium">{route.distance}</span> miles
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {route.departureTime && route.arrivalTime ? (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      <span className="text-xs">
                        {route.departureTime} - {route.arrivalTime}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">No schedule</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    route.active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {route.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center gap-2 justify-end">
                    <button 
                      onClick={() => handleViewRoute(route)}
                      className="text-gray-500 hover:text-blue-600 transition-colors" 
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEditRoute(route)}
                      className="text-gray-500 hover:text-blue-600 transition-colors" 
                      title="Edit Route"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleCopyRoute(route)}
                      className="text-gray-500 hover:text-green-600 transition-colors" 
                      title="Copy Route"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteRoute(route)}
                      className="text-gray-500 hover:text-red-600 transition-colors" 
                      title="Delete Route"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRoutes.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {routes.length === 0 
              ? "No routes available. Please check your connection or contact support."
              : "No routes found matching your search criteria."
            }
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Total routes loaded: {routes.length}
          </p>
        </div>
      )}

      {/* View Route Modal */}
      {viewingRoute && (
        <RouteViewModal 
          route={viewingRoute} 
          onClose={handleCloseView} 
        />
      )}

      {/* Edit Route Modal */}
      {editingRoute && (
        <RouteEditModal 
          route={editingRoute} 
          onClose={handleCloseEdit} 
          onSave={(updatedRoute) => {
            queryClient.invalidateQueries({ queryKey: ['routes'] });
            setEditingRoute(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRoute && (
        <RouteDeleteModal 
          route={deletingRoute} 
          onClose={handleCloseDelete} 
          onConfirm={confirmDelete}
        />
      )}

      {/* Add Route Modal */}
      {showAddModal && (
        <AddRouteModal 
          onClose={handleCloseAddModal}
          copyFromRoute={copyFromRoute || undefined}
          onSave={(newRoute) => {
            queryClient.invalidateQueries({ queryKey: ['routes'] });
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

// Route View Modal Component
interface RouteViewModalProps {
  route: Route;
  onClose: () => void;
}

const RouteViewModal: React.FC<RouteViewModalProps> = ({ route, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Route Details #{route.id}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <RouteDetails 
            route={route} 
            showDistance={false} 
            compact={false} 
          />
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
              <p className="text-sm text-gray-900">{route.distance} miles</p>
            </div>
            {route.runTime && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Run Time</label>
                <p className="text-sm text-gray-900">{formatRunTime(route.runTime)}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                route.active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {route.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {route.standardRate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Standard Rate</label>
              <p className="text-sm text-gray-900 font-medium">${route.standardRate}</p>
            </div>
          )}

          {route.frequency && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <p className="text-sm text-gray-900">{route.frequency}</p>
            </div>
          )}
          
          {(route.departureTime || route.arrivalTime) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <div className="text-sm text-gray-900">
                {route.departureTime && (
                  <p><strong>Departure:</strong> {route.departureTime}</p>
                )}
                {route.arrivalTime && (
                  <p><strong>Arrival:</strong> {route.arrivalTime}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 pt-4 border-t">
            <div>
              <label className="block font-medium mb-1">Created</label>
              <p>{new Date(route.createdAt).toLocaleDateString()} {new Date(route.createdAt).toLocaleTimeString()}</p>
            </div>
            <div>
              <label className="block font-medium mb-1">Last Updated</label>
              <p>{new Date(route.updatedAt).toLocaleDateString()} {new Date(route.updatedAt).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6 pt-4 border-t">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Route Edit Modal Component
interface RouteEditModalProps {
  route: Route;
  onClose: () => void;
  onSave: (updatedRoute: Route) => void;
}

const RouteEditModal: React.FC<RouteEditModalProps> = ({ route, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: route.name,
    origin: route.origin,
    destination: route.destination,
    originAddress: route.originAddress || '',
    originCity: route.originCity || '',
    originState: route.originState || '',
    originZipCode: route.originZipCode || '',
    originContact: route.originContact || '',
    destinationAddress: route.destinationAddress || '',
    destinationCity: route.destinationCity || '',
    destinationState: route.destinationState || '',
    destinationZipCode: route.destinationZipCode || '',
    destinationContact: route.destinationContact || '',
    distance: route.distance.toString(),
    runTime: route.runTime?.toString() || '',
    active: route.active,
    standardRate: route.standardRate?.toString() || '',
    frequency: route.frequency || '',
    departureTime: route.departureTime || '',
    arrivalTime: route.arrivalTime || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Auto-calculate arrival time when departure time or run time changes
  useEffect(() => {
    if (formData.departureTime && formData.runTime) {
      const runTimeNumber = parseInt(formData.runTime);
      const arrivalTime = calculateArrivalTime(formData.departureTime, runTimeNumber);
      if (arrivalTime && arrivalTime !== formData.arrivalTime) {
        setFormData(prev => ({ ...prev, arrivalTime }));
      }
    }
  }, [formData.departureTime, formData.runTime]);

  const handleCalculateDistance = async () => {
    setIsCalculating(true);
    try {
      const origin = {
        address: formData.originAddress,
        city: formData.originCity,
        state: formData.originState,
        zipCode: formData.originZipCode
      };

      const destination = {
        address: formData.destinationAddress,
        city: formData.destinationCity,
        state: formData.destinationState,
        zipCode: formData.destinationZipCode
      };

      const result = await calculateRoute(origin, destination);
      
      if (result.distance) {
        setFormData(prev => ({ 
          ...prev, 
          distance: result.distance!.toString()
        }));
      } else {
        alert('Could not calculate distance. Please ensure you have provided sufficient address information.');
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
      alert('Failed to calculate distance. Please enter manually.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCalculateRunTime = async () => {
    setIsCalculating(true);
    try {
      const origin = {
        address: formData.originAddress,
        city: formData.originCity,
        state: formData.originState,
        zipCode: formData.originZipCode
      };

      const destination = {
        address: formData.destinationAddress,
        city: formData.destinationCity,
        state: formData.destinationState,
        zipCode: formData.destinationZipCode
      };

      const result = await calculateRoute(origin, destination);
      
      if (result.duration) {
        setFormData(prev => ({ 
          ...prev, 
          runTime: result.duration!.toString()
        }));
      } else {
        alert('Could not calculate run time. Please ensure you have provided sufficient address information.');
      }
    } catch (error) {
      console.error('Run time calculation error:', error);
      alert('Failed to calculate run time. Please enter manually.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Clean empty strings to undefined
      const cleanValue = (val: string) => val?.trim() || undefined;
      
      // Format time to ensure HH:mm format (remove seconds if present)
      const formatTime = (timeStr: string) => {
        if (!timeStr || !timeStr.trim()) return undefined;
        // If time includes seconds (HH:mm:ss), remove them
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeStr;
      };
      
      const payload = {
        name: formData.name.trim(),
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        originAddress: cleanValue(formData.originAddress),
        originCity: cleanValue(formData.originCity),
        originState: cleanValue(formData.originState),
        originZipCode: cleanValue(formData.originZipCode),
        originContact: cleanValue(formData.originContact),
        destinationAddress: cleanValue(formData.destinationAddress),
        destinationCity: cleanValue(formData.destinationCity),
        destinationState: cleanValue(formData.destinationState),
        destinationZipCode: cleanValue(formData.destinationZipCode),
        destinationContact: cleanValue(formData.destinationContact),
        distance: parseFloat(formData.distance),
        runTime: formData.runTime && !isNaN(parseInt(formData.runTime)) ? parseInt(formData.runTime) : undefined,
        active: formData.active,
        standardRate: formData.standardRate && !isNaN(parseFloat(formData.standardRate)) ? parseFloat(formData.standardRate) : undefined,
        frequency: cleanValue(formData.frequency),
        departureTime: formatTime(formData.departureTime),
        arrivalTime: formatTime(formData.arrivalTime)
      };
      
      const response = await api.put(`/routes/${route.id}`, payload);
      onSave(response.data);
    } catch (error) {
      console.error('Error updating route:', error);
      // TODO: Add proper error handling similar to AddRouteModal
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit Route #{route.id}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
              <input
                type="text"
                required
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Origin Address Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Origin Details</label>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <input
                  type="text"
                  value={formData.originAddress}
                  onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originCity}
                  onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  value={formData.originState}
                  onChange={(e) => setFormData({ ...formData, originState: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="State"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originZipCode}
                  onChange={(e) => setFormData({ ...formData, originZipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zip Code"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originContact}
                  onChange={(e) => setFormData({ ...formData, originContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contact"
                />
              </div>
            </div>
          </div>

          {/* Destination Address Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination Details</label>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <input
                  type="text"
                  value={formData.destinationAddress}
                  onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationCity}
                  onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  value={formData.destinationState}
                  onChange={(e) => setFormData({ ...formData, destinationState: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="State"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationZipCode}
                  onChange={(e) => setFormData({ ...formData, destinationZipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zip Code"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationContact}
                  onChange={(e) => setFormData({ ...formData, destinationContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contact"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleCalculateDistance}
                  disabled={isCalculating || !hasAddressInfo({ 
                    address: formData.originAddress, city: formData.originCity, state: formData.originState, zipCode: formData.originZipCode 
                  }) || !hasAddressInfo({ 
                    address: formData.destinationAddress, city: formData.destinationCity, state: formData.destinationState, zipCode: formData.destinationZipCode 
                  })}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title="Calculate distance using addresses"
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run Time (minutes)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={formData.runTime}
                  onChange={(e) => setFormData({ ...formData, runTime: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional"
                />
                <button
                  type="button"
                  onClick={handleCalculateRunTime}
                  disabled={isCalculating || !hasAddressInfo({ 
                    address: formData.originAddress, city: formData.originCity, state: formData.originState, zipCode: formData.originZipCode 
                  }) || !hasAddressInfo({ 
                    address: formData.destinationAddress, city: formData.destinationCity, state: formData.destinationState, zipCode: formData.destinationZipCode 
                  })}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title="Calculate run time using addresses"
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standard Rate ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.standardRate}
              onChange={(e) => setFormData({ ...formData, standardRate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <input
              type="text"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Daily, Weekly, etc."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
              <input
                type="time"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
              <input
                type="time"
                value={formData.arrivalTime}
                onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Active Route</span>
            </label>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Route Delete Modal Component
interface RouteDeleteModalProps {
  route: Route;
  onClose: () => void;
  onConfirm: () => void;
}

const RouteDeleteModal: React.FC<RouteDeleteModalProps> = ({ route, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Delete Route</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">
            Are you sure you want to delete this route?
          </p>
          <div className="bg-gray-50 p-3 rounded">
            <p className="font-medium text-gray-900">{route.name}</p>
            <p className="text-sm text-gray-600">{route.origin} → {route.destination}</p>
          </div>
          <p className="text-sm text-red-600 mt-2">
            This action cannot be undone.
          </p>
        </div>
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete Route
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Route Modal Component
interface AddRouteModalProps {
  onClose: () => void;
  onSave: (route: Route) => void;
  copyFromRoute?: Route;
}

const AddRouteModal: React.FC<AddRouteModalProps> = ({ onClose, onSave, copyFromRoute }) => {
  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await api.get('/routes?limit=1500');
      return response.data;
    }
  });
  
  const allRoutes = routesData?.routes || [];
  const [formData, setFormData] = useState({
    name: copyFromRoute ? `${copyFromRoute.name}_copy` : '',
    origin: copyFromRoute?.origin || '',
    destination: copyFromRoute?.destination || '',
    originAddress: copyFromRoute?.originAddress || '',
    originCity: copyFromRoute?.originCity || '',
    originState: copyFromRoute?.originState || '',
    originZipCode: copyFromRoute?.originZipCode || '',
    originContact: copyFromRoute?.originContact || '',
    originTimeZone: copyFromRoute?.originTimeZone || '',
    originLatitude: copyFromRoute?.originLatitude?.toString() || '',
    originLongitude: copyFromRoute?.originLongitude?.toString() || '',
    destinationAddress: copyFromRoute?.destinationAddress || '',
    destinationCity: copyFromRoute?.destinationCity || '',
    destinationState: copyFromRoute?.destinationState || '',
    destinationZipCode: copyFromRoute?.destinationZipCode || '',
    destinationContact: copyFromRoute?.destinationContact || '',
    destinationTimeZone: copyFromRoute?.destinationTimeZone || '',
    destinationLatitude: copyFromRoute?.destinationLatitude?.toString() || '',
    destinationLongitude: copyFromRoute?.destinationLongitude?.toString() || '',
    distance: copyFromRoute ? copyFromRoute.distance.toString() : '',
    runTime: copyFromRoute ? (copyFromRoute.runTime?.toString() || '') : '',
    active: copyFromRoute?.active ?? true,
    standardRate: copyFromRoute ? (copyFromRoute.standardRate?.toString() || '') : '',
    frequency: copyFromRoute?.frequency || '',
    departureTime: copyFromRoute?.departureTime || '',
    arrivalTime: copyFromRoute?.arrivalTime || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showRouteSelector, setShowRouteSelector] = useState(false);
  const [routeSearchInput, setRouteSearchInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleCopyFromRoute = (route: Route) => {
    setFormData({
      name: `${route.name}_copy`,
      origin: route.origin || '',
      destination: route.destination || '',
      originAddress: route.originAddress || '',
      originCity: route.originCity || '',
      originState: route.originState || '',
      originZipCode: route.originZipCode || '',
      originContact: route.originContact || '',
      originTimeZone: route.originTimeZone || '',
      originLatitude: route.originLatitude?.toString() || '',
      originLongitude: route.originLongitude?.toString() || '',
      destinationAddress: route.destinationAddress || '',
      destinationCity: route.destinationCity || '',
      destinationState: route.destinationState || '',
      destinationZipCode: route.destinationZipCode || '',
      destinationContact: route.destinationContact || '',
      destinationTimeZone: route.destinationTimeZone || '',
      destinationLatitude: route.destinationLatitude?.toString() || '',
      destinationLongitude: route.destinationLongitude?.toString() || '',
      distance: route.distance.toString(),
      runTime: route.runTime?.toString() || '',
      active: route.active,
      standardRate: route.standardRate?.toString() || '',
      frequency: route.frequency || '',
      departureTime: route.departureTime || '',
      arrivalTime: route.arrivalTime || ''
    });
    setShowRouteSelector(false);
    setRouteSearchInput('');
  };
  
  const filteredRoutes = allRoutes.filter((route: Route) => {
    if (!routeSearchInput) return true;
    const searchLower = routeSearchInput.toLowerCase();
    return route.name.toLowerCase().includes(searchLower) ||
           route.origin.toLowerCase().includes(searchLower) ||
           route.destination.toLowerCase().includes(searchLower);
  });

  // Auto-calculate arrival time when departure time or run time changes
  useEffect(() => {
    if (formData.departureTime && formData.runTime) {
      const arrivalTime = calculateArrivalTime(formData.departureTime, parseInt(formData.runTime));
      if (arrivalTime && arrivalTime !== formData.arrivalTime) {
        setFormData(prev => ({ ...prev, arrivalTime }));
      }
    }
  }, [formData.departureTime, formData.runTime]);

  // Calculate distance using addresses
  const handleCalculateDistance = async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    try {
      const origin = {
        address: formData.originAddress,
        city: formData.originCity,
        state: formData.originState,
        zipCode: formData.originZipCode
      };

      const destination = {
        address: formData.destinationAddress,
        city: formData.destinationCity,
        state: formData.destinationState,
        zipCode: formData.destinationZipCode
      };

      const result = await calculateRoute(origin, destination);
      
      if (result.distance) {
        setFormData(prev => ({ 
          ...prev, 
          distance: result.distance!.toString(),
          runTime: result.duration ? result.duration.toString() : prev.runTime
        }));
      } else {
        alert('Could not calculate distance. Please ensure you have provided sufficient address information.');
      }
    } catch (error) {
      console.error('Distance calculation error:', error);
      alert('Failed to calculate distance. Please enter manually.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Calculate run time using addresses
  const handleCalculateRunTime = async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    try {
      const origin = {
        address: formData.originAddress,
        city: formData.originCity,
        state: formData.originState,
        zipCode: formData.originZipCode
      };

      const destination = {
        address: formData.destinationAddress,
        city: formData.destinationCity,
        state: formData.destinationState,
        zipCode: formData.destinationZipCode
      };

      const result = await calculateRoute(origin, destination);
      
      if (result.duration) {
        setFormData(prev => ({ 
          ...prev, 
          runTime: result.duration!.toString()
        }));
      } else {
        alert('Could not calculate run time. Please ensure you have provided sufficient address information.');
      }
    } catch (error) {
      console.error('Run time calculation error:', error);
      alert('Failed to calculate run time. Please enter manually.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      // Validate required fields
      if (!formData.distance || isNaN(parseFloat(formData.distance))) {
        setErrorMessage('Please enter a valid distance');
        setIsSubmitting(false);
        return;
      }
      
      // Clean empty strings to undefined
      const cleanValue = (val: string) => val?.trim() || undefined;
      
      // Format time to ensure HH:mm format (remove seconds if present)
      const formatTime = (timeStr: string) => {
        if (!timeStr || !timeStr.trim()) return undefined;
        // If time includes seconds (HH:mm:ss), remove them
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          return `${timeParts[0]}:${timeParts[1]}`;
        }
        return timeStr;
      };
      
      const payload = {
        name: formData.name.trim(),
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        originAddress: cleanValue(formData.originAddress),
        originCity: cleanValue(formData.originCity),
        originState: cleanValue(formData.originState),
        originZipCode: cleanValue(formData.originZipCode),
        originContact: cleanValue(formData.originContact),
        destinationAddress: cleanValue(formData.destinationAddress),
        destinationCity: cleanValue(formData.destinationCity),
        destinationState: cleanValue(formData.destinationState),
        destinationZipCode: cleanValue(formData.destinationZipCode),
        destinationContact: cleanValue(formData.destinationContact),
        distance: parseFloat(formData.distance),
        runTime: formData.runTime && !isNaN(parseInt(formData.runTime)) ? parseInt(formData.runTime) : undefined,
        active: formData.active,
        standardRate: formData.standardRate && !isNaN(parseFloat(formData.standardRate)) ? parseFloat(formData.standardRate) : undefined,
        frequency: cleanValue(formData.frequency),
        departureTime: formatTime(formData.departureTime),
        arrivalTime: formatTime(formData.arrivalTime)
      };
      
      console.log('Submitting route payload:', payload);
      const response = await api.post('/routes', payload);
      onSave(response.data);
    } catch (error: any) {
      console.error('Error creating route:', error);
      
      // Show detailed error message
      if (error.response?.data?.errors) {
        // Handle validation errors
        const errorMessages = error.response.data.errors.map((err: any) => {
          const field = err.path || err.param;
          const message = err.msg;
          return `${field}: ${message}`;
        }).join(', ');
        setErrorMessage(`Validation errors: ${errorMessages}`);
      } else if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else if (error.response?.status === 401) {
        setErrorMessage('You are not authenticated. Please log in again.');
      } else if (error.response?.status === 403) {
        setErrorMessage('You do not have permission to create routes. Only Admins and Dispatchers can create routes.');
      } else {
        setErrorMessage('Failed to create route. Please check your input and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {copyFromRoute ? `Copy Route: ${copyFromRoute.name}` : 'Add New Route'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {copyFromRoute && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Copying from route: <strong>{copyFromRoute.name}</strong> ({copyFromRoute.origin} → {copyFromRoute.destination})
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Modify the information below to create your new route.
            </p>
          </div>
        )}
        
        {!copyFromRoute && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-gray-700">Copy from existing route (optional)</label>
              <button
                type="button"
                onClick={() => setShowRouteSelector(!showRouteSelector)}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {showRouteSelector ? 'Hide' : 'Select Route to Copy'}
              </button>
            </div>
            
            {showRouteSelector && (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search routes by name, origin, or destination..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={routeSearchInput}
                    onChange={(e) => setRouteSearchInput(e.target.value)}
                  />
                </div>
                
                {routeSearchInput && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredRoutes.length > 0 ? (
                      filteredRoutes.slice(0, 10).map((route: Route) => (
                        <button
                          key={route.id}
                          type="button"
                          onClick={() => handleCopyFromRoute(route)}
                          className="w-full text-left p-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{route.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <LocationWithTooltip 
                              location={route.origin}
                              address={route.originAddress}
                              city={route.originCity}
                              state={route.originState}
                              zipCode={route.originZipCode}
                              contact={route.originContact}
                            /> → <LocationWithTooltip 
                              location={route.destination}
                              address={route.destinationAddress}
                              city={route.destinationCity}
                              state={route.destinationState}
                              zipCode={route.destinationZipCode}
                              contact={route.destinationContact}
                            /> • {route.distance} miles
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-gray-500 text-sm">
                        No routes found matching "{routeSearchInput}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., NYCLAX1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin *</label>
              <input
                type="text"
                required
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., NYC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., LAX"
              />
            </div>
          </div>
          
          {/* Origin Address Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Origin Details</label>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <input
                  type="text"
                  value={formData.originAddress}
                  onChange={(e) => setFormData({ ...formData, originAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originCity}
                  onChange={(e) => setFormData({ ...formData, originCity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  value={formData.originState}
                  onChange={(e) => setFormData({ ...formData, originState: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="State"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originZipCode}
                  onChange={(e) => setFormData({ ...formData, originZipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zip Code"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.originContact}
                  onChange={(e) => setFormData({ ...formData, originContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contact"
                />
              </div>
            </div>
          </div>

          {/* Destination Address Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destination Details</label>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div>
                <input
                  type="text"
                  value={formData.destinationAddress}
                  onChange={(e) => setFormData({ ...formData, destinationAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationCity}
                  onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  value={formData.destinationState}
                  onChange={(e) => setFormData({ ...formData, destinationState: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="State"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationZipCode}
                  onChange={(e) => setFormData({ ...formData, destinationZipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Zip Code"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={formData.destinationContact}
                  onChange={(e) => setFormData({ ...formData, destinationContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contact"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  required
                  value={formData.distance}
                  onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2445.5"
                />
                <button
                  type="button"
                  onClick={handleCalculateDistance}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600"
                  title="Calculate distance using addresses"
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run Time (hours)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={formData.runTime ? (parseInt(formData.runTime) / 60).toFixed(1) : ''}
                  onChange={(e) => setFormData({ ...formData, runTime: e.target.value ? Math.round(parseFloat(e.target.value) * 60).toString() : '' })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="8.5"
                />
                <button
                  type="button"
                  onClick={handleCalculateRunTime}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-600"
                  title="Calculate run time using addresses"
                >
                  <Calculator className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Standard Rate ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.standardRate}
              onChange={(e) => setFormData({ ...formData, standardRate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Optional standard rate"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
            <input
              type="text"
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Daily, Weekly, etc."
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
              <input
                type="time"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
              <input
                type="time"
                value={formData.arrivalTime}
                onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Active Route</span>
            </label>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};