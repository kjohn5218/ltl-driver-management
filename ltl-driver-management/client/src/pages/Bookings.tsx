import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, sendRateConfirmationEmail } from '../services/api';
import { Booking } from '../types';
import { Plus, Search, Edit, Eye, Calendar, MapPin, User, DollarSign, X, ChevronUp, ChevronDown, Trash2, FileText, CheckCircle, Clock, Send, Truck } from 'lucide-react';
import { format, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import { RouteDetails } from '../components/LocationDisplay';
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
    // Updated regex to handle optional date information: "Leg 1: A → B (May 15) ($100.00)"
    const legMatch = line.match(/^Leg (\d+): (.+) → (.+?)(?:\s*\([^$)]+\))?\s*\(\$(.+)\)$/);
    if (legMatch) {
      legs.push({
        legNumber: parseInt(legMatch[1]),
        origin: legMatch[2],
        destination: legMatch[3],
        rate: legMatch[4]
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
  const [sortField, setSortField] = useState<SortField>('bookingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
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
      
      return matchesSearch && matchesStatus && matchesDate && matchesRateConfirmation;
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
  }, [bookings, searchTerm, statusFilter, dateFromFilter, dateToFilter, sortField, sortDirection]);

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

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
  };

  const handlePostLoad = (booking: Booking) => {
    setEditingBooking(booking);
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

  const handleCloseEdit = () => {
    setEditingBooking(null);
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
                  #{booking.id}
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
                        return (
                          <>
                            <div className="text-sm font-medium text-gray-900">{booking.route?.name}</div>
                            <div className="text-sm text-gray-500">{booking.route?.origin} → {booking.route?.destination}</div>
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
                    <button 
                      onClick={() => handleEditBooking(booking)}
                      className="text-gray-500 hover:text-blue-600 transition-colors"
                      title="Edit booking"
                    >
                      <Edit className="w-4 h-4" />
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
          onRateConfirmation={handleRateConfirmation}
        />
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <BookingEditModal 
          booking={editingBooking} 
          onClose={handleCloseEdit} 
          onSave={(_updatedBooking) => {
            setEditingBooking(null);
            // Invalidate and refetch bookings data
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
          }}
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
}

const BookingViewModal: React.FC<BookingViewModalProps> = ({ booking, onClose, getStatusBadge, onRateConfirmation }) => {
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

  // Fetch routes for distance lookup
  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await api.get('/routes?limit=2000'); // Fetch all routes (max allowed)
      return response.data;
    }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Booking Details #{bookingToDisplay.id}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              <p className="text-sm text-gray-900">{bookingToDisplay.carrier?.name || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(bookingToDisplay.status)}`}>
                {bookingToDisplay.status === 'PENDING' ? 'UNBOOKED' : bookingToDisplay.status === 'CONFIRMED' ? 'BOOKED' : bookingToDisplay.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <p className="text-sm text-gray-900">{bookingToDisplay.driverName || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <p className="text-sm text-gray-900">{bookingToDisplay.phoneNumber || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Email</label>
              <p className="text-sm text-gray-900">{bookingToDisplay.carrierEmail || 'N/A'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Report Time</label>
              <p className="text-sm text-gray-900">{bookingToDisplay.carrierReportTime || 'N/A'}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <p className="text-sm text-gray-900">
                {bookingToDisplay.type === 'POWER_ONLY' ? 'Power Only' : 'Power and Trailer'}
              </p>
            </div>
            {bookingToDisplay.type === 'POWER_AND_TRAILER' && bookingToDisplay.trailerLength && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trailer Length</label>
                <p className="text-sm text-gray-900">{bookingToDisplay.trailerLength} feet</p>
              </div>
            )}
          </div>
          
          {/* Route Information - Multi-leg vs Single-leg display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Information</label>
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
              <p className="text-sm text-gray-900">
                {bookingToDisplay.rateType === 'MILE' ? 'Per Mile' : 
                 bookingToDisplay.rateType === 'MILE_FSC' ? 'Per Mile + FSC' :
                 bookingToDisplay.rateType === 'FLAT_RATE' ? 'Flat Rate' : 'Unknown'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {bookingToDisplay.rateType !== 'FLAT_RATE' && bookingToDisplay.baseRate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Rate</label>
                <p className="text-sm text-gray-900">${bookingToDisplay.baseRate}</p>
              </div>
            )}
            {bookingToDisplay.rateType === 'MILE_FSC' && bookingToDisplay.fscRate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FSC Rate</label>
                <p className="text-sm text-gray-900">{bookingToDisplay.fscRate}%</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Rate</label>
              <p className="text-sm text-gray-900 font-medium text-green-600">${bookingToDisplay.rate}</p>
            </div>
          </div>

          {/* Line Items Section */}
          <BookingLineItems 
            bookingId={bookingToDisplay.id} 
            isReadOnly={!!bookingToDisplay.confirmationSignedAt}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billable</label>
            <p className="text-sm text-gray-900">{bookingToDisplay.billable ? 'Yes' : 'No'}</p>
          </div>
          
          {bookingToDisplay.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{bookingToDisplay.notes}</p>
            </div>
          )}
          
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
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Booking Edit Modal Component
interface BookingEditModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (updatedBooking: Booking) => void;
}

const BookingEditModal: React.FC<BookingEditModalProps> = ({ booking, onClose, onSave }) => {
  console.log('BookingEditModal - full booking data:', booking);
  console.log('BookingEditModal - rate fields:', {
    rateType: booking.rateType,
    baseRate: booking.baseRate,
    fscRate: booking.fscRate,
    rate: booking.rate
  });
  
  // Initialize form data with better handling of rate type
  const initializeFormData = useCallback(() => {
    const initialRateType = booking.rateType; // Don't default to FLAT_RATE
    console.log('=== BOOKING INITIALIZATION DEBUG ===');
    console.log('Full booking object:', booking);
    console.log('Rate type from booking.rateType:', booking.rateType);
    console.log('Base rate from booking.baseRate:', booking.baseRate);
    console.log('FSC rate from booking.fscRate:', booking.fscRate);
    console.log('Final rate from booking.rate:', booking.rate);
    console.log('Calculated baseRate fallback:', Number(booking.baseRate) || Number(booking.rate) || 0);
    console.log('========================================');
    
    return {
      carrierId: booking.carrierId,
      rate: Number(booking.rate) || 0,
      status: booking.status,
      billable: booking.billable,
      notes: booking.notes || '',
      driverName: booking.driverName || '',
      phoneNumber: booking.phoneNumber || '',
      carrierEmail: booking.carrierEmail || '',
      carrierReportTime: booking.carrierReportTime || '',
      type: booking.type || 'POWER_ONLY',
      trailerLength: booking.trailerLength ? booking.trailerLength.toString() : '',
      bookingDate: booking.bookingDate.split('T')[0], // Format for date input
      rateType: initialRateType,
      baseRate: Number(booking.baseRate) || Number(booking.rate) || 0,
      fscRate: Number(booking.fscRate) || 0
    };
  }, [booking]);
  
  const [formData, setFormData] = useState(() => initializeFormData());
  
  // Update form data if booking changes (shouldn't happen in modal, but good practice)
  useEffect(() => {
    console.log('Booking changed, reinitializing form data');
    setFormData(initializeFormData());
  }, [initializeFormData]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carrierSearchTerm, setCarrierSearchTerm] = useState('');
  const [showCarrierDropdown, setShowCarrierDropdown] = useState(false);
  const [selectedCarrierName, setSelectedCarrierName] = useState(
    booking.carrier?.name || ''
  );

  // Multi-leg booking support
  const [multiLegInfo, setMultiLegInfo] = useState(() => {
    const legs = parseMultiLegBooking(booking.notes || null);
    console.log('MultiLeg detection for booking', booking.id, ':', legs);
    return legs;
  });
  
  const [editableLegs, setEditableLegs] = useState(() => {
    const legs = parseMultiLegBooking(booking.notes || null);
    console.log('Editable legs initialized:', legs);
    return legs || [];
  });

  // Fetch carriers for carrier selection
  const { data: carriersData } = useQuery({
    queryKey: ['carriers'],
    queryFn: async () => {
      const response = await api.get('/carriers?limit=5000'); // Fetch all carriers
      return response.data;
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

  // Fetch routes for distance lookup
  const { data: routesData } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const response = await api.get('/routes?limit=2000'); // Fetch all routes (max allowed)
      return response.data;
    }
  });

  // Calculate total rate based on rate type and values
  const calculateTotalRate = (rateType: string, baseRate: number, fscRate: number) => {
    const validBaseRate = Number(baseRate) || 0;
    const validFscRate = Number(fscRate) || 0;
    const distance = Number(booking.route?.distance) || 1;
    
    switch (rateType) {
      case 'MILE':
        return validBaseRate * distance;
      case 'MILE_FSC':
        const mileRate = validBaseRate * distance;
        return mileRate + (mileRate * (validFscRate / 100));
      case 'FLAT_RATE':
      default:
        return validBaseRate;
    }
  };

  // Update total rate when rate type or values change (only for non-multi-leg bookings)
  useEffect(() => {
    // Don't auto-calculate for multi-leg bookings since they have manual leg rates
    if (!multiLegInfo || editableLegs.length === 0) {
      const totalRate = calculateTotalRate(formData.rateType, formData.baseRate, formData.fscRate);
      const validTotalRate = Number(totalRate) || 0;
      setFormData(prev => ({ ...prev, rate: Number(validTotalRate.toFixed(2)) }));
    }
  }, [formData.rateType, formData.baseRate, formData.fscRate, multiLegInfo, editableLegs.length]);

  // Set FSC rate from system settings when available
  useEffect(() => {
    if (settingsData?.fuelSurchargeRate && formData.rateType === 'MILE_FSC' && !formData.fscRate) {
      setFormData(prev => ({ ...prev, fscRate: Number(settingsData.fuelSurchargeRate) }));
    }
  }, [settingsData?.fuelSurchargeRate, formData.rateType]);

  // Helper function to calculate leg rate based on rate type
  const calculateLegRate = (rateType: string, baseRate: number, fscRate: number, distance: number = 100): number => {
    const validBaseRate = Number(baseRate) || 0;
    const validFscRate = Number(fscRate) || 0;
    const validDistance = Number(distance) || 100; // Default distance if not available
    
    switch (rateType) {
      case 'MILE':
        return validBaseRate * validDistance;
      case 'MILE_FSC':
        const mileRate = validBaseRate * validDistance;
        return mileRate + (mileRate * (validFscRate / 100));
      case 'FLAT_RATE':
      default:
        return validBaseRate;
    }
  };

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
    
    console.log(`Looking for route: ${origin} → ${destination} (cleaned: ${legOriginClean} → ${legDestinationClean})`);
    
    // Find matching route by origin and destination
    const matchingRoute = routesData.routes.find((route: any) => {
      const routeOrigin = cleanLocation(route.origin || '');
      const routeDestination = cleanLocation(route.destination || '');
      
      return routeOrigin === legOriginClean && routeDestination === legDestinationClean;
    });
    
    if (matchingRoute && matchingRoute.distance) {
      const distance = Number(matchingRoute.distance);
      console.log(`✓ Found route distance for ${origin} → ${destination}: ${distance} miles`);
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
      console.log(`✓ Found reverse route distance for ${destination} → ${origin}: ${distance} miles`);
      return distance;
    }
    
    // For multi-leg bookings, if this is a round trip and we know the total distance,
    // try to calculate proportional distances
    if (booking.route?.distance && multiLegInfo && multiLegInfo.length === 2) {
      const totalDistance = Number(booking.route.distance);
      // If it's a round trip (same origin/destination reversed), split distance equally
      if (multiLegInfo.length === 2 && 
          multiLegInfo[0].origin === multiLegInfo[1].destination && 
          multiLegInfo[0].destination === multiLegInfo[1].origin) {
        const legDistance = totalDistance / 2;
        console.log(`✓ Round trip detected, splitting ${totalDistance} miles equally: ${legDistance} miles per leg`);
        return legDistance;
      }
    }
    
    // Try fuzzy matching if exact match fails
    const fuzzyMatch = routesData.routes.find((route: any) => {
      const routeOrigin = route.origin?.toLowerCase();
      const routeDestination = route.destination?.toLowerCase();
      const legOrigin = origin.toLowerCase();
      const legDestination = destination.toLowerCase();
      
      // Fixed fuzzy matching logic
      return (routeOrigin?.includes(legOrigin) || legOrigin?.includes(routeOrigin)) &&
             (routeDestination?.includes(legDestination) || legDestination?.includes(routeDestination));
    });
    
    if (fuzzyMatch && fuzzyMatch.distance) {
      const distance = Number(fuzzyMatch.distance);
      console.log(`⚠️ Found fuzzy match for ${origin} → ${destination}: ${fuzzyMatch.origin} → ${fuzzyMatch.destination} (${distance} miles)`);
      return distance;
    }
    
    console.warn(`❌ No route found for ${origin} → ${destination}, using default distance`);
    console.log(`Debug info: Total routes available: ${routesData.routes.length}`);
    if (routesData.routes.length > 0) {
      console.log(`Sample routes:`, routesData.routes.slice(0, 3).map((r: any) => `${r.origin} → ${r.destination} (${r.distance} miles)`));
    }
    return 100; // Default distance if route not found
  };

  // Recalculate multi-leg rates when rate type or base rate changes
  useEffect(() => {
    if (multiLegInfo && editableLegs.length > 0 && formData.rateType !== 'FLAT_RATE' && routesData?.routes) {
      console.log('Recalculating multi-leg rates preserving original booking structure...');
      
      // Calculate total distance for the entire multi-leg journey
      let totalDistance = 0;
      const legsWithDistances = editableLegs.map(leg => {
        const distance = getDistanceForLeg(leg.origin, leg.destination);
        totalDistance += distance;
        return { ...leg, distance };
      });
      
      console.log(`Total multi-leg journey distance: ${totalDistance} miles`);
      
      // Calculate the total rate based on the entire journey distance
      const totalRate = calculateLegRate(formData.rateType, formData.baseRate, formData.fscRate, totalDistance);
      console.log(`Total rate for ${totalDistance} miles at $${formData.baseRate}/mile: $${totalRate.toFixed(2)}`);
      
      // Proportionally distribute the total rate among legs based on their distance
      const updatedLegs = legsWithDistances.map(leg => {
        const legProportion = leg.distance / totalDistance;
        const legRate = totalRate * legProportion;
        console.log(`Leg ${leg.legNumber} (${leg.origin} → ${leg.destination}): ${leg.distance} miles (${(legProportion * 100).toFixed(1)}% of journey) = $${legRate.toFixed(2)}`);
        return {
          legNumber: leg.legNumber,
          origin: leg.origin,
          destination: leg.destination,
          rate: legRate.toFixed(2)
        };
      });
      
      setEditableLegs(updatedLegs);
      
      console.log(`Multi-leg total rate: $${totalRate.toFixed(2)}`);
      setFormData(prev => ({ ...prev, rate: Number(totalRate.toFixed(2)) }));
      
      // Update notes with new leg information
      updateMultiLegNotes(updatedLegs);
    }
  }, [formData.rateType, formData.baseRate, formData.fscRate, multiLegInfo, routesData]);

  // Update leg rate
  const updateLegRate = (legIndex: number, newRate: string) => {
    const updatedLegs = editableLegs.map((leg, index) => 
      index === legIndex ? { ...leg, rate: newRate } : leg
    );
    setEditableLegs(updatedLegs);
    
    // Update total rate and notes
    const totalRate = updatedLegs.reduce((sum, leg) => {
      const legRate = parseFloat(leg.rate) || 0;
      return sum + legRate;
    }, 0);
    setFormData(prev => ({ ...prev, rate: Number(totalRate.toFixed(2)) }));
    
    // Update notes with new leg information
    updateMultiLegNotes(updatedLegs);
  };

  // Update leg addresses
  const updateLegAddress = (legIndex: number, field: 'origin' | 'destination', newValue: string) => {
    const updatedLegs = editableLegs.map((leg, index) => 
      index === legIndex ? { ...leg, [field]: newValue } : leg
    );
    setEditableLegs(updatedLegs);
    
    // Update notes with new leg information
    updateMultiLegNotes(updatedLegs);
  };
  
  // Update notes with multi-leg information
  const updateMultiLegNotes = (legs: any[]) => {
    const notes = formData.notes || '';
    const nonLegLines = notes.split('\n').filter(line => 
      !line.startsWith('--- Multi-Leg Booking') && 
      !line.match(/^Leg \d+:/)
    );
    
    const legLines = legs.map(leg => 
      `Leg ${leg.legNumber}: ${leg.origin} → ${leg.destination} ($${leg.rate})`
    );
    
    const updatedNotes = [
      '--- Multi-Leg Booking ---',
      ...legLines,
      ...nonLegLines
    ].join('\n');
    
    setFormData(prev => ({ ...prev, notes: updatedNotes }));
  };

  const carriers = carriersData?.carriers || [];
  const canChangeCarrier = formData.status === 'PENDING' || formData.status === 'CONFIRMED';

  // Filter carriers based on search term
  const filteredCarriers = useMemo(() => {
    if (!carriers.length) return [];
    
    return carriers.filter((carrier: any) =>
      carrier.name.toLowerCase().includes(carrierSearchTerm.toLowerCase()) ||
      carrier.mcNumber?.toLowerCase().includes(carrierSearchTerm.toLowerCase())
    ).slice(0, 10); // Limit to first 10 results
  }, [carriers, carrierSearchTerm]);

  // Handle carrier selection
  const handleCarrierSelect = (carrier: any) => {
    setFormData(prev => ({ ...prev, carrierId: carrier.id }));
    setSelectedCarrierName(carrier.name);
    setCarrierSearchTerm('');
    setShowCarrierDropdown(false);
  };

  // Handle carrier search input
  const handleCarrierSearch = (value: string) => {
    setCarrierSearchTerm(value);
    setShowCarrierDropdown(value.length > 0);
    if (value.length === 0) {
      setSelectedCarrierName('');
      setFormData(prev => ({ ...prev, carrierId: null }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await api.put(`/bookings/${booking.id}`, {
        ...formData,
        bookingDate: new Date(formData.bookingDate).toISOString(),
        carrierId: formData.carrierId || null,
        trailerLength: formData.type === 'POWER_AND_TRAILER' && formData.trailerLength 
          ? parseInt(formData.trailerLength) 
          : null
      });
      
      onSave(response.data);
    } catch (error) {
      console.error('Error updating booking:', error);
      // Handle error (show notification, etc.)
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Edit Booking #{booking.id}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              {canChangeCarrier ? (
                <div className="relative">
                  {/* Display selected carrier or search input */}
                  {selectedCarrierName && !showCarrierDropdown ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-blue-50 border-blue-200 flex items-center justify-between">
                      <span className="text-blue-900 font-medium">{selectedCarrierName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCarrierName('');
                          setFormData(prev => ({ ...prev, carrierId: null }));
                        }}
                        className="text-blue-600 hover:text-blue-800 ml-2"
                        title="Clear selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={carrierSearchTerm}
                        onChange={(e) => handleCarrierSearch(e.target.value)}
                        onFocus={() => carrierSearchTerm.length > 0 && setShowCarrierDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCarrierDropdown(false), 200)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search carriers by name or MC number..."
                      />
                      {/* Dropdown with filtered carriers */}
                      {showCarrierDropdown && filteredCarriers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredCarriers.map((carrier: any) => (
                            <button
                              key={carrier.id}
                              type="button"
                              onClick={() => handleCarrierSelect(carrier)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{carrier.name}</div>
                              {carrier.mcNumber && (
                                <div className="text-xs text-gray-500">MC: {carrier.mcNumber}</div>
                              )}
                            </button>
                          ))}
                          {carrierSearchTerm.length > 0 && filteredCarriers.length === 0 && (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              No carriers found matching "{carrierSearchTerm}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                  {booking.carrier?.name || 'N/A'}
                  <span className="text-xs text-gray-400 ml-2">
                    (Cannot change carrier for {formData.status.toLowerCase().replace('_', ' ')} bookings)
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="PENDING">Pending (Unbooked)</option>
                <option value="CONFIRMED">Confirmed (Booked)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          
          {/* Route Information - Multi-leg vs Single-leg display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route Information</label>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              {multiLegInfo ? (
                // Multi-leg booking display
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
              ) : booking.route ? (
                // Single-leg booking display (existing behavior)
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    {booking.route.name}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Origin Information */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-800 text-sm">Origin</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="font-medium">{booking.route.origin}</div>
                        {booking.route.originAddress && (
                          <div>{booking.route.originAddress}</div>
                        )}
                        {(booking.route.originCity || booking.route.originState || booking.route.originZipCode) && (
                          <div>
                            {booking.route.originCity && `${booking.route.originCity}, `}
                            {booking.route.originState && `${booking.route.originState} `}
                            {booking.route.originZipCode}
                          </div>
                        )}
                        {booking.route.originContact && (
                          <div className="text-xs text-gray-500">Contact: {booking.route.originContact}</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Destination Information */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-800 text-sm">Destination</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="font-medium">{booking.route.destination}</div>
                        {booking.route.destinationAddress && (
                          <div>{booking.route.destinationAddress}</div>
                        )}
                        {(booking.route.destinationCity || booking.route.destinationState || booking.route.destinationZipCode) && (
                          <div>
                            {booking.route.destinationCity && `${booking.route.destinationCity}, `}
                            {booking.route.destinationState && `${booking.route.destinationState} `}
                            {booking.route.destinationZipCode}
                          </div>
                        )}
                        {booking.route.destinationContact && (
                          <div className="text-xs text-gray-500">Contact: {booking.route.destinationContact}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {booking.route.distance && (
                    <div className="text-xs text-gray-500 pt-2 border-gray-200">
                      Distance: {booking.route.distance} miles
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input
                type="text"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter driver name..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter phone number..."
              />
            </div>
          </div>

          {/* Carrier Email and Report Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Email</label>
              <input
                type="email"
                value={formData.carrierEmail}
                onChange={(e) => setFormData({ ...formData, carrierEmail: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter carrier email for rate confirmation..."
            />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier Report Time</label>
              <input
                type="time"
                value={formData.carrierReportTime}
                onChange={(e) => setFormData({ ...formData, carrierReportTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Time when carrier should report"
              />
            </div>
          </div>
          
          {/* Booking Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="editBookingType"
                  value="POWER_ONLY"
                  checked={formData.type === 'POWER_ONLY'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Power Only</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="editBookingType"
                  value="POWER_AND_TRAILER"
                  checked={formData.type === 'POWER_AND_TRAILER'}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Power and Trailer</span>
              </label>
            </div>
            
            {/* Trailer Length - only show when Power and Trailer is selected */}
            {formData.type === 'POWER_AND_TRAILER' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trailer Length (feet)
                </label>
                <input
                  type="number"
                  value={formData.trailerLength}
                  onChange={(e) => setFormData({ ...formData, trailerLength: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter trailer length..."
                  min="1"
                  step="1"
                />
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Date</label>
              <input
                type="date"
                value={formData.bookingDate}
                onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="editRateType"
                    value="FLAT_RATE"
                    checked={formData.rateType === 'FLAT_RATE'}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span>Flat Rate</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="editRateType"
                    value="MILE"
                    checked={formData.rateType === 'MILE'}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span>Per Mile</span>
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="editRateType"
                    value="MILE_FSC"
                    checked={formData.rateType === 'MILE_FSC'}
                    onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span>Mile + FSC ({Number(settingsData?.fuelSurchargeRate || 0).toFixed(1)}%)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Rate calculation fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.rateType === 'FLAT_RATE' ? 'Flat Rate ($)' : 'Base Rate ($/mile)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
            {formData.rateType === 'MILE_FSC' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">FSC Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fscRate}
                  onChange={(e) => setFormData({ ...formData, fscRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Rate</label>
              <div className="w-full px-3 py-2 bg-green-50 border border-green-200 rounded-md text-green-800 font-medium">
                ${(Number(formData.rate) || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Multi-leg booking editor */}
          {multiLegInfo && editableLegs.length > 0 && (
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Multi-Leg Booking - Edit Individual Leg Rates:</h4>
              
              {/* Global rate type controls for multi-leg */}
              <div className="bg-white p-3 rounded border mb-3">
                <div className="text-xs font-medium text-gray-600 mb-2">Global Rate Settings (applies to all legs):</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Rate Type</label>
                    <div className="flex gap-2 text-xs">
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="multiLegRateType"
                          value="MILE"
                          checked={formData.rateType === 'MILE'}
                          onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                          className="text-blue-600"
                        />
                        <span>Per Mile</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="multiLegRateType"
                          value="MILE_FSC"
                          checked={formData.rateType === 'MILE_FSC'}
                          onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                          className="text-blue-600"
                        />
                        <span>Mile + FSC</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="multiLegRateType"
                          value="FLAT_RATE"
                          checked={formData.rateType === 'FLAT_RATE'}
                          onChange={(e) => setFormData({ ...formData, rateType: e.target.value as any })}
                          className="text-blue-600"
                        />
                        <span>Manual</span>
                      </label>
                    </div>
                  </div>
                  {(formData.rateType === 'MILE' || formData.rateType === 'MILE_FSC') && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Base Rate ($/mile)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.baseRate}
                        onChange={(e) => setFormData({ ...formData, baseRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  {formData.rateType === 'MILE_FSC' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">FSC Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.fscRate}
                        onChange={(e) => setFormData({ ...formData, fscRate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Individual leg rates */}
              {editableLegs.map((leg, index) => {
                const distance = getDistanceForLeg(leg.origin, leg.destination);
                return (
                  <div key={index} className="bg-white p-4 rounded border mb-3">
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-800 mb-2">
                        Leg {leg.legNumber}
                      </div>
                      
                      {/* Origin and Destination Address Fields */}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Origin</label>
                          <input
                            type="text"
                            value={leg.origin}
                            onChange={(e) => updateLegAddress(index, 'origin', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter origin address..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Destination</label>
                          <input
                            type="text"
                            value={leg.destination}
                            onChange={(e) => updateLegAddress(index, 'destination', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter destination address..."
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">
                          Distance: {distance} miles
                          {formData.rateType !== 'FLAT_RATE' && (
                            <span className="ml-2">
                              ({distance} miles × ${formData.baseRate}/mile
                              {formData.rateType === 'MILE_FSC' && ` + ${formData.fscRate}% FSC`} 
                              = ${leg.rate})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Rate ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={leg.rate}
                          onChange={(e) => updateLegRate(index, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                          readOnly={formData.rateType !== 'FLAT_RATE'}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="text-xs text-blue-600 mt-2">
                Total Rate: ${editableLegs.reduce((sum, leg) => sum + parseFloat(leg.rate || '0'), 0).toFixed(2)}
                {formData.rateType !== 'FLAT_RATE' && <span className="ml-2 text-gray-500">(Auto-calculated based on rate type)</span>}
              </div>
            </div>
          )}
          
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.billable}
                onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Billable</span>
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes..."
            />
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