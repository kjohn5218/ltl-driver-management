import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, sendRateConfirmationEmail } from '../services/api';
import { Booking } from '../types';
import { Plus, Search, Edit, Eye, Calendar, MapPin, User, DollarSign, X, ChevronUp, ChevronDown, Trash2, FileText, CheckCircle, Clock, Send, Truck, Upload } from 'lucide-react';
import { format, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import { RateConfirmationModal } from '../components/RateConfirmation';
import { BookingLineItems } from '../components/BookingLineItems';

type SortField = 'id' | 'carrier' | 'route' | 'bookingDate' | 'rate' | 'status';
type SortDirection = 'asc' | 'desc';

// Parse multi-leg booking information from notes
const parseMultiLegBooking = (notes: string | null) => {
  if (!notes || !notes.includes('--- Multi-Leg Booking ---')) {
    return null;
  }
  
  const lines = notes.split('\n');
  const legs = [];
  
  for (const line of lines) {
    // Handle both formats:
    // Standard: "Leg 1: A → B ($100.00)"
    // With manifest: "Leg 1: A → B ($100.00) [Manifest: ABC123]"
    const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\([^$)]+\))?\s*\(\$(.+)\)(?:\s*\[Manifest:\s*([^\]]*)\])?$/);
    if (legMatch) {
      legs.push({
        legNumber: parseInt(legMatch[1]),
        origin: legMatch[2],
        destination: legMatch[3],
        rate: legMatch[4],
        manifestNumber: legMatch[5] || '' // Extract manifest number if present
      });
    }
  }
  
  return legs.length > 0 ? legs : null;
};

