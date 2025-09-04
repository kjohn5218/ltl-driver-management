import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Phone, Mail } from 'lucide-react';

export const Carriers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: carriers, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await api.get('/carriers');
      return response.data.carriers as Carrier[];
    }
  });

  const filteredCarriers = carriers?.filter(carrier =>
    carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === '' || carrier.status === statusFilter)
  ) || [];

  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carriers</h1>
          <p className="text-gray-600">Manage your carrier network</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Carrier
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search carriers..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {/* Carriers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {filteredCarriers.map((carrier) => (
          <div key={carrier.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{carrier.name}</h3>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(carrier.status)}`}>
                  {carrier.status}
                </span>
              </div>
              <div className="flex gap-1">
                <button className="p-1 text-gray-500 hover:text-blue-600">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-500 hover:text-blue-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {carrier.contactPerson && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{carrier.contactPerson}</span>
                </div>
              )}
              {carrier.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>{carrier.phone}</span>
                </div>
              )}
              {carrier.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{carrier.email}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">MC #:</span>
                <span className="font-medium">{carrier.mcNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">DOT #:</span>
                <span className="font-medium">{carrier.dotNumber || 'N/A'}</span>
              </div>
              {carrier.rating && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Rating:</span>
                  <span className="font-medium">{carrier.rating}/5</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredCarriers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No carriers found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};