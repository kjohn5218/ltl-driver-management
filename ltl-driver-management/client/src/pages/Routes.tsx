import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Route } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Clock, DollarSign, Filter } from 'lucide-react';

export const Routes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

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
        <button className="btn-primary flex items-center gap-2">
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
                    <span className="font-medium">{route.origin}</span> → <span className="font-medium">{route.destination}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-medium">{route.miles}</span> miles
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
                    <button className="text-gray-500 hover:text-blue-600" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="text-gray-500 hover:text-blue-600" title="Edit Route">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="text-gray-500 hover:text-red-600" title="Delete Route">
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
    </div>
  );
};