export const Bookings: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [documentsFilter, setDocumentsFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('bookingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [rateConfirmationBooking, setRateConfirmationBooking] = useState<Booking | null>(null);
  const [rateConfirmationFilter, setRateConfirmationFilter] = useState('');

  // Handle URL query parameters
  useEffect(() => {
    const status = searchParams.get('status');
    const rateConfirmation = searchParams.get('rateConfirmation');
    
    if (status) {
      setStatusFilter(status);
    }
    
    if (rateConfirmation) {
      setRateConfirmationFilter(rateConfirmation);
    }
  }, [searchParams]);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const response = await api.get('/bookings?limit=1000'); // Fetch all bookings
      return response.data.bookings as Booking[];
    }
  });

  // Fetch system settings for fuel surcharge
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    }
  });

  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await api.delete(`/bookings/${bookingId}`);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch bookings data
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setDeletingBooking(null);
    },
    onError: (error: any) => {
      console.error('Delete booking error:', error);
      alert('Failed to delete booking. Please try again.');
    }
  });

  const filteredAndSortedBookings = useMemo(() => {
    if (!bookings) return [];

    // First, filter the bookings
    let filtered = bookings.filter(booking => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        (booking.carrier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         booking.route?.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Status filter
      const matchesStatus = statusFilter === '' || booking.status === statusFilter;
      
      // Date filter
      let matchesDate = true;
      if (dateFromFilter || dateToFilter) {
        const bookingDate = parseISO(booking.bookingDate);
        
        if (dateFromFilter) {
          const fromDate = parseISO(dateFromFilter);
          matchesDate = matchesDate && (isAfter(bookingDate, fromDate) || isSameDay(bookingDate, fromDate));
        }
        
        if (dateToFilter) {
          const toDate = parseISO(dateToFilter);
          matchesDate = matchesDate && (isBefore(bookingDate, toDate) || isSameDay(bookingDate, toDate));
        }
      }
      
      // Rate confirmation filter
      let matchesRateConfirmation = true;
      if (rateConfirmationFilter === 'pending') {
        // Show bookings not in CANCELLED or COMPLETED status where rate confirmation not sent or not signed
        matchesRateConfirmation = 
          booking.status !== 'CANCELLED' && 
          booking.status !== 'COMPLETED' &&
          (!booking.confirmationSentAt || !booking.confirmationSignedAt);
      }
      
      // Documents filter
      let matchesDocuments = true;
      if (documentsFilter === 'with_documents') {
        matchesDocuments = booking.documents && booking.documents.length > 0;
      } else if (documentsFilter === 'without_documents') {
        matchesDocuments = !booking.documents || booking.documents.length === 0;
      }
      
      return matchesSearch && matchesStatus && matchesDate && matchesRateConfirmation && matchesDocuments;
    });

    // Then, sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'carrier':
          aValue = a.carrier?.name || '';
          bValue = b.carrier?.name || '';
          break;
        case 'route':
          aValue = a.route?.name || '';
          bValue = b.route?.name || '';
          break;
        case 'bookingDate':
          aValue = new Date(a.bookingDate);
          bValue = new Date(b.bookingDate);
          break;
        case 'rate':
          aValue = a.rate;
          bValue = b.rate;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle number and date comparison
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [bookings, searchTerm, statusFilter, dateFromFilter, dateToFilter, documentsFilter, rateConfirmationFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 ml-1 inline" /> : 
      <ChevronDown className="w-4 h-4 ml-1 inline" />;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-purple-100 text-purple-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getConfirmationStatusIcon = (booking: Booking) => {
    if (booking.confirmationSignedAt) {
      return (
        <div className="flex items-center" title={`Signed by ${booking.confirmationSignedBy} on ${format(new Date(booking.confirmationSignedAt), 'MMM dd, yyyy HH:mm')}`}>
          <CheckCircle className="w-4 h-4 text-green-600" />
        </div>
      );
    } else if (booking.confirmationSentAt) {
      return (
        <div className="flex items-center" title={`Sent via ${booking.confirmationSentVia} on ${format(new Date(booking.confirmationSentAt), 'MMM dd, yyyy HH:mm')}`}>
          <Clock className="w-4 h-4 text-yellow-600" />
        </div>
      );
    } else if (booking.carrierEmail || booking.carrier?.email) {
      return (
        <div className="flex items-center" title="Rate confirmation not sent">
          <Send className="w-4 h-4 text-gray-400" />
        </div>
      );
    }
    return null;
  };

  const handleViewBooking = (booking: Booking) => {
    setViewingBooking(booking);
  };


  const handlePostLoad = (booking: Booking) => {
    window.open('https://login.dat.com/u/login/identifier?state=hKFo2SBDSFJ0QlU5bGxpbEJaaEZGZFJfenh4cGpJcFRaOFdnOaFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIGw1TnA3UnVtR2UwVGNucnZfU3N0V2xtRTdmUURhc3Zno2NpZNkgZTlsek1YYm5XTkowRDUwQzJoYWFkbzdEaVcxYWt3YUM', '_blank');
  };

  const handleDeleteBooking = (booking: Booking) => {
    setDeletingBooking(booking);
  };

  const handleRateConfirmation = async (booking: Booking) => {
    try {
      // Always fetch the latest booking data to ensure we have updated carrier email
      const response = await api.get(`/bookings/${booking.id}`);
      const fullBookingData = response.data;
      console.log('Rate confirmation - fetched booking data:', {
        id: fullBookingData.id,
        carrierEmail: fullBookingData.carrierEmail,
        carrierOriginalEmail: fullBookingData.carrier?.email
      });
      setRateConfirmationBooking(fullBookingData);
    } catch (error) {
      console.error('Failed to fetch full booking data:', error);
      // Fallback to provided booking data
      setRateConfirmationBooking(booking);
    }
  };

  const handleCloseView = () => {
    setViewingBooking(null);
  };


  const handleCloseDelete = () => {
    setDeletingBooking(null);
  };

  const handleCloseRateConfirmation = () => {
    setRateConfirmationBooking(null);
  };

  const handleConfirmDelete = () => {
    if (deletingBooking) {
      deleteBookingMutation.mutate(deletingBooking.id);
    }
  };

  const handleEmailRateConfirmation = async (pdfBlob: Blob) => {
    if (!rateConfirmationBooking) {
      alert('No booking selected');
      return;
    }

    const emailAddress = rateConfirmationBooking.carrierEmail || rateConfirmationBooking.carrier?.email;
    if (!emailAddress) {
      alert('Cannot send email: No carrier email available');
      return;
    }

    try {
      const response = await sendRateConfirmationEmail(
        rateConfirmationBooking.id,
        emailAddress,
        pdfBlob
      );
      
      // Handle different response types
      const responseData = response.data;
      if (responseData.warning) {
        alert(`${responseData.message}\n\nWarning: ${responseData.warning}\n\nConfirmation URL: ${responseData.confirmationUrl}`);
      } else {
        alert(`Rate confirmation sent successfully to ${emailAddress}`);
      }
      
      setRateConfirmationBooking(null);
      
      // Refresh bookings to show updated confirmation status
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    } catch (error: any) {
      console.error('Error sending rate confirmation:', error);
      const errorMessage = error.response?.data?.message || 'Failed to send rate confirmation email';
      alert(`Error: ${errorMessage}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600">Track and manage all bookings</p>
        </div>
        <button 
          onClick={() => navigate('/bookings/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by carrier or route..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              // Clear rate confirmation filter when status filter changes
              setRateConfirmationFilter('');
            }}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending (Unbooked)</option>
            <option value="CONFIRMED">Confirmed (Booked)</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={documentsFilter}
            onChange={(e) => setDocumentsFilter(e.target.value)}
          >
            <option value="">All Documents</option>
            <option value="with_documents">With Documents</option>
            <option value="without_documents">Without Documents</option>
          </select>
        </div>
        
        {/* Date Filters */}
        <div className="flex gap-4 items-center">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Date Range:</span>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="From date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="To date"
            />
          </div>
          {(dateFromFilter || dateToFilter) && (
            <button
              onClick={() => {
                setDateFromFilter('');
                setDateToFilter('');
              }}
              className="text-gray-500 hover:text-red-600 transition-colors"
              title="Clear date filters"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Rate Confirmation Filter Indicator */}
        {rateConfirmationFilter === 'pending' && (
          <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded-md">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Showing: Pending Rate Confirmations</span>
            <button
              onClick={() => setRateConfirmationFilter('')}
              className="ml-2 text-orange-600 hover:text-orange-800"
              title="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('id')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Booking ID
                  {getSortIcon('id')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('carrier')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Carrier
                  {getSortIcon('carrier')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('route')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Route
                  {getSortIcon('route')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('bookingDate')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Date
                  {getSortIcon('bookingDate')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('rate')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Rate
                  {getSortIcon('rate')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Status
                  {getSortIcon('status')}
                </button>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedBookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    <span>#{booking.id}</span>
                    {booking.documents && booking.documents.length > 0 && (
                      <div className="relative group">
                        <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <Upload className="w-3 h-3 text-green-600" />
                        </div>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {booking.documents.length} document{booking.documents.length !== 1 ? 's' : ''} uploaded
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-900">{booking.carrier?.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    <div>
                      {(() => {
                        const multiLegInfo = parseMultiLegBooking(booking.notes || null);
                        if (multiLegInfo) {
                          return (
                            <>
                              <div className="text-sm font-medium text-gray-900">Multi-Leg Booking</div>
                              {multiLegInfo.map((leg: { legNumber: number; origin: string; destination: string; rate: string }, index: number) => (
                                <div key={index} className="text-xs text-gray-500">
                                  Leg {leg.legNumber}: {leg.origin} → {leg.destination}
                                </div>
                              ))}
                            </>
                          );
                        }
                        // Handle both predefined routes and custom origin/destination bookings
                        const routeName = booking.route?.name || booking.routeName || 'Custom Route';
                        const origin = booking.route?.origin || booking.origin;
                        const destination = booking.route?.destination || booking.destination;
                        
                        return (
                          <>
                            <div className="text-sm font-medium text-gray-900">{routeName}</div>
                            <div className="text-sm text-gray-500">{origin} → {destination}</div>
                            {booking.routeFrequency && (
                              <div className="text-xs text-gray-400">{booking.routeFrequency}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {format(new Date(booking.bookingDate), 'MMM dd, yyyy')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                    ${booking.rate}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(booking.status)}`}>
                    {booking.status === 'PENDING' ? 'UNBOOKED' : booking.status === 'CONFIRMED' ? 'BOOKED' : booking.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center gap-2 justify-end">
                    <button 
                      onClick={() => handleViewBooking(booking)}
                      className="text-gray-500 hover:text-blue-600 transition-colors"
                      title="View booking details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {getConfirmationStatusIcon(booking)}
                      <button 
                        onClick={() => handleRateConfirmation(booking)}
                        className="text-gray-500 hover:text-green-600 transition-colors"
                        title="Rate confirmation"
                        disabled={!booking.carrier}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => handlePostLoad(booking)}
                      className="text-gray-500 hover:text-purple-600 transition-colors"
                      title="Post a Load"
                    >
                      <Truck className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteBooking(booking)}
                      className="text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete booking"
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

      {filteredAndSortedBookings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No bookings found matching your criteria.</p>
        </div>
      )}

      {/* View Booking Modal */}
      {viewingBooking && (
        <BookingViewModal 
          booking={viewingBooking} 
          onClose={handleCloseView} 
          getStatusBadge={getStatusBadge}
          settingsData={settingsData}
          onRateConfirmation={handleRateConfirmation}
        />
      )}


      {/* Delete Booking Confirmation Modal */}
      {deletingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Booking</h3>
                <p className="text-sm text-gray-600">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2">
                Are you sure you want to delete this booking?
              </p>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm font-medium text-gray-900">#{deletingBooking.id}</p>
                <p className="text-sm text-gray-600">
                  {deletingBooking.carrier?.name || 'Unbooked'} - {deletingBooking.route?.name}
                </p>
                <p className="text-sm text-gray-600">
                  {format(new Date(deletingBooking.bookingDate), 'MMM dd, yyyy')} - ${deletingBooking.rate}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCloseDelete}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteBookingMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteBookingMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Confirmation Modal */}
      {rateConfirmationBooking && (
        <RateConfirmationModal
          booking={rateConfirmationBooking}
          onClose={handleCloseRateConfirmation}
          onEmail={handleEmailRateConfirmation}
        />
      )}
    </div>
  );
};

