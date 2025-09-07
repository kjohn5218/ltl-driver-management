import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier } from '../types';
import { Plus, Search, Edit, Eye, Trash2, MapPin, Phone, Mail, ExternalLink, X } from 'lucide-react';

export const Carriers: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [viewingCarrier, setViewingCarrier] = useState<Carrier | null>(null);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [deletingCarrier, setDeletingCarrier] = useState<Carrier | null>(null);
  const [showAddCarrierModal, setShowAddCarrierModal] = useState(false);

  const { data: carriersData, isLoading } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await api.get('/carriers?limit=5000'); // Fetch all carriers
      return response.data;
    }
  });

  const carriers = carriersData?.carriers || [];

  const filteredCarriers = carriers?.filter(carrier => {
    const matchesSearch = carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (carrier.mcNumber && carrier.mcNumber.includes(searchTerm)) ||
      (carrier.dotNumber && carrier.dotNumber.includes(searchTerm)) ||
      (carrier.city && carrier.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === '' || carrier.status === statusFilter;
    const matchesState = stateFilter === '' || carrier.state === stateFilter;
    
    return matchesSearch && matchesStatus && matchesState;
  }) || [];

  // Get unique states for filter
  const uniqueStates = [...new Set(carriers.filter(c => c.state).map(c => c.state))].sort();

  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      ONBOARDED: 'bg-blue-100 text-blue-800',
      NOT_ONBOARDED: 'bg-orange-100 text-orange-800'
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
        <button 
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowAddCarrierModal(true)}
        >
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
            placeholder="Search by name, MC#, DOT#, or city..."
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
          <option value="ONBOARDED">Onboarded</option>
          <option value="NOT_ONBOARDED">Not Onboarded</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">All States</option>
          {uniqueStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
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
                <button 
                  className="p-1 text-gray-500 hover:text-blue-600"
                  onClick={() => setViewingCarrier(carrier)}
                  title="View Details"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button 
                  className="p-1 text-gray-500 hover:text-blue-600"
                  onClick={() => setEditingCarrier(carrier)}
                  title="Edit Carrier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  className="p-1 text-gray-500 hover:text-red-600"
                  onClick={() => setDeletingCarrier(carrier)}
                  title="Delete Carrier"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              {(carrier.city || carrier.state) && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{carrier.city}{carrier.city && carrier.state && ', '}{carrier.state}</span>
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
                  <span className="truncate">{carrier.email}</span>
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
              {carrier.safetyRating && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Safety:</span>
                  <span className={`font-medium ${
                    carrier.safetyRating === 'Acceptable' ? 'text-green-600' : 
                    carrier.safetyRating === 'Unacceptable' ? 'text-red-600' : 
                    'text-yellow-600'
                  }`}>
                    {carrier.safetyRating}
                  </span>
                </div>
              )}
              {(carrier.mcNumber || carrier.dotNumber) && (
                <div className="mt-3">
                  <button
                    onClick={() => window.open('https://safer.fmcsa.dot.gov/CompanySnapshot.aspx', '_blank')}
                    className="w-full text-center text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View FMCSA Co.Snapshot
                  </button>
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

      {/* Carrier Details Modal */}
      {viewingCarrier && (
        <CarrierDetailsModal 
          carrier={viewingCarrier}
          onClose={() => setViewingCarrier(null)}
        />
      )}

      {/* Carrier Edit Modal */}
      {editingCarrier && (
        <CarrierEditModal
          carrier={editingCarrier}
          onClose={() => setEditingCarrier(null)}
          onSave={(_updatedCarrier) => {
            queryClient.invalidateQueries({ queryKey: ['carriers'] });
            setEditingCarrier(null);
          }}
        />
      )}

      {/* Carrier Delete Modal */}
      {deletingCarrier && (
        <CarrierDeleteModal
          carrier={deletingCarrier}
          onClose={() => setDeletingCarrier(null)}
          onDelete={() => {
            queryClient.invalidateQueries({ queryKey: ['carriers'] });
            setDeletingCarrier(null);
          }}
        />
      )}

      {/* Add Carrier Modal */}
      {showAddCarrierModal && (
        <AddCarrierModal
          onClose={() => setShowAddCarrierModal(false)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['carriers'] });
            setShowAddCarrierModal(false);
          }}
        />
      )}
    </div>
  );
};

