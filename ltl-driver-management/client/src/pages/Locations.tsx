import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Location } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Clock, Filter, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { usePersistedFilters } from '../hooks/usePersistedFilters';

export const Locations: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters - persisted to localStorage
  const [filters, , updateFilter] = usePersistedFilters('locations-filters', {
    searchTerm: '',
    activeFilter: 'all',
    sortColumn: 'code',
    sortDirection: 'asc' as 'asc' | 'desc',
  });
  const { searchTerm, activeFilter, sortColumn, sortDirection } = filters;
  const setSearchTerm = (v: string) => updateFilter('searchTerm', v);
  const setActiveFilter = (v: string) => updateFilter('activeFilter', v);
  const setSortColumn = (v: string) => updateFilter('sortColumn', v);
  const setSortDirection = (v: 'asc' | 'desc') => updateFilter('sortDirection', v);

  const [viewingLocation, setViewingLocation] = useState<Location | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: locationsData, isLoading, error } = useQuery({
    queryKey: ['locations', searchTerm, activeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (activeFilter !== 'all') params.append('active', activeFilter === 'active' ? 'true' : 'false');
      params.append('limit', '200');
      
      const response = await api.get(`/locations?${params.toString()}`);
      return response.data;
    }
  });

  const locations = locationsData?.locations || [];

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedLocations = [...locations].sort((a, b) => {
    let aValue: string | boolean | null = null;
    let bValue: string | boolean | null = null;

    switch (sortColumn) {
      case 'code':
        aValue = a.code || '';
        bValue = b.code || '';
        break;
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'phone':
        aValue = a.phone || '';
        bValue = b.phone || '';
        break;
      case 'isPhysicalTerminal':
        aValue = a.isPhysicalTerminal;
        bValue = b.isPhysicalTerminal;
        break;
      case 'cityState':
        aValue = `${a.city || ''}, ${a.state || ''}`;
        bValue = `${b.city || ''}, ${b.state || ''}`;
        break;
      case 'timeZone':
        aValue = a.timeZone || '';
        bValue = b.timeZone || '';
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      if (aValue === bValue) return 0;
      if (sortDirection === 'asc') {
        return aValue ? -1 : 1;
      }
      return aValue ? 1 : -1;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-4 w-4 text-primary-600" />
      : <ChevronDown className="h-4 w-4 text-primary-600" />;
  };

  const handleViewLocation = (location: Location) => {
    setViewingLocation(location);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
  };

  const handleDeleteLocation = (location: Location) => {
    setDeletingLocation(location);
  };

  const handleCloseView = () => {
    setViewingLocation(null);
  };

  const handleCloseEdit = () => {
    setEditingLocation(null);
  };

  const handleCloseDelete = () => {
    setDeletingLocation(null);
  };

  const handleLocationSaved = (location: Location) => {
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    setEditingLocation(null);
    setShowAddModal(false);
  };

  const handleLocationDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    setDeletingLocation(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-red-600">Error loading locations: {error.message}</p>
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

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage origin and destination locations for route planning
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search locations by code, name, city, or state..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Locations</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Locations ({locations.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Code</span>
                    <SortIcon column="code" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Name</span>
                    <SortIcon column="name" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Phone Number</span>
                    <SortIcon column="phone" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('isPhysicalTerminal')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Physical Terminal</span>
                    <SortIcon column="isPhysicalTerminal" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cityState')}
                >
                  <div className="flex items-center space-x-1">
                    <span>City/State</span>
                    <SortIcon column="cityState" />
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('timeZone')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Time Zone</span>
                    <SortIcon column="timeZone" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedLocations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      location.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {location.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {location.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {location.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {location.isPhysicalTerminal ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Yes
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {location.city && location.state ? (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {location.city}, {location.state}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {location.timeZone ? (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {location.timeZone}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewLocation(location)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditLocation(location)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location)}
                        className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {locations.length === 0 && (
          <div className="px-4 py-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No locations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || activeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding a new location.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingLocation && (
        <LocationViewModal 
          location={viewingLocation} 
          onClose={handleCloseView} 
        />
      )}
      
      {(editingLocation || showAddModal) && (
        <LocationEditModal 
          location={editingLocation || undefined} 
          onClose={editingLocation ? handleCloseEdit : () => setShowAddModal(false)}
          onSave={handleLocationSaved}
        />
      )}
      
      {deletingLocation && (
        <LocationDeleteModal 
          location={deletingLocation} 
          onClose={handleCloseDelete}
          onDelete={handleLocationDeleted}
        />
      )}
    </div>
  );
};

// Location View Modal Component
interface LocationViewModalProps {
  location: Location;
  onClose: () => void;
}

const LocationViewModal: React.FC<LocationViewModalProps> = ({ location, onClose }) => {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Location Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Code</label>
            <p className="mt-1 text-sm text-gray-900">{location.code}</p>
          </div>
          
          {location.name && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{location.name}</p>
            </div>
          )}
          
          {location.address && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <p className="mt-1 text-sm text-gray-900">{location.address}</p>
            </div>
          )}
          
          {location.city && (
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 text-sm text-gray-900">{location.city}</p>
            </div>
          )}
          
          {location.state && (
            <div>
              <label className="block text-sm font-medium text-gray-700">State</label>
              <p className="mt-1 text-sm text-gray-900">{location.state}</p>
            </div>
          )}
          
          {location.zipCode && (
            <div>
              <label className="block text-sm font-medium text-gray-700">ZIP Code</label>
              <p className="mt-1 text-sm text-gray-900">{location.zipCode}</p>
            </div>
          )}
          
          {location.contact && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact</label>
              <p className="mt-1 text-sm text-gray-900">{location.contact}</p>
            </div>
          )}
          
          {location.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <p className="mt-1 text-sm text-gray-900">{location.phone}</p>
            </div>
          )}
          
          {location.hours && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Hours</label>
              <p className="mt-1 text-sm text-gray-900">{location.hours}</p>
            </div>
          )}
          
          {location.timeZone && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Time Zone</label>
              <p className="mt-1 text-sm text-gray-900">{location.timeZone}</p>
            </div>
          )}
          
          {location.notes && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{location.notes}</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              location.active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {location.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          {(location.latitude && location.longitude) && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">GPS Coordinates</label>
              <p className="mt-1 text-sm text-gray-900">
                {location.latitude}, {location.longitude}
              </p>
            </div>
          )}
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Location Edit Modal Component
interface LocationEditModalProps {
  location?: Location;
  onClose: () => void;
  onSave: (location: Location) => void;
}

const LocationEditModal: React.FC<LocationEditModalProps> = ({ location, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    code: location?.code || '',
    name: location?.name || '',
    address: location?.address || '',
    city: location?.city || '',
    state: location?.state || '',
    zipCode: location?.zipCode || '',
    contact: location?.contact || '',
    phone: location?.phone || '',
    hours: location?.hours || '',
    timeZone: location?.timeZone || '',
    latitude: location?.latitude?.toString() || '',
    longitude: location?.longitude?.toString() || '',
    notes: location?.notes || '',
    active: location?.active ?? true,
    isPhysicalTerminal: location?.isPhysicalTerminal ?? false,
    isVirtualTerminal: location?.isVirtualTerminal ?? false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const cleanValue = (value: string) => value.trim() || undefined;
      
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: cleanValue(formData.name),
        address: cleanValue(formData.address),
        city: cleanValue(formData.city),
        state: cleanValue(formData.state),
        zipCode: cleanValue(formData.zipCode),
        contact: cleanValue(formData.contact),
        phone: cleanValue(formData.phone),
        hours: cleanValue(formData.hours),
        timeZone: cleanValue(formData.timeZone),
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        notes: cleanValue(formData.notes),
        active: formData.active,
        isPhysicalTerminal: formData.isPhysicalTerminal,
        isVirtualTerminal: formData.isVirtualTerminal
      };

      const response = location
        ? await api.put(`/locations/${location.id}`, payload)
        : await api.post('/locations', payload);

      onSave(response.data);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save location');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {location ? 'Edit Location' : 'Add New Location'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location Code *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., LAX, PHX"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Full location name"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Street address"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="City"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="State"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="ZIP Code"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Contact person name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operating Hours
              </label>
              <input
                type="text"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="e.g., 06:00 - 18:00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Zone
              </label>
              <select
                value={formData.timeZone}
                onChange={(e) => setFormData({ ...formData, timeZone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Time Zone</option>
                <option value="PST">PST (Pacific)</option>
                <option value="MST">MST (Mountain)</option>
                <option value="CST">CST (Central)</option>
                <option value="AZST">AZST (Arizona)</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Latitude"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Longitude"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Additional notes about this location..."
            />
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPhysicalTerminal"
                checked={formData.isPhysicalTerminal}
                onChange={(e) => setFormData({ ...formData, isPhysicalTerminal: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isPhysicalTerminal" className="ml-2 block text-sm text-gray-900">
                Physical Terminal
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isVirtualTerminal"
                checked={formData.isVirtualTerminal}
                onChange={(e) => setFormData({ ...formData, isVirtualTerminal: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isVirtualTerminal" className="ml-2 block text-sm text-gray-900">
                Virtual Terminal
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (location ? 'Update Location' : 'Create Location')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Location Delete Modal Component
interface LocationDeleteModalProps {
  location: Location;
  onClose: () => void;
  onDelete: () => void;
}

const LocationDeleteModal: React.FC<LocationDeleteModalProps> = ({ location, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/locations/${location.id}`);
      onDelete();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete location');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
          Delete Location
        </h3>
        
        <p className="text-sm text-gray-500 text-center mb-6">
          Are you sure you want to delete location "{location.code}"? This action cannot be undone.
        </p>
        
        <div className="flex justify-center space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Location'}
          </button>
        </div>
      </div>
    </div>
  );
};