// Booking View Modal Component
interface BookingViewModalProps {
  booking: Booking;
  onClose: () => void;
  getStatusBadge: (status: string) => string;
  onRateConfirmation?: (booking: Booking) => void;
  settingsData?: any;
}

const BookingViewModal: React.FC<BookingViewModalProps> = ({ booking, onClose, getStatusBadge, onRateConfirmation, settingsData }) => {
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for managing leg manifest numbers in notes-based multi-leg bookings
  const [legManifestNumbers, setLegManifestNumbers] = useState<Record<number, string>>({});
  
  // State for document management
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(null);
  
  // Fetch complete booking details with child bookings
  const { data: fullBookingData } = useQuery({
    queryKey: ['booking', booking.id],
    queryFn: async () => {
      const response = await api.get(`/bookings/${booking.id}`);
      return response.data;
    }
  });

  // Use full booking data if available, otherwise fall back to passed booking
  const bookingToDisplay = fullBookingData || booking;
  
  // Initialize leg manifest numbers from notes when booking data changes
  useEffect(() => {
    if (bookingToDisplay?.notes && bookingToDisplay.notes.includes('--- Multi-Leg Booking ---')) {
      const manifestNumbers: Record<number, string> = {};
      const multiLegInfo = parseMultiLegBooking(bookingToDisplay.notes);
      
      if (multiLegInfo) {
        multiLegInfo.forEach((leg: any) => {
          manifestNumbers[leg.legNumber] = leg.manifestNumber || '';
        });
        setLegManifestNumbers(manifestNumbers);
      }
    }
  }, [bookingToDisplay]);
  
  // Form data for edit mode
  const [formData, setFormData] = useState({
    carrierId: bookingToDisplay.carrierId || '',
    rate: Number(bookingToDisplay.rate) || 0,
    status: bookingToDisplay.status || 'PENDING',
    notes: bookingToDisplay.notes || '',
    driverName: bookingToDisplay.driverName || '',
    phoneNumber: bookingToDisplay.phoneNumber || '',
    carrierEmail: bookingToDisplay.carrierEmail || '',
    carrierReportTime: bookingToDisplay.carrierReportTime || '',
    type: bookingToDisplay.type || 'POWER_ONLY',
    trailerLength: bookingToDisplay.trailerLength ? bookingToDisplay.trailerLength.toString() : '',
    bookingDate: bookingToDisplay.bookingDate ? new Date(bookingToDisplay.bookingDate).toISOString().split('T')[0] : '',
    rateType: bookingToDisplay.rateType || 'FLAT_RATE',
    baseRate: Number(bookingToDisplay.baseRate) || 0,
    fscRate: Number(bookingToDisplay.fscRate) || 0,
    routeId: bookingToDisplay.routeId || null,
    manifestNumber: bookingToDisplay.manifestNumber || ''
  });

  // Fetch routes for distance lookup
  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await api.get('/routes?limit=2000'); // Fetch all routes (max allowed)
      return response.data;
    }
  });

  // Fetch carriers for edit mode
  const { data: carriersData } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await api.get('/carriers?limit=1000');
      return response.data;
    },
    enabled: isEditMode
  });

  // Helper function to get distance for a leg by looking up route in database
  const getDistanceForLeg = (origin: string, destination: string): number => {
    if (!routesData?.routes) {
      console.warn('Routes data not available for distance lookup');
      return 258; // Default fallback based on your example
    }
    
    // Clean up location codes (remove any extra info like state codes)
    const cleanLocation = (loc: string) => {
      // Extract just the location code (e.g., "FAR" from "FAR - Fargo" or just "FAR")
      const match = loc.match(/^([A-Z]{3,4})\b/);
      return match ? match[1] : loc.toUpperCase().trim();
    };
    
    const legOriginClean = cleanLocation(origin);
    const legDestinationClean = cleanLocation(destination);
    
    // Find matching route by origin and destination
    const matchingRoute = routesData.routes.find((route: any) => {
      const routeOrigin = cleanLocation(route.origin || '');
      const routeDestination = cleanLocation(route.destination || '');
      
      return routeOrigin === legOriginClean && routeDestination === legDestinationClean;
    });
    
    if (matchingRoute && matchingRoute.distance) {
      const distance = Number(matchingRoute.distance);
      console.log(`Found route distance for ${origin} → ${destination}: ${distance} miles`);
      return distance;
    }
    
    // Try reverse direction
    const reverseRoute = routesData.routes.find((route: any) => {
      const routeOrigin = cleanLocation(route.origin || '');
      const routeDestination = cleanLocation(route.destination || '');
      
      return routeOrigin === legDestinationClean && routeDestination === legOriginClean;
    });
    
    if (reverseRoute && reverseRoute.distance) {
      const distance = Number(reverseRoute.distance);
      console.log(`Found reverse route distance for ${destination} → ${origin}: ${distance} miles`);
      return distance;
    }
    
    console.warn(`No route found for ${origin} → ${destination}, using default distance`);
    return 258; // Default distance based on your example
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    
    try {
      const payload = {
        carrierId: formData.carrierId || null,
        rate: Number(formData.rate),
        status: formData.status,
        notes: formData.notes.trim() || null,
        driverName: formData.driverName.trim() || null,
        phoneNumber: formData.phoneNumber.trim() || null,
        carrierEmail: formData.carrierEmail.trim() || null,
        carrierReportTime: formData.carrierReportTime.trim() || null,
        type: formData.type,
        trailerLength: formData.trailerLength ? Number(formData.trailerLength) : null,
        bookingDate: formData.bookingDate || null,
        rateType: formData.rateType,
        baseRate: Number(formData.baseRate),
        fscRate: Number(formData.fscRate),
        routeId: formData.routeId || null,
        manifestNumber: formData.manifestNumber.trim() || null
      };
      
      await api.put(`/bookings/${bookingToDisplay.id}`, payload);
      
      // Update the bookings cache
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking', bookingToDisplay.id] });
      
      // Exit edit mode
      setIsEditMode(false);
      
      alert('Booking updated successfully');
    } catch (error: any) {
      console.error('Update failed:', error);
      alert(error.response?.data?.message || 'Failed to update booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to update notes with manifest numbers for multi-leg bookings
  const updateNotesWithManifestNumbers = (originalNotes: string, manifestNumbers: Record<number, string>): string => {
    if (!originalNotes || !originalNotes.includes('--- Multi-Leg Booking ---')) {
      return originalNotes;
    }
    
    const lines = originalNotes.split('\n');
    const updatedLines = lines.map(line => {
      const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\([^$)]+\))?\s*\(\$(.+)\)(?:\s*\[Manifest:\s*([^\]]*)\])?$/);
      if (legMatch) {
        const legNumber = parseInt(legMatch[1]);
        const origin = legMatch[2];
        const destination = legMatch[3];
        const rate = legMatch[4];
        const manifestNumber = manifestNumbers[legNumber] || '';
        
        if (manifestNumber) {
          return `Leg ${legNumber}: ${origin} → ${destination} ($${rate}) [Manifest: ${manifestNumber}]`;
        } else {
          return `Leg ${legNumber}: ${origin} → ${destination} ($${rate})`;
        }
      }
      return line;
    });
    
    return updatedLines.join('\n');
  };

  // Function to update leg manifest number
  const updateLegManifestNumber = async (legNumber: number, manifestNumber: string) => {
    try {
      // Update local state
      const updatedManifestNumbers = {
        ...legManifestNumbers,
        [legNumber]: manifestNumber
      };
      setLegManifestNumbers(updatedManifestNumbers);
      
      // Update the notes with the new manifest numbers
      const updatedNotes = updateNotesWithManifestNumbers(bookingToDisplay.notes || '', updatedManifestNumbers);
      
      // Save to backend
      await api.put(`/bookings/${bookingToDisplay.id}`, { notes: updatedNotes });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['booking', bookingToDisplay.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    } catch (error: any) {
      console.error('Failed to update manifest number:', error);
      alert(error.response?.data?.message || 'Failed to update manifest number');
    }
  };

  // Function to generate upload token
  const generateUploadToken = async () => {
    try {
      const response = await api.post(`/bookings/${bookingToDisplay.id}/generate-upload-token`);
      return response.data.documentUploadToken;
    } catch (error: any) {
      console.error('Failed to generate upload token:', error);
      throw error;
    }
  };

  // Document upload function
  const handleDocumentUpload = async () => {
    if (!selectedFile || !documentType) {
      alert('Please select a file and document type');
      return;
    }

    setUploadingDocument(true);
    try {
      let uploadToken = bookingToDisplay.documentUploadToken;

      // If no token exists, generate one
      if (!uploadToken) {
        try {
          uploadToken = await generateUploadToken();
          // Refresh booking data to get the new token
          queryClient.invalidateQueries({ queryKey: ['booking', bookingToDisplay.id] });
        } catch (tokenError: any) {
          alert('Failed to generate upload token. Please try again.');
          return;
        }
      }

      const formData = new FormData();
      formData.append('documents', selectedFile);
      formData.append('documentType', documentType);

      await api.post(`/documents/upload/${uploadToken}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Reset form
      setSelectedFile(null);
      setDocumentType('');
      
      // Refresh booking data
      queryClient.invalidateQueries({ queryKey: ['booking', bookingToDisplay.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      alert('Document uploaded successfully');
    } catch (error: any) {
      console.error('Upload failed:', error);
      const errorMessage = error.response?.data?.message || 'Failed to upload document';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setUploadingDocument(false);
    }
  };

  // Document delete function
  const handleDocumentDelete = async (documentId: number) => {
    setDeletingDocumentId(documentId);
    try {
      // Use the correct booking documents API endpoint
      await api.delete(`/documents/${documentId}`);
      
      // Refresh booking data
      queryClient.invalidateQueries({ queryKey: ['booking', bookingToDisplay.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      alert('Document deleted successfully');
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(error.response?.data?.message || 'Failed to delete document');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      carrierId: bookingToDisplay.carrierId || '',
      rate: Number(bookingToDisplay.rate) || 0,
      status: bookingToDisplay.status || 'PENDING',
      notes: bookingToDisplay.notes || '',
      driverName: bookingToDisplay.driverName || '',
      phoneNumber: bookingToDisplay.phoneNumber || '',
      carrierEmail: bookingToDisplay.carrierEmail || '',
      carrierReportTime: bookingToDisplay.carrierReportTime || '',
      type: bookingToDisplay.type || 'POWER_ONLY',
      trailerLength: bookingToDisplay.trailerLength ? bookingToDisplay.trailerLength.toString() : '',
      bookingDate: bookingToDisplay.bookingDate ? new Date(bookingToDisplay.bookingDate).toISOString().split('T')[0] : '',
      rateType: bookingToDisplay.rateType || 'FLAT_RATE',
      baseRate: Number(bookingToDisplay.baseRate) || 0,
      fscRate: Number(bookingToDisplay.fscRate) || 0,
      routeId: bookingToDisplay.routeId || null,
      manifestNumber: bookingToDisplay.manifestNumber || ''
    });
    
    // Reset leg manifest numbers for notes-based multi-leg bookings
    if (bookingToDisplay?.notes && bookingToDisplay.notes.includes('--- Multi-Leg Booking ---')) {
      const manifestNumbers: Record<number, string> = {};
      const multiLegInfo = parseMultiLegBooking(bookingToDisplay.notes);
      
      if (multiLegInfo) {
        multiLegInfo.forEach((leg: any) => {
          manifestNumbers[leg.legNumber] = leg.manifestNumber || '';
        });
        setLegManifestNumbers(manifestNumbers);
      }
    }
    
    // Reset document upload form
    setSelectedFile(null);
    setDocumentType('');
    setUploadingDocument(false);
    setDeletingDocumentId(null);
    
    setIsEditMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Booking Details #{bookingToDisplay.id}</h2>
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
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              {isEditMode ? (
                <select
                  value={formData.carrierId}
                  onChange={(e) => setFormData({...formData, carrierId: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Carrier</option>
                  {carriersData?.carriers?.map((carrier: any) => (
                    <option key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-900">{bookingToDisplay.carrier?.name || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              {isEditMode ? (
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="PENDING">UNBOOKED</option>
                  <option value="CONFIRMED">BOOKED</option>
                  <option value="IN_TRANSIT">IN TRANSIT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              ) : (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(bookingToDisplay.status)}`}>
                  {bookingToDisplay.status === 'PENDING' ? 'UNBOOKED' : bookingToDisplay.status === 'CONFIRMED' ? 'BOOKED' : bookingToDisplay.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter driver name"
                />
              ) : (
                <p className="text-sm text-gray-900">{bookingToDisplay.driverName || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              {isEditMode ? (
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm text-gray-900">{bookingToDisplay.phoneNumber || 'N/A'}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Email</label>
              {isEditMode ? (
                <input
                  type="email"
                  value={formData.carrierEmail}
                  onChange={(e) => setFormData({...formData, carrierEmail: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter carrier email"
                />
              ) : (
                <p className="text-sm text-gray-900">{bookingToDisplay.carrierEmail || 'N/A'}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Report Time</label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formData.carrierReportTime}
                  onChange={(e) => setFormData({...formData, carrierReportTime: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter report time"
                />
              ) : (
                <p className="text-sm text-gray-900">{bookingToDisplay.carrierReportTime || 'N/A'}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              {isEditMode ? (
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="POWER_ONLY">Power Only</option>
                  <option value="POWER_AND_TRAILER">Power and Trailer</option>
                </select>
              ) : (
                <p className="text-sm text-gray-900">
                  {bookingToDisplay.type === 'POWER_ONLY' ? 'Power Only' : 'Power and Trailer'}
                </p>
              )}
            </div>
            {(isEditMode ? formData.type === 'POWER_AND_TRAILER' : bookingToDisplay.type === 'POWER_AND_TRAILER') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trailer Length</label>
                {isEditMode ? (
                  <input
                    type="number"
                    value={formData.trailerLength}
                    onChange={(e) => setFormData({...formData, trailerLength: e.target.value})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter trailer length in feet"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{bookingToDisplay.trailerLength} feet</p>
                )}
              </div>
            )}
          </div>

          {/* Booking Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking Date</label>
            {isEditMode ? (
              <input
                type="date"
                value={formData.bookingDate}
                onChange={(e) => setFormData({...formData, bookingDate: e.target.value})}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-900">
                {bookingToDisplay.bookingDate ? new Date(bookingToDisplay.bookingDate).toLocaleDateString() : 'N/A'}
              </p>
            )}
          </div>
          
          {/* Route Information - Multi-leg vs Single-leg display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Information</label>
            
            {/* Route Selection in Edit Mode */}
            {isEditMode && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Route</label>
                <select
                  value={formData.routeId || ''}
                  onChange={(e) => setFormData({...formData, routeId: e.target.value ? parseInt(e.target.value) : null})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a route</option>
                  {routesData?.routes?.map((route: any) => (
                    <option key={route.id} value={route.id}>
                      {route.origin} → {route.destination} ({route.distance} miles)
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              {(() => {
                // Prefer child bookings data over notes parsing
                const hasChildBookings = bookingToDisplay.childBookings && bookingToDisplay.childBookings.length > 0;
                const multiLegInfo = parseMultiLegBooking(bookingToDisplay.notes || null);
                
                return hasChildBookings ? (
                  // Multi-leg booking display using actual child booking data
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Multi-Leg Journey ({bookingToDisplay.childBookings.length} legs)
                    </div>
                    
                    {/* Show all legs using child booking data */}
                    <div className="space-y-3">
                      {bookingToDisplay.childBookings.map((childBooking: Booking, index: number) => {
                        return (
                          <div key={childBooking.id} className="bg-white p-4 rounded border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                              <div className="font-medium text-sm text-gray-900">
                                Leg {childBooking.legNumber}: {childBooking.route?.origin} → {childBooking.route?.destination}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">
                                  {childBooking.route?.distance || 0} miles
                                </div>
                                <div className="text-xs text-gray-500">
                                  ${childBooking.rate}
                                </div>
                              </div>
                            </div>
                            
                            {/* Manifest Number field for each leg */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Manifest Number</label>
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={childBooking.manifestNumber || ''}
                                  onChange={(e) => {
                                    // For actual child bookings, we'd need a different update function
                                    // This would require individual API calls to update each child booking
                                  }}
                                  className="w-full p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500 bg-gray-100"
                                  placeholder="Enter manifest number"
                                  readOnly
                                  title="Child booking manifest editing not yet implemented"
                                />
                              ) : (
                                <p className="text-xs text-gray-600">
                                  {childBooking.manifestNumber || 'No manifest number set'}
                                </p>
                              )}
                            </div>
                            
                            {/* Detailed address information */}
                            {childBooking.route && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Origin Information */}
                                <div className="space-y-1">
                                  <h5 className="font-medium text-gray-700">Origin</h5>
                                  <div className="text-gray-600 space-y-1">
                                    <div className="font-medium">{childBooking.route.origin}</div>
                                    {childBooking.route.originAddress && (
                                      <div>{childBooking.route.originAddress}</div>
                                    )}
                                    {(childBooking.route.originCity || childBooking.route.originState || childBooking.route.originZipCode) && (
                                      <div>
                                        {childBooking.route.originCity && `${childBooking.route.originCity}, `}
                                        {childBooking.route.originState && `${childBooking.route.originState} `}
                                        {childBooking.route.originZipCode}
                                      </div>
                                    )}
                                    {childBooking.route.originContact && (
                                      <div className="text-xs text-gray-500">Contact: {childBooking.route.originContact}</div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Destination Information */}
                                <div className="space-y-1">
                                  <h5 className="font-medium text-gray-700">Destination</h5>
                                  <div className="text-gray-600 space-y-1">
                                    <div className="font-medium">{childBooking.route.destination}</div>
                                    {childBooking.route.destinationAddress && (
                                      <div>{childBooking.route.destinationAddress}</div>
                                    )}
                                    {(childBooking.route.destinationCity || childBooking.route.destinationState || childBooking.route.destinationZipCode) && (
                                      <div>
                                        {childBooking.route.destinationCity && `${childBooking.route.destinationCity}, `}
                                        {childBooking.route.destinationState && `${childBooking.route.destinationState} `}
                                        {childBooking.route.destinationZipCode}
                                      </div>
                                    )}
                                    {childBooking.route.destinationContact && (
                                      <div className="text-xs text-gray-500">Contact: {childBooking.route.destinationContact}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Total distance using actual child booking data */}
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                      Total Distance: {bookingToDisplay.childBookings.reduce((total: number, child: Booking) => {
                        return total + (child.route?.distance || 0);
                      }, 0)} miles
                    </div>
                  </div>
                ) : multiLegInfo ? (
                  // Multi-leg booking display using notes parsing (fallback)
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Multi-Leg Journey ({multiLegInfo.length} legs)
                    </div>
                    
                    {/* Show all legs */}
                    <div className="space-y-3">
                      {multiLegInfo.map((leg: any, index: number) => {
                        const legDistance = getDistanceForLeg(leg.origin, leg.destination);
                        
                        // Find route details for this leg
                        const legRoute = routesData?.routes.find((route: any) => {
                          const routeOrigin = route.origin?.toLowerCase().trim();
                          const routeDestination = route.destination?.toLowerCase().trim();
                          const legOrigin = leg.origin.toLowerCase().trim();
                          const legDestination = leg.destination.toLowerCase().trim();
                          return routeOrigin === legOrigin && routeDestination === legDestination;
                        });
                        
                        return (
                          <div key={index} className="bg-white p-4 rounded border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                              <div className="font-medium text-sm text-gray-900">
                                Leg {leg.legNumber}: {leg.origin} → {leg.destination}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">
                                  {legDistance} miles
                                </div>
                                <div className="text-xs text-gray-500">
                                  ${leg.rate}
                                </div>
                              </div>
                            </div>
                            
                            {/* Manifest Number field for each leg */}
                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-1">Manifest Number</label>
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={legManifestNumbers[leg.legNumber] || ''}
                                  onChange={(e) => setLegManifestNumbers(prev => ({
                                    ...prev,
                                    [leg.legNumber]: e.target.value
                                  }))}
                                  onBlur={(e) => updateLegManifestNumber(leg.legNumber, e.target.value)}
                                  className="w-full p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Enter manifest number"
                                />
                              ) : (
                                <p className="text-xs text-gray-600">
                                  {leg.manifestNumber || 'No manifest number set'}
                                </p>
                              )}
                            </div>
                            
                            {/* Detailed address information if available */}
                            {legRoute && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                {/* Origin Information */}
                                <div className="space-y-1">
                                  <h5 className="font-medium text-gray-700">Origin</h5>
                                  <div className="text-gray-600 space-y-1">
                                    <div className="font-medium">{legRoute.origin}</div>
                                    {legRoute.originAddress && (
                                      <div>{legRoute.originAddress}</div>
                                    )}
                                    {(legRoute.originCity || legRoute.originState || legRoute.originZipCode) && (
                                      <div>
                                        {legRoute.originCity && `${legRoute.originCity}, `}
                                        {legRoute.originState && `${legRoute.originState} `}
                                        {legRoute.originZipCode}
                                      </div>
                                    )}
                                    {legRoute.originContact && (
                                      <div className="text-xs text-gray-500">Contact: {legRoute.originContact}</div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Destination Information */}
                                <div className="space-y-1">
                                  <h5 className="font-medium text-gray-700">Destination</h5>
                                  <div className="text-gray-600 space-y-1">
                                    <div className="font-medium">{legRoute.destination}</div>
                                    {legRoute.destinationAddress && (
                                      <div>{legRoute.destinationAddress}</div>
                                    )}
                                    {(legRoute.destinationCity || legRoute.destinationState || legRoute.destinationZipCode) && (
                                      <div>
                                        {legRoute.destinationCity && `${legRoute.destinationCity}, `}
                                        {legRoute.destinationState && `${legRoute.destinationState} `}
                                        {legRoute.destinationZipCode}
                                      </div>
                                    )}
                                    {legRoute.destinationContact && (
                                      <div className="text-xs text-gray-500">Contact: {legRoute.destinationContact}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Total distance */}
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                      Total Distance: {multiLegInfo.reduce((total: number, leg: any) => {
                        return total + getDistanceForLeg(leg.origin, leg.destination);
                      }, 0)} miles
                    </div>
                  </div>
                ) : bookingToDisplay.route ? (
                  // Single-leg booking display (existing behavior)
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      {bookingToDisplay.route.name}
                    </div>
                    
                    {/* Manifest Number field */}
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Manifest Number</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.manifestNumber}
                          onChange={(e) => setFormData({...formData, manifestNumber: e.target.value})}
                          className="w-full p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter manifest number"
                        />
                      ) : (
                        <p className="text-xs text-gray-600">
                          {bookingToDisplay.manifestNumber || 'No manifest number set'}
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Origin Information */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800 text-sm">Origin</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="font-medium">{bookingToDisplay.route.origin}</div>
                          {bookingToDisplay.route.originAddress && (
                            <div>{bookingToDisplay.route.originAddress}</div>
                          )}
                          {(bookingToDisplay.route.originCity || bookingToDisplay.route.originState || bookingToDisplay.route.originZipCode) && (
                            <div>
                              {bookingToDisplay.route.originCity && `${bookingToDisplay.route.originCity}, `}
                              {bookingToDisplay.route.originState && `${bookingToDisplay.route.originState} `}
                              {bookingToDisplay.route.originZipCode}
                            </div>
                          )}
                          {bookingToDisplay.route.originContact && (
                            <div className="text-xs text-gray-500">Contact: {bookingToDisplay.route.originContact}</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Destination Information */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800 text-sm">Destination</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="font-medium">{bookingToDisplay.route.destination}</div>
                          {bookingToDisplay.route.destinationAddress && (
                            <div>{bookingToDisplay.route.destinationAddress}</div>
                          )}
                          {(bookingToDisplay.route.destinationCity || bookingToDisplay.route.destinationState || bookingToDisplay.route.destinationZipCode) && (
                            <div>
                              {bookingToDisplay.route.destinationCity && `${bookingToDisplay.route.destinationCity}, `}
                              {bookingToDisplay.route.destinationState && `${bookingToDisplay.route.destinationState} `}
                              {bookingToDisplay.route.destinationZipCode}
                            </div>
                          )}
                          {bookingToDisplay.route.destinationContact && (
                            <div className="text-xs text-gray-500">Contact: {bookingToDisplay.route.destinationContact}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {bookingToDisplay.route.distance && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        Distance: {bookingToDisplay.route.distance} miles
                      </div>
                    )}
                  </div>
                ) : (bookingToDisplay.origin || bookingToDisplay.destination) ? (
                  // Custom origin/destination booking display
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      {bookingToDisplay.routeName || 'Custom Route'}
                    </div>
                    {bookingToDisplay.routeFrequency && (
                      <div className="text-xs text-gray-500 mb-2">Frequency: {bookingToDisplay.routeFrequency}</div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Origin Information */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800 text-sm">Origin</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="font-medium">{bookingToDisplay.origin}</div>
                          {bookingToDisplay.originAddress && (
                            <div>{bookingToDisplay.originAddress}</div>
                          )}
                          {(bookingToDisplay.originCity || bookingToDisplay.originState || bookingToDisplay.originZipCode) && (
                            <div>
                              {bookingToDisplay.originCity && `${bookingToDisplay.originCity}, `}
                              {bookingToDisplay.originState && `${bookingToDisplay.originState} `}
                              {bookingToDisplay.originZipCode}
                            </div>
                          )}
                          {bookingToDisplay.originContact && (
                            <div className="text-xs text-gray-500">Contact: {bookingToDisplay.originContact}</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Destination Information */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-800 text-sm">Destination</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="font-medium">{bookingToDisplay.destination}</div>
                          {bookingToDisplay.destinationAddress && (
                            <div>{bookingToDisplay.destinationAddress}</div>
                          )}
                          {(bookingToDisplay.destinationCity || bookingToDisplay.destinationState || bookingToDisplay.destinationZipCode) && (
                            <div>
                              {bookingToDisplay.destinationCity && `${bookingToDisplay.destinationCity}, `}
                              {bookingToDisplay.destinationState && `${bookingToDisplay.destinationState} `}
                              {bookingToDisplay.destinationZipCode}
                            </div>
                          )}
                          {bookingToDisplay.destinationContact && (
                            <div className="text-xs text-gray-500">Contact: {bookingToDisplay.destinationContact}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {bookingToDisplay.estimatedMiles && (
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        Distance: {bookingToDisplay.estimatedMiles} miles
                      </div>
                    )}
                    
                    {/* Time Information */}
                    {(bookingToDisplay.departureTime || bookingToDisplay.arrivalTime) && (
                      <div className="text-xs text-gray-500 pt-1">
                        {bookingToDisplay.departureTime && `Departure: ${bookingToDisplay.departureTime}`}
                        {bookingToDisplay.departureTime && bookingToDisplay.arrivalTime && ' • '}
                        {bookingToDisplay.arrivalTime && `Arrival: ${bookingToDisplay.arrivalTime}`}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Date</label>
              <p className="text-sm text-gray-900">{format(new Date(bookingToDisplay.bookingDate), 'MMM dd, yyyy')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
              {isEditMode ? (
                <select
                  value={formData.rateType}
                  onChange={(e) => setFormData({...formData, rateType: e.target.value})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="FLAT_RATE">Flat Rate</option>
                  <option value="MILE">Per Mile</option>
                  <option value="MILE_FSC">Per Mile + FSC</option>
                </select>
              ) : (
                <p className="text-sm text-gray-900">
                  {bookingToDisplay.rateType === 'MILE' ? 'Per Mile' : 
                   bookingToDisplay.rateType === 'MILE_FSC' ? 'Per Mile + FSC' :
                   bookingToDisplay.rateType === 'FLAT_RATE' ? 'Flat Rate' : 'Unknown'}
                </p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {((isEditMode ? formData.rateType !== 'FLAT_RATE' : bookingToDisplay.rateType !== 'FLAT_RATE') || (isEditMode && formData.rateType !== 'FLAT_RATE')) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Rate</label>
                {isEditMode ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.baseRate}
                    onChange={(e) => setFormData({...formData, baseRate: parseFloat(e.target.value) || 0})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-sm text-gray-900">${bookingToDisplay.baseRate}</p>
                )}
              </div>
            )}
            {((isEditMode ? formData.rateType === 'MILE_FSC' : bookingToDisplay.rateType === 'MILE_FSC')) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FSC Rate (%)</label>
                {isEditMode ? (
                  <input
                    type="number"
                    step="0.01"
                    value={formData.fscRate}
                    onChange={(e) => setFormData({...formData, fscRate: parseFloat(e.target.value) || 0})}
                    className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {bookingToDisplay.fscRate || settingsData?.fuelSurchargeRate || 0}%
                    {(!bookingToDisplay.fscRate && settingsData?.fuelSurchargeRate) && (
                      <span className="text-xs text-gray-500 ml-1">(current system rate)</span>
                    )}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Rate</label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({...formData, rate: parseFloat(e.target.value) || 0})}
                  className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              ) : (
                <p className="text-sm text-gray-900 font-medium text-green-600">${bookingToDisplay.rate}</p>
              )}
            </div>
          </div>

          {/* Line Items Section */}
          <BookingLineItems 
            bookingId={bookingToDisplay.id} 
            isReadOnly={false}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            {isEditMode ? (
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                rows={3}
                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter booking notes"
              />
            ) : (
              bookingToDisplay.notes ? (
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{bookingToDisplay.notes}</p>
              ) : (
                <p className="text-sm text-gray-500">No notes</p>
              )
            )}
          </div>
          
          {/* Rate Confirmation Status */}
          {(bookingToDisplay.confirmationSentAt || bookingToDisplay.confirmationSignedAt || bookingToDisplay.signedPdfPath) && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Rate Confirmation Status</h3>
              
              <div className="space-y-3">
                {bookingToDisplay.confirmationSentAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="w-4 h-4 text-blue-500" />
                    <span>
                      Sent via {bookingToDisplay.confirmationSentVia} on {format(new Date(bookingToDisplay.confirmationSentAt), 'PPp')}
                    </span>
                  </div>
                )}
                
                {bookingToDisplay.confirmationSignedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>
                      Signed by {bookingToDisplay.confirmationSignedBy} on {format(new Date(bookingToDisplay.confirmationSignedAt), 'PPp')}
                    </span>
                  </div>
                )}
                
                {bookingToDisplay.signedPdfPath && (
                  <div className="mt-3">
                    <button
                      onClick={async () => {
                        try {
                          const response = await api.get(`/bookings/${bookingToDisplay.id}/signed-pdf`, {
                            responseType: 'blob'
                          });
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', `signed-rate-confirmation-${bookingToDisplay.id}.pdf`);
                          link.setAttribute('target', '_blank');
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Failed to download signed PDF:', error);
                          alert('Failed to download signed PDF. Please try again.');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View Signed Rate Confirmation
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Documents Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Documents</label>
            
            {/* Document Upload Form */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Upload New Document</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Document Type</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select document type</option>
                      <option value="POD">Proof of Delivery</option>
                      <option value="BOL">Bill of Lading</option>
                      <option value="INVOICE">Invoice</option>
                      <option value="RECEIPT">Receipt</option>
                      <option value="MANIFEST">Manifest</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">File</label>
                    <input
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                  </div>
                </div>
                <button
                  onClick={handleDocumentUpload}
                  disabled={!selectedFile || !documentType || uploadingDocument}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </div>

            {/* Existing Documents */}
            {bookingToDisplay.documents && bookingToDisplay.documents.length > 0 ? (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Uploaded Documents</h4>
                {bookingToDisplay.documents.map((document: any) => (
                  <div key={document.id} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{document.filename}</div>
                        <div className="text-xs text-gray-500">
                          {document.documentType} • Uploaded {format(new Date(document.uploadedAt), 'MMM dd, yyyy HH:mm')}
                          {document.uploadedBy && ` by ${document.uploadedBy}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Open document in new tab for viewing/download using correct endpoint
                          window.open(`/api/documents/download/${document.id}`, '_blank');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this document?')) {
                            handleDocumentDelete(document.id);
                          }
                        }}
                        disabled={deletingDocumentId === document.id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {deletingDocumentId === document.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Uploaded Documents</h4>
                <div className="text-center text-gray-500 text-sm">
                  No documents uploaded yet
                </div>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mt-4 pt-4 border-t">
            <div>
              <label className="block font-medium mb-1">Created</label>
              <p>{format(new Date(bookingToDisplay.createdAt), 'MMM dd, yyyy HH:mm')}</p>
            </div>
            <div>
              <label className="block font-medium mb-1">Last Updated</label>
              <p>{format(new Date(bookingToDisplay.updatedAt), 'MMM dd, yyyy HH:mm')}</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between mt-6 pt-4 border-t">
          <div className="flex gap-2">
            {onRateConfirmation && (
              <button 
                onClick={() => {
                  onClose();
                  onRateConfirmation(bookingToDisplay);
                }}
                disabled={!bookingToDisplay.carrier}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Rate Confirmation
              </button>
            )}
            {bookingToDisplay.status === 'COMPLETED' && !bookingToDisplay.invoice && (
              <button
                onClick={async () => {
                  try {
                    const response = await api.post('/invoices', { 
                      bookingId: bookingToDisplay.id 
                    });
                    alert('Invoice generated successfully!');
                    onClose();
                    // Refresh bookings data
                    window.location.reload();
                  } catch (error: any) {
                    alert(error.response?.data?.error || 'Failed to generate invoice');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Generate Invoice
              </button>
            )}
            {bookingToDisplay.invoice && (
              <button
                onClick={() => {
                  // Navigate to invoice page
                  window.location.href = '/invoices?invoiceId=' + bookingToDisplay.invoice.id;
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Invoice
              </button>
            )}
          </div>
          {isEditMode ? (
            <div className="flex gap-2">
              <button 
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
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
    </div>
  );
};

