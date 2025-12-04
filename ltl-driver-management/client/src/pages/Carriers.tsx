import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { Carrier, CarrierStatus } from '../types';
import { Plus, Search, Edit, Trash2, ExternalLink, X, Send, FileText, Download, Bell, Upload, LayoutGrid, List, RefreshCw, Shield } from 'lucide-react';
import { CarrierCard } from '../components/carriers/CarrierCard';
import { CarrierList } from '../components/carriers/CarrierList';
import { MCPStatus } from '../components/carriers/mcp/MCPStatus';
import { carrierService } from '../services/carrierService';

interface CarrierAgreement {
  id: number;
  agreementVersion: string;
  agreementTitle: string;
  signedAt: string;
  signedBy: string;
  signedByTitle: string;
  ipAddress: string;
  userAgent?: string;
  geolocation?: string;
  username: string;
  affidavitPdfPath?: string;
  agreementPdfPath?: string;
  agreementHash?: string;
}

export const Carriers: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [viewingCarrier, setViewingCarrier] = useState<Carrier | null>(null);
  const [deletingCarrier, setDeletingCarrier] = useState<Carrier | null>(null);
  const [showAddCarrierModal, setShowAddCarrierModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBatchUpdateModal, setShowBatchUpdateModal] = useState(false);
  const [batchUpdateResult, setBatchUpdateResult] = useState<any>(null);
  const [showCompletedPacketsModal, setShowCompletedPacketsModal] = useState(false);
  const [completedPacketsResult, setCompletedPacketsResult] = useState<any>(null);
  const [isCheckingPackets, setIsCheckingPackets] = useState(false);

  // Fetch invitations data
  const { data: invitationsData } = useQuery({
    queryKey: ['carrier-invitations'],
    queryFn: async () => {
      const response = await api.get('/carriers/invitations?limit=10&status=PENDING');
      return response.data;
    }
  });

  const { data: carriersData, isLoading, error } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await api.get('/carriers?limit=5000'); // Fetch all carriers
      return response.data;
    },
    retry: 1
  });

  const carriers = carriersData?.carriers || [];

  // Count pending registrations
  const pendingRegistrations = carriers.filter((carrier: Carrier) => 
    carrier.status === 'PENDING' && !carrier.onboardingComplete
  ).length;

  // Sync monitored carriers function
  const syncMonitoredCarriers = async () => {
    setIsSyncing(true);
    try {
      const result = await carrierService.syncMonitoredCarriers();
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      alert(`Successfully synced ${result.carriers?.length || 0} monitored carriers from MyCarrierPackets`);
    } catch (error) {
      console.error('Failed to sync monitored carriers:', error);
      alert('Failed to sync monitored carriers. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Batch update carriers from MCP
  const batchUpdateCarriers = async () => {
    setIsSyncing(true);
    setBatchUpdateResult(null);
    setShowBatchUpdateModal(true);
    
    try {
      const result = await carrierService.batchUpdateCarriers();
      setBatchUpdateResult(result);
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
    } catch (error: any) {
      console.error('Batch update failed:', error);
      setBatchUpdateResult({
        success: false,
        error: error.response?.data?.message || 'Failed to batch update carriers'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check completed packets
  const checkCompletedPackets = async (sync: boolean = false) => {
    setIsCheckingPackets(true);
    setCompletedPacketsResult(null);
    setShowCompletedPacketsModal(true);
    
    try {
      const result = await carrierService.checkCompletedPackets({ sync });
      setCompletedPacketsResult(result);
      if (sync && result.success) {
        queryClient.invalidateQueries({ queryKey: ['carriers'] });
      }
    } catch (error: any) {
      console.error('Check completed packets failed:', error);
      setCompletedPacketsResult({
        success: false,
        error: error.response?.data?.message || 'Failed to check completed packets'
      });
    } finally {
      setIsCheckingPackets(false);
    }
  };

  const filteredCarriers = carriers?.filter((carrier: Carrier) => {
    const matchesSearch = carrier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (carrier.mcNumber && carrier.mcNumber.includes(searchTerm)) ||
      (carrier.dotNumber && carrier.dotNumber.includes(searchTerm)) ||
      (carrier.city && carrier.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === '' || carrier.status === statusFilter;
    const matchesState = stateFilter === '' || carrier.state === stateFilter;
    
    return matchesSearch && matchesStatus && matchesState;
  }) || [];

  // Get unique states for filter
  const uniqueStates: string[] = [...new Set(carriers.filter((c: Carrier) => c.state).map((c: Carrier) => c.state as string))].sort();

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
        <div className="flex items-center gap-3">
          <a 
            href="/CCFS_CarrierBroker_Agreement.docx"
            download="CCFS_CarrierBroker_Agreement.docx"
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors border border-gray-300"
          >
            <FileText className="w-4 h-4 mr-2" />
            Carrier Agreement
            <Download className="w-3 h-3 ml-1" />
          </a>
          <button 
            className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors border border-blue-300"
            onClick={() => setShowInviteModal(true)}
          >
            <Send className="w-4 h-4 mr-2" />
            Send Invitation
          </button>
          <button 
            className={`inline-flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors border border-purple-300 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={syncMonitoredCarriers}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Sync MCP Monitoring
              </>
            )}
          </button>
          <button 
            className={`inline-flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors border border-indigo-300 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={batchUpdateCarriers}
            disabled={isSyncing}
            title="Batch update all carrier data from MyCarrierPackets"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Batch Update MCP
              </>
            )}
          </button>
          <button 
            className={`inline-flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors border border-green-300 ${isCheckingPackets ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => checkCompletedPackets(false)}
            disabled={isCheckingPackets}
            title="Check for recently completed carrier packets"
          >
            {isCheckingPackets ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Check Completed Packets
              </>
            )}
          </button>
          <button 
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowAddCarrierModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add Carrier
          </button>
          <a
            href="https://mycarrierpackets.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            My Carrier Packet
          </a>
        </div>
      </div>

      {/* Pending Registrations Notification */}
      {pendingRegistrations > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <Bell className="w-5 h-5 text-amber-600 mr-3" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800">
                {pendingRegistrations} Carrier Registration{pendingRegistrations > 1 ? 's' : ''} Pending Review
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                New carriers have completed their registration and are awaiting approval. 
                Please review their information and complete the onboarding process.
              </p>
            </div>
            <button 
              className="ml-4 px-3 py-1 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
              onClick={() => setStatusFilter('PENDING')}
            >
              Review Now
            </button>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {invitationsData?.invitations?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Send className="w-5 h-5 text-blue-600 mr-3" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  {invitationsData.invitations.length} Pending Invitation{invitationsData.invitations.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Carrier invitations have been sent and are awaiting registration.
                </p>
              </div>
            </div>
            <button 
              className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              onClick={() => setShowResendModal(true)}
            >
              Resend Invite
            </button>
          </div>
          <div className="mt-3 space-y-1">
            {invitationsData.invitations.slice(0, 3).map((invitation: any) => (
              <div key={invitation.id} className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {invitation.email} • Sent {new Date(invitation.sentAt).toLocaleDateString()}
              </div>
            ))}
            {invitationsData.invitations.length > 3 && (
              <div className="text-xs text-blue-500">
                +{invitationsData.invitations.length - 3} more...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="mb-6">
        <div className="flex gap-4 mb-4">
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
            {uniqueStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
          {/* View Toggle */}
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`relative inline-flex items-center px-3 py-2 rounded-l-md border ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`relative inline-flex items-center px-3 py-2 rounded-r-md border-l-0 border ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Carriers Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          {filteredCarriers.map((carrier: Carrier) => (
            <CarrierCard
              key={carrier.id}
              carrier={carrier}
              onView={() => setViewingCarrier(carrier)}
              onDelete={() => setDeletingCarrier(carrier)}
            />
          ))}
        </div>
      ) : (
        <CarrierList
          carriers={filteredCarriers}
          onView={(carrier: Carrier) => setViewingCarrier(carrier)}
          onDelete={(carrier: Carrier) => setDeletingCarrier(carrier)}
        />
      )}

      {filteredCarriers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No carriers found matching your criteria.</p>
        </div>
      )}

      {/* Carrier Details Modal */}
      {viewingCarrier && (
        <CarrierDetailsModal 
          carrier={viewingCarrier}
          onClose={() => {
            setViewingCarrier(null);
            queryClient.invalidateQueries({ queryKey: ['carriers'] });
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

      {/* Send Invitation Modal */}
      {showInviteModal && (
        <InviteCarrierModal
          onClose={() => setShowInviteModal(false)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['carrier-invitations'] });
            setShowInviteModal(false);
          }}
        />
      )}

      {/* Resend Invitations Modal */}
      {showResendModal && (
        <ResendInvitationsModal
          onClose={() => setShowResendModal(false)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['carrier-invitations'] });
            setShowResendModal(false);
          }}
          invitations={invitationsData?.invitations || []}
        />
      )}

      {/* Batch Update Modal */}
      {showBatchUpdateModal && (
        <BatchUpdateModal
          onClose={() => setShowBatchUpdateModal(false)}
          result={batchUpdateResult}
          isLoading={isSyncing}
        />
      )}

      {/* Completed Packets Modal */}
      {showCompletedPacketsModal && (
        <CompletedPacketsModal
          onClose={() => setShowCompletedPacketsModal(false)}
          result={completedPacketsResult}
          isLoading={isCheckingPackets}
          onSync={() => {
            setShowCompletedPacketsModal(false);
            checkCompletedPackets(true);
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  
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
    onboardingComplete: false
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Carrier lookup state
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  
  // Document upload state
  const [documents, setDocuments] = useState<{ file: File; documentType: string }[]>([]);
  const [currentDocumentType, setCurrentDocumentType] = useState('');
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);

  // Create carrier mutation
  const createCarrierMutation = useMutation({
    mutationFn: async (carrierData: any) => {
      const response = await api.post('/carriers', carrierData);
      return response.data;
    },
    onSuccess: async (createdCarrier) => {
      setErrors([]);
      
      // Upload documents if any were selected
      if (documents.length > 0) {
        await uploadDocuments(createdCarrier.id);
      }
      
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

  // Carrier lookup function
  const handleCarrierLookup = async () => {
    if (!formData.dotNumber && !formData.mcNumber) {
      setErrors(['Please enter either a DOT Number or MC Number to lookup carrier data']);
      return;
    }

    setIsLookingUp(true);
    setErrors([]);
    setLookupSuccess(false);

    try {
      const response = await api.post('/carriers/lookup', {
        dotNumber: formData.dotNumber || undefined,
        mcNumber: formData.mcNumber || undefined
      });

      if (response.data.success && response.data.data) {
        const carrierData = response.data.data;
        
        // Populate form with looked up data
        setFormData(prev => ({
          ...prev,
          name: carrierData.name || prev.name,
          email: carrierData.email || prev.email,
          phone: carrierData.phone || prev.phone,
          streetAddress1: carrierData.address || prev.streetAddress1,
          streetAddress2: carrierData.address2 || prev.streetAddress2,
          city: carrierData.city || prev.city,
          state: carrierData.state || prev.state,
          zipCode: carrierData.zipCode || prev.zipCode,
          dotNumber: carrierData.dotNumber || prev.dotNumber,
          mcNumber: carrierData.mcNumber || prev.mcNumber,
          safetyRating: carrierData.safetyRating || prev.safetyRating
        }));

        setLookupSuccess(true);
        setTimeout(() => setLookupSuccess(false), 3000);
      } else {
        setErrors(['No carrier data found for the provided DOT/MC number']);
      }
    } catch (error: any) {
      console.error('Lookup error:', error);
      setErrors([error.response?.data?.message || 'Failed to lookup carrier data. Please try again.']);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    
    // Client-side validation
    const validationErrors: string[] = [];
    
    if (!formData.name.trim()) {
      validationErrors.push('Carrier name is required');
    }
    
    if (!formData.contactPerson.trim()) {
      validationErrors.push('Contact Person is required');
    }
    
    if (!formData.phone.trim()) {
      validationErrors.push('Phone is required');
    }
    
    if (!formData.email.trim()) {
      validationErrors.push('Email is required');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (!formData.streetAddress1.trim()) {
      validationErrors.push('Street Address 1 is required');
    }
    
    if (!formData.city.trim()) {
      validationErrors.push('City is required');
    }
    
    if (!formData.state.trim()) {
      validationErrors.push('State is required');
    }
    
    if (!formData.zipCode.trim()) {
      validationErrors.push('Zip Code is required');
    }
    
    if (!formData.mcNumber.trim()) {
      validationErrors.push('MC Number is required');
    }
    
    if (!formData.dotNumber.trim()) {
      validationErrors.push('DOT Number is required');
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
        onboardingComplete: formData.onboardingComplete
      };
      
      await createCarrierMutation.mutateAsync(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle document file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentDocumentType) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setErrors(['Please upload a PDF, DOC, DOCX, JPG, or PNG file']);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setErrors(['File size must be less than 10MB']);
        return;
      }
      
      // Add document to list
      setDocuments([...documents, { file, documentType: currentDocumentType }]);
      setCurrentDocumentType('');
      setErrors([]);
      
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  // Remove document from list
  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  // Upload documents after carrier creation
  const uploadDocuments = async (carrierId: number) => {
    setIsUploadingDocuments(true);
    
    try {
      for (const doc of documents) {
        const formData = new FormData();
        formData.append('document', doc.file);
        formData.append('documentType', doc.documentType);
        
        await api.post(`/carriers/${carrierId}/documents`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      // Don't fail the entire operation for document upload errors
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  const handleInviteCarrier = async () => {
    setInviteError('');
    setInviteSuccess(false);
    
    // Validate email
    if (!inviteEmail || !/\S+@\S+\.\S+/.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }
    
    setIsInviting(true);
    
    try {
      await api.post('/carriers/invite', { email: inviteEmail });
      setInviteSuccess(true);
      setTimeout(() => {
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('Error inviting carrier:', error);
      setInviteError(error.response?.data?.message || 'Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Carrier</h2>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Invite Carrier
            </button>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address 1 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">MC Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.mcNumber}
                  onChange={(e) => setFormData({ ...formData, mcNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.dotNumber}
                    onChange={(e) => setFormData({ ...formData, dotNumber: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCarrierLookup}
                    disabled={isLookingUp || (!formData.dotNumber && !formData.mcNumber)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {isLookingUp ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Looking up...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Lookup Data
                      </>
                    )}
                  </button>
                </div>
                {lookupSuccess && (
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Carrier data loaded successfully!
                  </p>
                )}
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
                  <option value="REJECTED">Rejected</option>
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

          {/* Document Upload Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Documents</h3>
            
            {/* Document Upload */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <select
                  value={currentDocumentType}
                  onChange={(e) => setCurrentDocumentType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select document type...</option>
                  <option value="INSURANCE">Insurance Certificate</option>
                  <option value="W9">W-9 Form</option>
                  <option value="CARRIER_AGREEMENT">Carrier Agreement</option>
                  <option value="SAFETY_CERTIFICATE">Safety Certificate</option>
                  <option value="OPERATING_AUTHORITY">Operating Authority</option>
                  <option value="OTHER">Other</option>
                </select>
                
                <div className="relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    disabled={!currentDocumentType}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled={!currentDocumentType}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Choose File
                  </button>
                </div>
              </div>
              
              {/* Document List */}
              {documents.length > 0 && (
                <div className="border border-gray-200 rounded-md p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Documents:</h4>
                  <div className="space-y-2">
                    {documents.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{doc.file.name}</span>
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            {doc.documentType}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDocument(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                Accepted formats: PDF, DOC, DOCX, JPG, PNG (max 10MB each)
              </p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              disabled={isSubmitting || isUploadingDocuments}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              disabled={isSubmitting || isUploadingDocuments}
            >
              {isSubmitting && !isUploadingDocuments && 'Creating Carrier...'}
              {isUploadingDocuments && 'Uploading Documents...'}
              {!isSubmitting && !isUploadingDocuments && 'Create Carrier'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Invite Carrier Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invite Carrier</h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteError('');
                  setInviteSuccess(false);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {inviteSuccess ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-green-600 font-medium">Invitation sent successfully!</p>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Enter the carrier's email address to send them a registration invitation.
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carrier Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="carrier@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isInviting}
                  />
                  {inviteError && (
                    <p className="mt-1 text-sm text-red-600">{inviteError}</p>
                  )}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <p className="text-sm text-gray-700 font-medium mb-2">The carrier will receive an email with:</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>• Registration link to set up their account</p>
                    <p>• Instructions from CrossCountry Freight Solutions, Inc.</p>
                    <p>• Request to complete their carrier profile</p>
                    <p>• Link to review the Carrier/Broker Agreement</p>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-md mb-4 flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800">
                    <p className="font-medium">Note: Carriers must agree to the CCFS Carrier/Broker Agreement.</p>
                    <a 
                      href="/CCFS_CarrierBroker_Agreement.docx"
                      download="CCFS_CarrierBroker_Agreement.docx"
                      className="underline hover:text-blue-900"
                    >
                      Download agreement for review
                    </a>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteError('');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    disabled={isInviting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleInviteCarrier}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
                    disabled={isInviting || !inviteEmail}
                  >
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Carrier Details Modal Component
interface CarrierDetailsModalProps {
  carrier: Carrier;
  onClose: () => void;
}

const CarrierDetailsModal: React.FC<CarrierDetailsModalProps> = ({ carrier: initialCarrier, onClose }) => {
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState(initialCarrier);
  const [agreements, setAgreements] = useState<CarrierAgreement[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingDocuments, setIsSyncingDocuments] = useState(false);
  const [syncDocumentsResult, setSyncDocumentsResult] = useState<any>(null);
  const [showSyncResultModal, setShowSyncResultModal] = useState(false);
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
    status: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(carrier.status) 
      ? carrier.status 
      : carrier.status === 'ONBOARDED' ? 'ACTIVE' : 'PENDING',
    carrierType: carrier.carrierType || '',
    taxId: carrier.taxId || '',
    ratePerMile: carrier.ratePerMile?.toString() || '',
    rating: carrier.rating?.toString() || '',
    remittanceContact: carrier.remittanceContact || '',
    remittanceEmail: carrier.remittanceEmail || '',
    factoringCompany: carrier.factoringCompany || '',
    onboardingComplete: carrier.onboardingComplete
  });

  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      ONBOARDED: 'bg-blue-100 text-blue-800',
      NOT_ONBOARDED: 'bg-orange-100 text-orange-800',
      REJECTED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  // Fetch full carrier details
  useEffect(() => {
    const fetchCarrierDetails = async () => {
      try {
        const fullCarrier = await carrierService.getCarrierById(carrier.id);
        setCarrier(fullCarrier);
      } catch (error) {
        console.error('Failed to fetch carrier details:', error);
      }
    };
    
    fetchCarrierDetails();
  }, [carrier.id]);

  // Fetch carrier agreements
  useEffect(() => {
    const fetchAgreements = async () => {
      try {
        setLoadingAgreements(true);
        const response = await api.get(`/carriers/${carrier.id}/agreements`);
        setAgreements(response.data);
      } catch (error) {
        console.error('Failed to fetch agreements:', error);
        setAgreements([]);
      } finally {
        setLoadingAgreements(false);
      }
    };

    fetchAgreements();
  }, [carrier.id]);

  // Fetch carrier documents
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoadingDocuments(true);
        const response = await api.get(`/carriers/${carrier.id}/documents`);
        setDocuments(response.data);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        setDocuments([]);
      } finally {
        setLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, [carrier.id]);

  const downloadDocument = async (documentId: number, filename: string) => {
    try {
      const response = await api.get(`/carriers/${carrier.id}/documents/${documentId}`, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/carriers/${carrier.id}/documents/${documentId}`);
      
      // Refresh documents list
      const response = await api.get(`/carriers/${carrier.id}/documents`);
      setDocuments(response.data);
      
      alert('Document deleted successfully');
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document. Please try again.');
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !documentType) {
      alert('Please select a file and document type');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('document', uploadFile);
    formData.append('documentType', documentType);

    try {
      await api.post(`/carriers/${carrier.id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Refresh documents list
      const response = await api.get(`/carriers/${carrier.id}/documents`);
      setDocuments(response.data);
      
      // Reset form
      setShowUploadForm(false);
      setUploadFile(null);
      setDocumentType('');
      
      alert('Document uploaded successfully');
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const downloadAgreementDocument = async (agreementId: number, type: 'affidavit' | 'full') => {
    try {
      const endpoint = type === 'affidavit' 
        ? `/carriers/${carrier.id}/agreements/${agreementId}/affidavit`
        : `/carriers/${carrier.id}/agreements/${agreementId}/full`;
      
      const response = await api.get(endpoint, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 
        type === 'affidavit' 
          ? `affidavit_${carrier.name}_${agreementId}.pdf`
          : `agreement_${carrier.name}_${agreementId}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  // Handle sync MCP documents
  const handleSyncMCPDocuments = async () => {
    if (!carrier.dotNumber) {
      alert('Carrier must have a DOT number to sync documents from MyCarrierPackets');
      return;
    }

    setIsSyncingDocuments(true);
    setSyncDocumentsResult(null);

    try {
      const response = await carrierService.syncDocuments(carrier.id);
      setSyncDocumentsResult(response);
      setShowSyncResultModal(true);
      
      // Refresh documents list to show new documents
      const docsResponse = await api.get(`/carriers/${carrier.id}/documents`);
      setDocuments(docsResponse.data);
    } catch (error: any) {
      console.error('Failed to sync documents:', error);
      setSyncDocumentsResult({
        success: false,
        error: error.response?.data?.message || 'Failed to sync documents from MyCarrierPackets'
      });
      setShowSyncResultModal(true);
    } finally {
      setIsSyncingDocuments(false);
    }
  };

  // Download MCP document
  const downloadMCPDocument = async (doc: any) => {
    try {
      // Extract blob name from file path
      const pathParts = doc.filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const blobName = fileName.split('_').slice(2).join('_');
      
      const url = carrierService.getMCPDocumentUrl(blobName, carrier.id);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to download MCP document:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    
    try {
      // Build payload with proper validation
      const payload: any = {};
      
      // Only include fields that have values
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
      
      payload.status = formData.status;
      payload.onboardingComplete = formData.onboardingComplete;
      
      if (formData.carrierType.trim()) payload.carrierType = formData.carrierType.trim();
      if (formData.taxId.trim()) payload.taxId = formData.taxId.trim();
      
      // Convert numeric fields
      if (formData.ratePerMile) {
        const rate = parseFloat(formData.ratePerMile);
        if (!isNaN(rate)) payload.ratePerMile = rate;
      }
      if (formData.rating) {
        const rating = parseFloat(formData.rating);
        if (!isNaN(rating)) payload.rating = rating;
      }
      
      if (formData.remittanceContact.trim()) payload.remittanceContact = formData.remittanceContact.trim();
      if (formData.remittanceEmail.trim()) payload.remittanceEmail = formData.remittanceEmail.trim();
      if (formData.factoringCompany.trim()) payload.factoringCompany = formData.factoringCompany.trim();
      
      
      await api.put(`/carriers/${carrier.id}`, payload);
      
      // Update the carriers list
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      
      // Exit edit mode
      setIsEditMode(false);
      
      alert('Carrier updated successfully');
    } catch (error: any) {
      console.error('Update failed:', error);
      alert(error.response?.data?.message || 'Failed to update carrier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
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
      status: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(carrier.status) 
        ? carrier.status 
        : carrier.status === 'ONBOARDED' ? 'ACTIVE' : 'PENDING',
      carrierType: carrier.carrierType || '',
      taxId: carrier.taxId || '',
      ratePerMile: carrier.ratePerMile?.toString() || '',
      rating: carrier.rating?.toString() || '',
      remittanceContact: carrier.remittanceContact || '',
      remittanceEmail: carrier.remittanceEmail || '',
      factoringCompany: carrier.factoringCompany || '',
      onboardingComplete: carrier.onboardingComplete
    });
    setIsEditMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Carrier Details - {carrier.name}</h2>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Name</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {isEditMode ? (
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as CarrierStatus})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              ) : (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(carrier.status)}`}>
                  {carrier.status}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Onboarding Complete</label>
              {isEditMode ? (
                <select
                  value={formData.onboardingComplete ? 'true' : 'false'}
                  onChange={(e) => setFormData({...formData, onboardingComplete: e.target.value === 'true'})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              ) : (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  carrier.onboardingComplete 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {carrier.onboardingComplete ? 'Yes' : 'No'}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter contact person"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.contactPerson || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.phone || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              {isEditMode ? (
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.email || 'N/A'}</p>
              )}
            </div>
          </div>

          {/* Address & Details */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              {isEditMode ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.streetAddress1}
                    onChange={(e) => setFormData({...formData, streetAddress1: e.target.value})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Street Address 1"
                  />
                  <input
                    type="text"
                    value={formData.streetAddress2}
                    onChange={(e) => setFormData({...formData, streetAddress2: e.target.value})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Street Address 2 (Optional)"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="City"
                    />
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      className="p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="State"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                      className="p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="ZIP Code"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-900 space-y-1">
                  {(carrier.streetAddress1 || carrier.city || carrier.state || carrier.zipCode) ? (
                    <>
                      {carrier.streetAddress1 && <p>{carrier.streetAddress1}</p>}
                      {carrier.streetAddress2 && <p>{carrier.streetAddress2}</p>}
                      {(carrier.city || carrier.state || carrier.zipCode) && (
                        <p>
                          {carrier.city}{carrier.city && (carrier.state || carrier.zipCode) ? ', ' : ''}
                          {carrier.state} {carrier.zipCode}
                        </p>
                      )}
                    </>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MC Number</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formData.mcNumber}
                    onChange={(e) => setFormData({...formData, mcNumber: e.target.value})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="MC Number"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{carrier.mcNumber || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DOT Number</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formData.dotNumber}
                    onChange={(e) => setFormData({...formData, dotNumber: e.target.value})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="DOT Number"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{carrier.dotNumber || 'N/A'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Type</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.carrierType}
                  onChange={(e) => setFormData({...formData, carrierType: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter carrier type"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.carrierType || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>


        {/* Financial Information */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Financial Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate per Mile</label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.ratePerMile}
                  onChange={(e) => setFormData({...formData, ratePerMile: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.ratePerMile ? `$${carrier.ratePerMile}` : 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({...formData, rating: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.0"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.rating || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.taxId}
                  onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tax ID"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.taxId || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Factoring Company</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.factoringCompany}
                  onChange={(e) => setFormData({...formData, factoringCompany: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Factoring company"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.factoringCompany || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Remittance Information */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Remittance Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Contact</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.remittanceContact}
                  onChange={(e) => setFormData({...formData, remittanceContact: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Remittance contact"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.remittanceContact || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remittance Email</label>
              {isEditMode ? (
                <input
                  type="email"
                  value={formData.remittanceEmail}
                  onChange={(e) => setFormData({...formData, remittanceEmail: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="remittance@example.com"
                />
              ) : (
                <p className="text-sm text-gray-900">{carrier.remittanceEmail || 'N/A'}</p>
              )}
            </div>
          </div>
        </div>


        {/* MyCarrierPackets Status */}
        {carrier.dotNumber && (
          <div className="mt-6 pt-6 border-t">
            <MCPStatus 
              carrier={carrier} 
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['carriers'] })}
            />
          </div>
        )}

        {/* Insurance Details */}
        {(carrier.generalLiabilityExpiration || carrier.cargoLiabilityExpiration || carrier.autoLiabilityExpiration) && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Insurance Coverage Details</h3>
            <div className="space-y-3">
              {carrier.generalLiabilityExpiration && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">General Liability</p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(carrier.generalLiabilityExpiration).toLocaleDateString()}
                  </p>
                </div>
              )}
              {carrier.cargoLiabilityExpiration && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Cargo Liability w/ Reefer Breakdown</p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(carrier.cargoLiabilityExpiration).toLocaleDateString()}
                  </p>
                </div>
              )}
              {carrier.autoLiabilityExpiration && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">Auto Liability</p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(carrier.autoLiabilityExpiration).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Signed Agreements Section */}
        <div className="mt-6 pt-6 border-t">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Signed Agreements</h3>
            {loadingAgreements ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading agreements...</span>
              </div>
            ) : agreements.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500 text-center">No signed agreements found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {agreements.map((agreement) => (
                  <div key={agreement.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-900">{agreement.agreementTitle}</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">Signed By:</span> {agreement.signedBy}
                          </div>
                          <div>
                            <span className="font-medium">Title:</span> {agreement.signedByTitle}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span> {new Date(agreement.signedAt).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-medium">Version:</span> {agreement.agreementVersion}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">IP Address:</span> {agreement.ipAddress}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 ml-4">
                        {agreement.affidavitPdfPath && (
                          <button
                            onClick={() => downloadAgreementDocument(agreement.id, 'affidavit')}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            title="Download Affidavit"
                          >
                            <Download className="w-3 h-3" />
                            Affidavit
                          </button>
                        )}
                        {agreement.agreementPdfPath && (
                          <button
                            onClick={() => downloadAgreementDocument(agreement.id, 'full')}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            title="Download Full Agreement"
                          >
                            <Download className="w-3 h-3" />
                            Agreement
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents Section */}
        <div className="mt-6 pt-6 border-t">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900">Uploaded Documents</h3>
              <div className="flex gap-2">
                {carrier.dotNumber && (
                  <button
                    onClick={handleSyncMCPDocuments}
                    disabled={isSyncingDocuments}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-purple-400"
                    title="Sync documents from MyCarrierPackets"
                  >
                    {isSyncingDocuments ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Sync MCP Docs
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4" />
                  Upload Document
                </button>
              </div>
            </div>
            {loadingDocuments ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-500">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500 text-center">No documents uploaded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h4 className="font-medium text-gray-900">{doc.filename}</h4>
                          {doc.documentType.startsWith('MCP_') && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">MCP</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                          <div>
                            <span className="font-medium">Type:</span> {doc.documentType.replace(/_/g, ' ')}
                          </div>
                          <div>
                            <span className="font-medium">Uploaded:</span> {new Date(doc.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        {doc.documentType.startsWith('MCP_') ? (
                          <button
                            onClick={() => downloadMCPDocument(doc)}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                            title="Download from MCP"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => downloadDocument(doc.id, doc.filename)}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="Download Document"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Form */}
          {showUploadForm && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Upload New Document</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select document type</option>
                    <option value="INSURANCE_CERTIFICATE">Insurance Certificate</option>
                    <option value="CARRIER_AGREEMENT">Carrier Agreement</option>
                    <option value="W9_FORM">W9 Form</option>
                    <option value="OPERATING_AUTHORITY">Operating Authority</option>
                    <option value="SAFETY_RATING">Safety Rating</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full p-2 border rounded"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Accepted formats: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUploadDocument}
                    disabled={uploading || !uploadFile || !documentType}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadForm(false);
                      setUploadFile(null);
                      setDocumentType('');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
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
        
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
          {isEditMode ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting || !formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Sync Documents Result Modal */}
      {showSyncResultModal && syncDocumentsResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {syncDocumentsResult.success ? 'Documents Synced' : 'Sync Failed'}
              </h3>
              <button
                onClick={() => {
                  setShowSyncResultModal(false);
                  setSyncDocumentsResult(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {syncDocumentsResult.success ? (
              <>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    Successfully synced documents for <strong>{syncDocumentsResult.carrier?.name}</strong>
                  </p>
                  {syncDocumentsResult.carrier?.dotNumber && (
                    <p className="text-xs text-gray-500 mt-1">
                      DOT: {syncDocumentsResult.carrier.dotNumber}
                    </p>
                  )}
                </div>

                {syncDocumentsResult.summary && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Downloaded:</span>
                        <span className="ml-2 font-medium text-green-600">
                          {syncDocumentsResult.summary.downloaded}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Failed:</span>
                        <span className="ml-2 font-medium text-red-600">
                          {syncDocumentsResult.summary.failed}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {syncDocumentsResult.documents && syncDocumentsResult.documents.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Document Details</h4>
                    <div className="space-y-2">
                      {syncDocumentsResult.documents.map((doc: any, index: number) => (
                        <div
                          key={index}
                          className={`text-sm p-2 rounded ${
                            doc.status === 'success'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{doc.type}</p>
                              <p className="text-xs">{doc.fileName}</p>
                            </div>
                            {doc.status === 'failed' && doc.error && (
                              <p className="text-xs ml-2">{doc.error}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <X className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-red-600">
                  {syncDocumentsResult.error || 'Failed to sync documents'}
                </p>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowSyncResultModal(false);
                  setSyncDocumentsResult(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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

// Invite Carrier Modal Component
interface InviteCarrierModalProps {
  onClose: () => void;
  onSave: () => void;
}

const InviteCarrierModal: React.FC<InviteCarrierModalProps> = ({ onClose, onSave }) => {
  const [dotNumber, setDotNumber] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [carrierData, setCarrierData] = useState<any>(null);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  // Lookup carrier data to preload information
  const handleCarrierLookup = async () => {
    if (!dotNumber && !mcNumber) {
      setError('Please enter either a DOT Number or MC Number to lookup carrier data');
      return;
    }

    setIsLookingUp(true);
    setError('');
    setLookupSuccess(false);

    try {
      const response = await api.post('/carriers/lookup', {
        dotNumber: dotNumber || undefined,
        mcNumber: mcNumber || undefined
      });

      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setCarrierData(data);
        
        // Pre-populate email if found
        if (data.email) {
          setEmail(data.email);
        }
        
        setLookupSuccess(true);
        setTimeout(() => setLookupSuccess(false), 3000);
      } else {
        setError('No carrier data found for the provided DOT/MC number');
      }
    } catch (error: any) {
      console.error('Lookup error:', error);
      setError(error.response?.data?.message || 'Failed to lookup carrier data. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!dotNumber && !mcNumber) {
      setError('DOT Number or MC Number is required');
      return;
    }
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Use the MyCarrierPackets invite API
      await api.post('/carriers/invite-intellivite', { 
        dotNumber: dotNumber || undefined,
        mcNumber: mcNumber || undefined,
        email: email.trim(),
        username: 'CrossCountryFreight' // Your MCP username
      });
      setSuccess(true);
      setTimeout(() => {
        onSave();
      }, 2000);
    } catch (error: any) {
      setError(
        error.response?.data?.message || 'Failed to send invitation. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Invitation Sent!</h3>
            <p className="text-sm text-gray-600 mb-4">
              The MyCarrierPackets invitation has been sent to {email} for DOT {dotNumber || mcNumber}
            </p>
            <button
              onClick={onSave}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Search & Intellivite</h2>
            <p className="text-sm text-gray-600">Invite carriers to complete packets</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* DOT Number Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter a DOT Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dotNumber}
                onChange={(e) => setDotNumber(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="DOT Number"
              />
              <button
                type="button"
                onClick={handleCarrierLookup}
                disabled={isLookingUp || (!dotNumber && !mcNumber)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLookingUp ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* OR Separator */}
          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-sm text-red-500 font-medium">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* MC Number Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter a Docket Number
            </label>
            <div className="flex gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50">
                <option>MC</option>
              </select>
              <input
                type="text"
                value={mcNumber}
                onChange={(e) => setMcNumber(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Docket Number"
              />
              <button
                type="button"
                onClick={handleCarrierLookup}
                disabled={isLookingUp || (!dotNumber && !mcNumber)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isLookingUp ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Lookup Success Message */}
          {lookupSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Carrier data loaded successfully!
              </p>
            </div>
          )}

          {/* Carrier Info Display */}
          {carrierData && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="font-medium text-blue-900 mb-2">Found Carrier:</h4>
              <p className="text-sm text-blue-800">{carrierData.name}</p>
              {carrierData.city && carrierData.state && (
                <p className="text-sm text-blue-700">{carrierData.city}, {carrierData.state}</p>
              )}
            </div>
          )}

          {/* Email Input */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Enter a Carrier's Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="carrier@example.com"
              required
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p className="text-sm text-blue-800">
              The carrier will receive an intellivite invitation to complete their MyCarrierPackets profile.
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
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
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
              disabled={isSubmitting || (!dotNumber && !mcNumber) || !email}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Batch Update Modal Component
const BatchUpdateModal: React.FC<{
  onClose: () => void;
  result: any;
  isLoading: boolean;
}> = ({ onClose, result, isLoading }) => {
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Batch Updating Carriers</h3>
            <p className="text-gray-600">
              Fetching and updating carrier data from MyCarrierPackets...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isSuccess = result.success !== false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Batch Update {isSuccess ? 'Complete' : 'Failed'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isSuccess ? (
          <>
            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
              <div className="flex items-center mb-2">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Batch update completed successfully
                  </h3>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.summary?.processed || 0}
                  </div>
                  <div className="text-sm text-gray-600">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.summary?.updated || 0}
                  </div>
                  <div className="text-sm text-gray-600">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {result.summary?.errors || 0}
                  </div>
                  <div className="text-sm text-gray-600">Errors</div>
                </div>
              </div>
            </div>

            {/* Details */}
            {result.details && result.details.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 mb-2">Update Details:</h3>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                  {result.details.map((detail: any, index: number) => (
                    <div
                      key={index}
                      className={`px-4 py-2 border-b last:border-b-0 ${
                        detail.status === 'updated' 
                          ? 'bg-green-50 text-green-800' 
                          : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">DOT: {detail.dotNumber}</span>
                        <span className="text-sm">
                          {detail.status === 'updated' ? '✓ Updated' : '✗ Error'}
                        </span>
                      </div>
                      {detail.message && (
                        <div className="text-sm mt-1 text-gray-600">{detail.message}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Batch update failed
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {result.error || 'An unknown error occurred'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Completed Packets Modal Component
const CompletedPacketsModal: React.FC<{
  onClose: () => void;
  result: any;
  isLoading: boolean;
  onSync: () => void;
}> = ({ onClose, result, isLoading, onSync }) => {
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Checking Completed Packets</h3>
            <p className="text-gray-600">
              Retrieving recently completed carrier packets from MyCarrierPackets...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isSuccess = result.success !== false;
  const isCheckMode = result.mode === 'check';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Completed Carrier Packets
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isSuccess ? (
          <>
            {/* Date Range */}
            <div className="bg-gray-50 rounded-md p-3 mb-4">
              <p className="text-sm text-gray-600">
                Checked packets from {new Date(result.dateRange.from).toLocaleDateString()} to {new Date(result.dateRange.to).toLocaleDateString()}
              </p>
            </div>

            {isCheckMode ? (
              <>
                {/* Check Mode Results */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-blue-800">
                      Found {result.totalCount} completed packet{result.totalCount !== 1 ? 's' : ''}
                    </h3>
                    {result.totalCount > 0 && (
                      <button
                        onClick={onSync}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Sync All
                      </button>
                    )}
                  </div>
                </div>

                {/* Packet List */}
                {result.packets && result.packets.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-700 mb-2">Completed Packets:</h3>
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">DOT #</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">MC #</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {result.packets.map((packet: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm">{packet.carrierName}</td>
                              <td className="px-4 py-2 text-sm font-mono">{packet.dotNumber}</td>
                              <td className="px-4 py-2 text-sm font-mono">{packet.mcNumber || 'N/A'}</td>
                              <td className="px-4 py-2 text-sm">
                                {new Date(packet.completedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Sync Mode Results */}
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                  <div className="flex items-center mb-2">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Sync completed successfully
                      </h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">
                        {result.summary?.checked || 0}
                      </div>
                      <div className="text-sm text-gray-600">Checked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {result.summary?.synced || 0}
                      </div>
                      <div className="text-sm text-gray-600">Synced</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.summary?.newPackets || 0}
                      </div>
                      <div className="text-sm text-gray-600">New</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {result.summary?.errors || 0}
                      </div>
                      <div className="text-sm text-gray-600">Errors</div>
                    </div>
                  </div>
                </div>

                {/* Sync Details */}
                {result.details && result.details.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-700 mb-2">Sync Details:</h3>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                      {result.details.map((detail: any, index: number) => (
                        <div
                          key={index}
                          className={`px-4 py-2 border-b last:border-b-0 ${
                            detail.status === 'synced' 
                              ? 'bg-green-50' 
                              : detail.status === 'new'
                              ? 'bg-blue-50'
                              : 'bg-red-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium">{detail.carrierName}</span>
                              <span className="text-sm text-gray-500 ml-2">DOT: {detail.dotNumber}</span>
                            </div>
                            <span className={`text-sm font-medium ${
                              detail.status === 'synced' 
                                ? 'text-green-700' 
                                : detail.status === 'new'
                                ? 'text-blue-700'
                                : 'text-red-700'
                            }`}>
                              {detail.status === 'synced' ? '✓ Synced' : 
                               detail.status === 'new' ? '+ New' : '✗ Error'}
                            </span>
                          </div>
                          {detail.message && (
                            <div className="text-sm mt-1 text-gray-600">{detail.message}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Failed to check completed packets
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  {result.error || 'An unknown error occurred'}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Resend Invitations Modal Component
interface ResendInvitationsModalProps {
  onClose: () => void;
  onSave: () => void;
  invitations: any[];
}

const ResendInvitationsModal: React.FC<ResendInvitationsModalProps> = ({ onClose, onSave, invitations }) => {
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendResults, setResendResults] = useState<{success: number, failed: number}>({success: 0, failed: 0});

  const handleToggleInvitation = (invitationId: string) => {
    setSelectedInvitations(prev => 
      prev.includes(invitationId) 
        ? prev.filter(id => id !== invitationId)
        : [...prev, invitationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvitations.length === invitations.length) {
      setSelectedInvitations([]);
    } else {
      setSelectedInvitations(invitations.map(inv => inv.id.toString()));
    }
  };

  const handleResend = async () => {
    if (selectedInvitations.length === 0) {
      setError('Please select at least one invitation to resend');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    let successCount = 0;
    let failCount = 0;

    try {
      // Process each selected invitation
      for (const invitationId of selectedInvitations) {
        const invitation = invitations.find(inv => inv.id.toString() === invitationId);
        if (invitation) {
          try {
            // First cancel the existing invitation
            await api.put(`/carriers/invitations/${invitation.id}/cancel`);
            
            // Then send new invitation to the same email
            await api.post('/carriers/invite', { email: invitation.email });
            successCount++;
          } catch (error) {
            console.error(`Failed to resend invitation to ${invitation.email}:`, error);
            failCount++;
          }
        }
      }

      setResendResults({ success: successCount, failed: failCount });
      setSuccess(true);
      
      if (successCount > 0) {
        setTimeout(() => {
          onSave();
        }, 2000);
      }
    } catch (error: any) {
      setError('Failed to resend invitations. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <Send className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Invitations Resent!</h3>
            <div className="text-sm text-gray-600 mb-4">
              <p className="text-green-600 font-medium">{resendResults.success} invitation(s) sent successfully</p>
              {resendResults.failed > 0 && (
                <p className="text-red-600 font-medium">{resendResults.failed} invitation(s) failed</p>
              )}
              <p className="mt-2">New registration links have been sent with updated expiration dates.</p>
            </div>
            <button
              onClick={onSave}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Resend Carrier Invitations</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Select which pending invitations to resend. New tokens will be generated with updated expiration dates.
          </p>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              {invitations.length} pending invitation(s)
            </span>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {selectedInvitations.length === invitations.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedInvitations.includes(invitation.id.toString())
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => handleToggleInvitation(invitation.id.toString())}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedInvitations.includes(invitation.id.toString())}
                    onChange={() => handleToggleInvitation(invitation.id.toString())}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{invitation.email}</div>
                    <div className="text-xs text-gray-500">
                      Sent: {new Date(invitation.sentAt).toLocaleDateString()} • 
                      Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                      {invitation.createdByUser && ` • Sent by: ${invitation.createdByUser.name}`}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Resending will cancel the current invitations and create new invitation tokens with fresh 7-day expiration dates. The old links will no longer be valid.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            onClick={handleResend}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 flex items-center gap-2"
            disabled={isSubmitting || selectedInvitations.length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Resending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Resend {selectedInvitations.length > 0 && `(${selectedInvitations.length})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};