import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Route } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Clock, DollarSign, Filter, X } from 'lucide-react';

// Location tooltip component
interface LocationWithTooltipProps {
  location: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  contact?: string;
}

const LocationWithTooltip: React.FC<LocationWithTooltipProps> = ({ 
  location, address, city, state, zipCode, contact 
}) => {
  const hasDetails = address || city || state || zipCode || contact;
  
  if (!hasDetails) {
    return <span className="font-medium">{location}</span>;
  }

  return (
    <div className="relative group inline-block">
      <span className="font-medium cursor-help border-b border-dotted border-gray-400">
        {location}
      </span>
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-lg">
        <div className="space-y-1">
          <div className="font-medium">{location}</div>
          {address && <div>{address}</div>}
          {(city || state || zipCode) && (
            <div>
              {city}{city && (state || zipCode) ? ', ' : ''}
              {state} {zipCode}
            </div>
          )}
          {contact && <div className="pt-1 border-t border-gray-700">Contact: {contact}</div>}
        </div>
        <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export const Routes: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [viewingRoute, setViewingRoute] = useState<Route | null>(null);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
            <p className="text-lg font-semibold text-gray-900">{route.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
              <p className="text-sm text-gray-900">{route.origin}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <p className="text-sm text-gray-900">{route.destination}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
              <p className="text-sm text-gray-900">{route.distance} miles</p>
            </div>
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
          
          {route._count && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statistics</label>
              <div className="text-sm text-gray-900 space-y-1">
                <p><strong>Total Bookings:</strong> {route._count.bookings}</p>
                <p><strong>Preferred by Carriers:</strong> {route._count.preferredBy}</p>
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
    distance: route.distance,
    active: route.active,
    standardRate: route.standardRate || '',
    frequency: route.frequency || '',
    departureTime: route.departureTime || '',
    arrivalTime: route.arrivalTime || ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await api.put(`/routes/${route.id}`, formData);
      onSave(response.data);
    } catch (error) {
      console.error('Error updating route:', error);
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
              <input
                type="text"
                required
                value={formData.origin}
                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
              <input
                type="text"
                required
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
              <input
                type="number"
                step="0.1"
                required
                value={formData.distance}
                onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
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
}

const AddRouteModal: React.FC<AddRouteModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    origin: '',
    destination: '',
    originAddress: '',
    originCity: '',
    originState: '',
    originZipCode: '',
    originContact: '',
    destinationAddress: '',
    destinationCity: '',
    destinationState: '',
    destinationZipCode: '',
    destinationContact: '',
    distance: '',
    active: true,
    standardRate: '',
    frequency: '',
    departureTime: '',
    arrivalTime: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: formData.name,
        origin: formData.origin,
        destination: formData.destination,
        originAddress: formData.originAddress || undefined,
        originCity: formData.originCity || undefined,
        originState: formData.originState || undefined,
        originZipCode: formData.originZipCode || undefined,
        originContact: formData.originContact || undefined,
        destinationAddress: formData.destinationAddress || undefined,
        destinationCity: formData.destinationCity || undefined,
        destinationState: formData.destinationState || undefined,
        destinationZipCode: formData.destinationZipCode || undefined,
        destinationContact: formData.destinationContact || undefined,
        distance: parseFloat(formData.distance),
        active: formData.active,
        standardRate: formData.standardRate ? parseFloat(formData.standardRate) : undefined,
        frequency: formData.frequency || undefined,
        departureTime: formData.departureTime || undefined,
        arrivalTime: formData.arrivalTime || undefined
      };
      
      const response = await api.post('/routes', payload);
      onSave(response.data);
    } catch (error) {
      console.error('Error creating route:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Route</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles) *</label>
            <input
              type="number"
              step="0.1"
              required
              value={formData.distance}
              onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="2445.5"
            />
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