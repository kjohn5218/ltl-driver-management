import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Invoice, Booking } from '../types';
import { Plus, Search, Download, Eye, Calendar, DollarSign, FileText, X, ChevronUp, ChevronDown, CheckCircle } from 'lucide-react';
import { format, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';

type SortField = 'invoiceNumber' | 'bookingId' | 'amount' | 'createdAt' | 'paidAt' | 'status';
type SortDirection = 'asc' | 'desc';

export const Invoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await api.get('/invoices');
      return response.data.invoices as Invoice[];
    }
  });

  const filteredAndSortedInvoices = useMemo(() => {
    if (!invoices) return [];

    // First, filter the invoices
    let filtered = invoices.filter(invoice => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.bookingId.toString().includes(searchTerm);
      
      // Status filter
      const matchesStatus = statusFilter === '' || invoice.status === statusFilter;
      
      // Date filter
      let matchesDate = true;
      if (dateFromFilter || dateToFilter) {
        const invoiceDate = parseISO(invoice.createdAt);
        
        if (dateFromFilter) {
          const fromDate = parseISO(dateFromFilter);
          matchesDate = matchesDate && (isAfter(invoiceDate, fromDate) || isSameDay(invoiceDate, fromDate));
        }
        
        if (dateToFilter) {
          const toDate = parseISO(dateToFilter);
          matchesDate = matchesDate && (isBefore(invoiceDate, toDate) || isSameDay(invoiceDate, toDate));
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    // Then, sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'invoiceNumber':
          aValue = a.invoiceNumber;
          bValue = b.invoiceNumber;
          break;
        case 'bookingId':
          aValue = a.bookingId;
          bValue = b.bookingId;
          break;
        case 'amount':
          aValue = a.amount;
          bValue = b.amount;
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'paidAt':
          aValue = a.paidAt ? new Date(a.paidAt) : new Date(0);
          bValue = b.paidAt ? new Date(b.paidAt) : new Date(0);
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
  }, [invoices, searchTerm, statusFilter, dateFromFilter, dateToFilter, sortField, sortDirection]);

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

  const handleViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      // Create a simple PDF-like content for download
      const content = `
Invoice: ${invoice.invoiceNumber}
Booking ID: ${invoice.bookingId}
Amount: $${invoice.amount}
Status: ${invoice.status}
Created: ${format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
${invoice.paidAt ? `Paid: ${format(new Date(invoice.paidAt), 'MMM dd, yyyy')}` : ''}
`;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      alert('Error downloading invoice. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      SENT: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getTotalAmount = () => {
    if (!invoices) return 0;
    return invoices.reduce((total, invoice) => total + Number(invoice.amount), 0);
  };

  const getPaidAmount = () => {
    if (!invoices) return 0;
    return invoices
      .filter(invoice => invoice.status === 'PAID')
      .reduce((total, invoice) => total + Number(invoice.amount), 0);
  };

  const getPendingAmount = () => {
    if (!invoices) return 0;
    return invoices
      .filter(invoice => ['PENDING', 'SENT', 'OVERDUE'].includes(invoice.status))
      .reduce((total, invoice) => total + Number(invoice.amount), 0);
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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Manage billing and payments</p>
        </div>
        <button 
          onClick={() => setShowGenerateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="text-2xl font-semibold text-gray-900">${getTotalAmount().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Paid Amount</p>
              <p className="text-2xl font-semibold text-gray-900">${getPaidAmount().toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending Amount</p>
              <p className="text-2xl font-semibold text-gray-900">${getPendingAmount().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by invoice number or booking ID..."
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
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        
        {/* Date Filters */}
        <div className="flex gap-4 items-center">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Created Date Range:</span>
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
      </div>

      {/* Invoices Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('invoiceNumber')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Invoice #
                  {getSortIcon('invoiceNumber')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('bookingId')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Booking
                  {getSortIcon('bookingId')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('amount')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Amount
                  {getSortIcon('amount')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Created Date
                  {getSortIcon('createdAt')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('paidAt')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Paid Date
                  {getSortIcon('paidAt')}
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
            {filteredAndSortedInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  #{invoice.bookingId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm font-medium text-gray-900">
                    <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                    ${invoice.amount.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {format(new Date(invoice.createdAt), 'MMM dd, yyyy')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {invoice.paidAt ? format(new Date(invoice.paidAt), 'MMM dd, yyyy') : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(invoice.status)}`}>
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center gap-2 justify-end">
                    <button 
                      onClick={() => handleViewInvoice(invoice)}
                      className="text-gray-500 hover:text-blue-600 transition-colors"
                      title="View invoice details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownloadInvoice(invoice)}
                      className="text-gray-500 hover:text-green-600 transition-colors"
                      title="Download invoice"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedInvoices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No invoices found matching your criteria.</p>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <GenerateInvoiceModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setShowGenerateModal(false);
          }}
        />
      )}

      {/* Invoice View Modal */}
      {viewingInvoice && (
        <InvoiceViewModal 
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onDownload={() => handleDownloadInvoice(viewingInvoice)}
        />
      )}
    </div>
  );
};

// Invoice View Modal Component
interface InvoiceViewModalProps {
  invoice: Invoice;
  onClose: () => void;
  onDownload: () => void;
}

const InvoiceViewModal: React.FC<InvoiceViewModalProps> = ({ invoice, onClose, onDownload }) => {
  const getStatusBadge = (status: string) => {
    const statusColors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      SENT: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                <p className="text-gray-600">Booking ID: #{invoice.bookingId}</p>
              </div>
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(invoice.status)}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Invoice Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Number:</span>
                  <span className="font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium text-lg">${invoice.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{invoice.status}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Dates</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium">{format(new Date(invoice.createdAt), 'MMM dd, yyyy')}</span>
                </div>
                {invoice.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paid:</span>
                    <span className="font-medium text-green-600">{format(new Date(invoice.paidAt), 'MMM dd, yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Booking Information */}
          {invoice.booking && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Related Booking</h4>
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Booking ID:</span>
                    <span className="font-medium">#{invoice.booking.id}</span>
                  </div>
                  {invoice.booking.carrier && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Carrier:</span>
                      <span className="font-medium">{invoice.booking.carrier.name}</span>
                    </div>
                  )}
                  {invoice.booking.route && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Route:</span>
                      <span className="font-medium">{invoice.booking.route.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total Amount:</span>
              <span className="text-green-600">${invoice.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
          <button 
            onClick={onDownload}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

// Generate Invoice Modal Component
interface GenerateInvoiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({ onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch completed bookings without invoices
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['completed-bookings-without-invoices'],
    queryFn: async () => {
      const response = await api.get('/bookings?status=COMPLETED');
      // Filter out bookings that already have invoices
      return response.data.bookings.filter((booking: Booking) => !booking.invoice) as Booking[];
    }
  });

  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    
    if (searchTerm === '') return bookings;
    
    return bookings.filter(booking =>
      booking.id.toString().includes(searchTerm) ||
      booking.carrier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.route?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bookings, searchTerm]);

  const handleGenerateInvoice = async () => {
    if (!selectedBooking) return;

    setIsSubmitting(true);
    try {
      await api.post('/invoices', {
        bookingId: selectedBooking.id
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Error generating invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Generate Invoice</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by booking ID, carrier, or route..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Bookings List */}
            <div className="mb-6 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {bookings?.length === 0 
                    ? 'No completed bookings without invoices found.'
                    : 'No bookings match your search criteria.'}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBookings.map((booking) => (
                      <tr 
                        key={booking.id}
                        className={`hover:bg-gray-50 cursor-pointer ${
                          selectedBooking?.id === booking.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="radio"
                            checked={selectedBooking?.id === booking.id}
                            onChange={() => setSelectedBooking(booking)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          #{booking.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {booking.carrier?.name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{booking.route?.name}</div>
                            <div className="text-gray-500 text-xs">
                              {booking.route?.origin} → {booking.route?.destination}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {format(new Date(booking.bookingDate), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ${booking.rate.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Selected Booking Details */}
            {selectedBooking && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Selected Booking Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 font-medium">Booking ID:</span>
                    <span className="ml-2 text-blue-900">#{selectedBooking.id}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Carrier:</span>
                    <span className="ml-2 text-blue-900">{selectedBooking.carrier?.name}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Route:</span>
                    <span className="ml-2 text-blue-900">{selectedBooking.route?.name}</span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Amount:</span>
                    <span className="ml-2 text-blue-900 font-semibold">${selectedBooking.rate.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerateInvoice}
            disabled={!selectedBooking || isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Generate Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};