// Add Carrier Modal Component
interface AddCarrierModalProps {
  onClose: () => void;
  onSave: () => void;
}

const AddCarrierModal: React.FC<AddCarrierModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    mcNumber: '',
    dotNumber: '',
    streetAddress1: '',
    streetAddress2: '',
    city: '',
    state: '',
    zipCode: '',
    status: 'PENDING',
    carrierType: '',
    safetyRating: '',
    taxId: '',
    ratePerMile: '',
    rating: '',
    remittanceContact: '',
    remittanceEmail: '',
    factoringCompany: '',
    onboardingComplete: false,
    insuranceExpiration: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Create carrier mutation
  const createCarrierMutation = useMutation({
    mutationFn: async (carrierData: any) => {
      const response = await api.post('/carriers', carrierData);
      return response.data;
    },
    onSuccess: () => {
      setErrors([]);
      onSave();
    },
    onError: (error: any) => {
      console.error('Error creating carrier:', error);
      
      // Extract validation errors from server response
      let errorMessages = ['Failed to create carrier. Please try again.'];
      
      if (error.response?.data?.message) {
        errorMessages = [error.response.data.message];
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errorMessages = error.response.data.errors.map((err: any) => 
          `${err.path || err.param}: ${err.msg}`
        );
      }
      
      setErrors(errorMessages);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    
    // Client-side validation
    const validationErrors: string[] = [];
    
    if (!formData.name.trim()) {
      validationErrors.push('Carrier name is required');
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (formData.ratePerMile && (isNaN(parseFloat(formData.ratePerMile)) || parseFloat(formData.ratePerMile) < 0)) {
      validationErrors.push('Rate per mile must be a valid positive number');
    }
    
    if (formData.rating && (isNaN(parseFloat(formData.rating)) || parseFloat(formData.rating) < 0 || parseFloat(formData.rating) > 5)) {
      validationErrors.push('Rating must be a number between 0 and 5');
    }
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        mcNumber: formData.mcNumber || undefined,
        dotNumber: formData.dotNumber || undefined,
        streetAddress1: formData.streetAddress1 || undefined,
        streetAddress2: formData.streetAddress2 || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zipCode: formData.zipCode || undefined,
        status: formData.status,
        carrierType: formData.carrierType || undefined,
        safetyRating: formData.safetyRating || undefined,
        taxId: formData.taxId || undefined,
        ratePerMile: formData.ratePerMile ? parseFloat(formData.ratePerMile) : undefined,
        rating: formData.rating ? parseFloat(formData.rating) : undefined,
        remittanceContact: formData.remittanceContact || undefined,
        remittanceEmail: formData.remittanceEmail || undefined,
        factoringCompany: formData.factoringCompany || undefined,
        onboardingComplete: formData.onboardingComplete,
        insuranceExpiration: formData.insuranceExpiration || undefined
      };
      
      await createCarrierMutation.mutateAsync(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Carrier</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Error Display */}
        {errors.length > 0 && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Please correct the following errors:
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 1</label>
                <input
                  type="text"
                  value={formData.streetAddress1}
                  onChange={(e) => setFormData({ ...formData, streetAddress1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 2</label>
                <input
                  type="text"
                  value={formData.streetAddress2}
                  onChange={(e) => setFormData({ ...formData, streetAddress2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Regulatory Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Regulatory Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
                <input
                  type="text"
                  value={formData.mcNumber}
                  onChange={(e) => setFormData({ ...formData, mcNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
                <input
                  type="text"
                  value={formData.dotNumber}
                  onChange={(e) => setFormData({ ...formData, dotNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safety Rating</label>
                <select
                  value={formData.safetyRating}
                  onChange={(e) => setFormData({ ...formData, safetyRating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Rating</option>
                  <option value="Acceptable">Acceptable</option>
                  <option value="Conditional">Conditional</option>
                  <option value="Unacceptable">Unacceptable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiration</label>
                <input
                  type="date"
                  value={formData.insuranceExpiration}
                  onChange={(e) => setFormData({ ...formData, insuranceExpiration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Status and Type */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Status and Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="ONBOARDED">Onboarded</option>
                  <option value="NOT_ONBOARDED">Not Onboarded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Type</label>
                <input
                  type="text"
                  value={formData.carrierType}
                  onChange={(e) => setFormData({ ...formData, carrierType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.onboardingComplete}
                    onChange={(e) => setFormData({ ...formData, onboardingComplete: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Onboarding Complete</span>
                </label>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Mile</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ratePerMile}
                  onChange={(e) => setFormData({ ...formData, ratePerMile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company</label>
                <input
                  type="text"
                  value={formData.factoringCompany}
                  onChange={(e) => setFormData({ ...formData, factoringCompany: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Remittance Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Remittance Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Contact</label>
                <input
                  type="text"
                  value={formData.remittanceContact}
                  onChange={(e) => setFormData({ ...formData, remittanceContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Email</label>
                <input
                  type="email"
                  value={formData.remittanceEmail}
                  onChange={(e) => setFormData({ ...formData, remittanceEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Carrier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Carrier Details Modal Component
interface CarrierDetailsModalProps {
  carrier: Carrier;
  onClose: () => void;
}

const CarrierDetailsModal: React.FC<CarrierDetailsModalProps> = ({ carrier, onClose }) => {
  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      ONBOARDED: 'bg-blue-100 text-blue-800',
      NOT_ONBOARDED: 'bg-orange-100 text-orange-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Carrier Details - {carrier.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name</label>
              <p className="text-sm text-gray-900">{carrier.name}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(carrier.status)}`}>
                {carrier.status}
              </span>
            </div>

            {carrier.contactPerson && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <p className="text-sm text-gray-900">{carrier.contactPerson}</p>
              </div>
            )}

            {carrier.phone && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <p className="text-sm text-gray-900">{carrier.phone}</p>
              </div>
            )}

            {carrier.email && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-sm text-gray-900">{carrier.email}</p>
              </div>
            )}
          </div>

          {/* Address & Details */}
          <div className="space-y-4">
            {(carrier.streetAddress1 || carrier.city || carrier.state || carrier.zipCode) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="text-sm text-gray-900 space-y-1">
                  {carrier.streetAddress1 && <p>{carrier.streetAddress1}</p>}
                  {carrier.streetAddress2 && <p>{carrier.streetAddress2}</p>}
                  {(carrier.city || carrier.state || carrier.zipCode) && (
                    <p>
                      {carrier.city}{carrier.city && (carrier.state || carrier.zipCode) ? ', ' : ''}
                      {carrier.state} {carrier.zipCode}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
                <p className="text-sm text-gray-900">{carrier.mcNumber || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
                <p className="text-sm text-gray-900">{carrier.dotNumber || 'N/A'}</p>
              </div>
            </div>

            {carrier.safetyRating && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safety Rating</label>
                <p className={`text-sm font-medium ${
                  carrier.safetyRating === 'Acceptable' ? 'text-green-600' : 
                  carrier.safetyRating === 'Unacceptable' ? 'text-red-600' : 
                  'text-yellow-600'
                }`}>
                  {carrier.safetyRating}
                </p>
              </div>
            )}

            {carrier.carrierType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Type</label>
                <p className="text-sm text-gray-900">{carrier.carrierType}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Information */}
        {(carrier.ratePerMile || carrier.rating || carrier.taxId || carrier.factoringCompany) && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {carrier.ratePerMile && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Mile</label>
                  <p className="text-sm text-gray-900">${carrier.ratePerMile}</p>
                </div>
              )}
              {carrier.rating && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                  <p className="text-sm text-gray-900">{carrier.rating}</p>
                </div>
              )}
              {carrier.taxId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                  <p className="text-sm text-gray-900">{carrier.taxId}</p>
                </div>
              )}
              {carrier.factoringCompany && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company</label>
                  <p className="text-sm text-gray-900">{carrier.factoringCompany}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remittance Information */}
        {(carrier.remittanceContact || carrier.remittanceEmail) && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Remittance Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {carrier.remittanceContact && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Contact</label>
                  <p className="text-sm text-gray-900">{carrier.remittanceContact}</p>
                </div>
              )}
              {carrier.remittanceEmail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Email</label>
                  <p className="text-sm text-gray-900">{carrier.remittanceEmail}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onboarding Complete</label>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                carrier.onboardingComplete 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {carrier.onboardingComplete ? 'Yes' : 'No'}
              </span>
            </div>
            {carrier.insuranceExpiration && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiration</label>
                <p className="text-sm text-gray-900">
                  {new Date(carrier.insuranceExpiration).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <label className="block font-medium mb-1">Created</label>
              <p>{new Date(carrier.createdAt).toLocaleDateString()} {new Date(carrier.createdAt).toLocaleTimeString()}</p>
            </div>
            <div>
              <label className="block font-medium mb-1">Last Updated</label>
              <p>{new Date(carrier.updatedAt).toLocaleDateString()} {new Date(carrier.updatedAt).toLocaleTimeString()}</p>
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

// Carrier Edit Modal Component
interface CarrierEditModalProps {
  carrier: Carrier;
  onClose: () => void;
  onSave: (updatedCarrier: Carrier) => void;
}

const CarrierEditModal: React.FC<CarrierEditModalProps> = ({ carrier, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: carrier.name,
    contactPerson: carrier.contactPerson || '',
    phone: carrier.phone || '',
    email: carrier.email || '',
    mcNumber: carrier.mcNumber || '',
    dotNumber: carrier.dotNumber || '',
    streetAddress1: carrier.streetAddress1 || '',
    streetAddress2: carrier.streetAddress2 || '',
    city: carrier.city || '',
    state: carrier.state || '',
    zipCode: carrier.zipCode || '',
    // Map invalid status values to valid ones for server compatibility
    status: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(carrier.status) 
      ? carrier.status 
      : carrier.status === 'ONBOARDED' ? 'ACTIVE' : 'PENDING',
    carrierType: carrier.carrierType || '',
    safetyRating: carrier.safetyRating || '',
    taxId: carrier.taxId || '',
    ratePerMile: carrier.ratePerMile?.toString() || '',
    rating: carrier.rating?.toString() || '',
    remittanceContact: carrier.remittanceContact || '',
    remittanceEmail: carrier.remittanceEmail || '',
    factoringCompany: carrier.factoringCompany || '',
    onboardingComplete: carrier.onboardingComplete,
    insuranceExpiration: carrier.insuranceExpiration ? new Date(carrier.insuranceExpiration).toISOString().split('T')[0] : ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Build payload with proper validation for server
      const payload: any = {};
      
      // Only include fields that have values to avoid validation issues
      if (formData.name.trim()) payload.name = formData.name.trim();
      if (formData.contactPerson.trim()) payload.contactPerson = formData.contactPerson.trim();
      if (formData.phone.trim()) payload.phone = formData.phone.trim();
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.mcNumber.trim()) payload.mcNumber = formData.mcNumber.trim();
      if (formData.dotNumber.trim()) payload.dotNumber = formData.dotNumber.trim();
      if (formData.streetAddress1.trim()) payload.streetAddress1 = formData.streetAddress1.trim();
      if (formData.streetAddress2.trim()) payload.streetAddress2 = formData.streetAddress2.trim();
      if (formData.city.trim()) payload.city = formData.city.trim();
      if (formData.state.trim()) payload.state = formData.state.trim();
      if (formData.zipCode.trim()) payload.zipCode = formData.zipCode.trim();
      if (formData.carrierType.trim()) payload.carrierType = formData.carrierType.trim();
      if (formData.safetyRating.trim()) payload.safetyRating = formData.safetyRating.trim();
      if (formData.taxId.trim()) payload.taxId = formData.taxId.trim();
      if (formData.remittanceContact.trim()) payload.remittanceContact = formData.remittanceContact.trim();
      if (formData.remittanceEmail.trim()) payload.remittanceEmail = formData.remittanceEmail.trim();
      if (formData.factoringCompany.trim()) payload.factoringCompany = formData.factoringCompany.trim();
      if (formData.insuranceExpiration) payload.insuranceExpiration = formData.insuranceExpiration;
      
      // Handle numeric fields
      if (formData.ratePerMile && !isNaN(parseFloat(formData.ratePerMile))) {
        payload.ratePerMile = parseFloat(formData.ratePerMile);
      }
      if (formData.rating && !isNaN(parseFloat(formData.rating))) {
        payload.rating = parseFloat(formData.rating);
      }
      
      // Always include status and onboardingComplete
      payload.status = formData.status;
      payload.onboardingComplete = formData.onboardingComplete;
      
      const response = await api.put(`/carriers/${carrier.id}`, payload);
      onSave(response.data);
    } catch (error) {
      console.error('Error updating carrier:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to update carrier. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const validationErrors = error.response.data.errors
          .map((err: any) => `${err.path || err.param}: ${err.msg}`)
          .join('\n');
        errorMessage = 'Validation Errors:\n' + validationErrors;
      }
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit Carrier - {carrier.name}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 1</label>
                <input
                  type="text"
                  value={formData.streetAddress1}
                  onChange={(e) => setFormData({ ...formData, streetAddress1: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 2</label>
                <input
                  type="text"
                  value={formData.streetAddress2}
                  onChange={(e) => setFormData({ ...formData, streetAddress2: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Regulatory Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Regulatory Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
                <input
                  type="text"
                  value={formData.mcNumber}
                  onChange={(e) => setFormData({ ...formData, mcNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
                <input
                  type="text"
                  value={formData.dotNumber}
                  onChange={(e) => setFormData({ ...formData, dotNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safety Rating</label>
                <select
                  value={formData.safetyRating}
                  onChange={(e) => setFormData({ ...formData, safetyRating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Rating</option>
                  <option value="Acceptable">Acceptable</option>
                  <option value="Conditional">Conditional</option>
                  <option value="Unacceptable">Unacceptable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Expiration</label>
                <input
                  type="date"
                  value={formData.insuranceExpiration}
                  onChange={(e) => setFormData({ ...formData, insuranceExpiration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Status and Type */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Status and Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Type</label>
                <input
                  type="text"
                  value={formData.carrierType}
                  onChange={(e) => setFormData({ ...formData, carrierType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.onboardingComplete}
                    onChange={(e) => setFormData({ ...formData, onboardingComplete: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Onboarding Complete</span>
                </label>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Mile</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ratePerMile}
                  onChange={(e) => setFormData({ ...formData, ratePerMile: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company</label>
                <input
                  type="text"
                  value={formData.factoringCompany}
                  onChange={(e) => setFormData({ ...formData, factoringCompany: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Remittance Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Remittance Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Contact</label>
                <input
                  type="text"
                  value={formData.remittanceContact}
                  onChange={(e) => setFormData({ ...formData, remittanceContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Email</label>
                <input
                  type="email"
                  value={formData.remittanceEmail}
                  onChange={(e) => setFormData({ ...formData, remittanceEmail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
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

// Carrier Delete Modal Component
interface CarrierDeleteModalProps {
  carrier: Carrier;
  onClose: () => void;
  onDelete: () => void;
}

const CarrierDeleteModal: React.FC<CarrierDeleteModalProps> = ({ carrier, onClose, onDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/carriers/${carrier.id}`);
      onDelete();
    } catch (error) {
      console.error('Error deleting carrier:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Delete Carrier</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            Are you sure you want to delete the following carrier?
          </p>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="font-medium text-gray-900">{carrier.name}</p>
            <p className="text-sm text-gray-600">
              MC: {carrier.mcNumber || 'N/A'} | DOT: {carrier.dotNumber || 'N/A'}
            </p>
          </div>
          <p className="text-red-600 text-sm mt-2 font-medium">
            This action cannot be undone.
          </p>
        </div>
        
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Carrier'}
          </button>
        </div>
      </div>
    </div>
  );
};