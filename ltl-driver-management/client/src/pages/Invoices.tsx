import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { 
  FileText, Search, Filter, Download, Send, DollarSign, 
  Calendar, ChevronDown, Check, X, Eye, Trash2, Mail,
  CheckCircle, Clock, AlertCircle, FileImage, Printer
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface Invoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  baseAmount: number;
  lineItemsAmount: number;
  status: 'PENDING' | 'SENT_TO_AP' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  sentToAPAt?: string;
  sentToAPBy?: string;
  paidAt?: string;
  includesDocuments: boolean;
  notes?: string;
  // Carrier address information
  carrierName?: string;
  carrierContactPerson?: string;
  carrierPhone?: string;
  carrierEmail?: string;
  carrierStreetAddress1?: string;
  carrierStreetAddress2?: string;
  carrierCity?: string;
  carrierState?: string;
  carrierZipCode?: string;
  booking: {
    id: number;
    carrier?: {
      id: number;
      name: string;
    };
    route?: {
      name: string;
      origin: string;
      destination: string;
    };
    bookingDate: string;
    manifestNumber?: string;
  };
  attachments?: any[];
}

export const Invoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<Invoice | null>(null);

  // Fetch invoices
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      
      const response = await api.get(`/invoices?${params.toString()}&limit=1000`);
      return response.data;
    }
  });

  // Update invoice status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await api.put(`/invoices/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  // Send to AP mutation
  const sendToAPMutation = useMutation({
    mutationFn: async ({ invoiceIds, includeDocuments }: { 
      invoiceIds: number[]; 
      includeDocuments: boolean;
    }) => {
      const response = await api.post('/invoices/send-to-ap', {
        invoiceIds,
        includeDocuments
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoices([]);
      setShowSendModal(false);
      alert('Invoices sent to AP successfully!');
    }
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  // Filter invoices based on search term
  const filteredInvoices = useMemo(() => {
    if (!invoicesData?.invoices) return [];
    
    return invoicesData.invoices.filter((invoice: Invoice) => {
      const matchesSearch = searchTerm === '' ||
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.booking.carrier?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.booking.route?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [invoicesData, searchTerm]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!filteredInvoices) return null;
    
    return {
      total: filteredInvoices.length,
      totalAmount: filteredInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
      pending: filteredInvoices.filter(inv => inv.status === 'PENDING').length,
      sentToAP: filteredInvoices.filter(inv => inv.status === 'SENT_TO_AP').length,
      paid: filteredInvoices.filter(inv => inv.status === 'PAID').length,
      overdue: filteredInvoices.filter(inv => inv.status === 'OVERDUE').length
    };
  }, [filteredInvoices]);

  // Toggle invoice selection
  const toggleInvoiceSelection = (id: number) => {
    setSelectedInvoices(prev => 
      prev.includes(id) 
        ? prev.filter(invId => invId !== id)
        : [...prev, id]
    );
  };

  // Select all visible invoices
  const selectAll = () => {
    const allIds = filteredInvoices.map(inv => inv.id);
    setSelectedInvoices(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedInvoices([]);
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = filteredInvoices.map(invoice => ({
      'Invoice #': invoice.invoiceNumber,
      'Carrier': invoice.carrierName || invoice.booking.carrier?.name || 'N/A',
      'Contact Person': invoice.carrierContactPerson || '',
      'Phone': invoice.carrierPhone || '',
      'Email': invoice.carrierEmail || '',
      'Address': invoice.carrierStreetAddress1 || '',
      'Address 2': invoice.carrierStreetAddress2 || '',
      'City': invoice.carrierCity || '',
      'State': invoice.carrierState || '',
      'Zip Code': invoice.carrierZipCode || '',
      'Route': invoice.booking.route?.name || 'N/A',
      'Manifest Number': invoice.booking.manifestNumber || '',
      'Booking Date': format(parseISO(invoice.booking.bookingDate), 'MM/dd/yyyy'),
      'Base Amount': Number(invoice.baseAmount),
      'Additional Charges': Number(invoice.lineItemsAmount),
      'Total Amount': Number(invoice.amount),
      'Status': invoice.status,
      'Created': format(parseISO(invoice.createdAt), 'MM/dd/yyyy'),
      'Sent to AP': invoice.sentToAPAt ? format(parseISO(invoice.sentToAPAt), 'MM/dd/yyyy') : '',
      'Paid': invoice.paidAt ? format(parseISO(invoice.paidAt), 'MM/dd/yyyy') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `invoices-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // Get status badge classes
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'SENT_TO_AP':
        return 'bg-blue-100 text-blue-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'OVERDUE':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'SENT_TO_AP':
        return <Send className="w-4 h-4" />;
      case 'PAID':
        return <CheckCircle className="w-4 h-4" />;
      case 'OVERDUE':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <X className="w-4 h-4" />;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Invoice Management
        </h1>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-green-600">
                  ${Number(summary.totalAmount).toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sent to AP</p>
                <p className="text-2xl font-bold text-blue-600">{summary.sentToAP}</p>
              </div>
              <Send className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-green-600">{summary.paid}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice #, carrier, or route..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <select
            className="px-4 py-2 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SENT_TO_AP">Sent to AP</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="px-3 py-2 border rounded-lg"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From Date"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              className="px-3 py-2 border rounded-lg"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To Date"
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {selectedInvoices.length > 0 && (
              <>
                <span className="text-sm text-gray-600">
                  {selectedInvoices.length} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowSendModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send to AP
                </button>
              </>
            )}
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Carrier
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-500">
                  Loading invoices...
                </td>
              </tr>
            ) : filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-4 text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice: Invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedInvoices.includes(invoice.id)}
                      onChange={() => toggleInvoiceSelection(invoice.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    #{invoice.booking.id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {invoice.booking.carrier?.name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {invoice.booking.route?.name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {format(parseISO(invoice.booking.bookingDate), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    ${Number(invoice.amount).toFixed(2)}
                    {Number(invoice.lineItemsAmount) > 0 && (
                      <span className="text-xs text-gray-500 block">
                        +${Number(invoice.lineItemsAmount).toFixed(2)} charges
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-700"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewingInvoice(invoice)}
                        className="text-purple-600 hover:text-purple-700"
                        title="Preview invoice"
                      >
                        <FileImage className="w-4 h-4" />
                      </button>
                      {invoice.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedInvoices([invoice.id]);
                              setShowSendModal(true);
                            }}
                            className="text-green-600 hover:text-green-700"
                            title="Send to AP"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this invoice?')) {
                                deleteInvoiceMutation.mutate(invoice.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                            title="Delete invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {invoice.status === 'SENT_TO_AP' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({
                            id: invoice.id,
                            status: 'PAID'
                          })}
                          className="text-green-600 hover:text-green-700"
                          title="Mark as paid"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Send to AP Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Send Invoices to AP</h3>
            
            <p className="text-sm text-gray-600 mb-4">
              You are about to send {selectedInvoices.length} invoice(s) to ap@ccfs.com
            </p>
            
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDocuments}
                  onChange={(e) => setIncludeDocuments(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Include supporting documents</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => sendToAPMutation.mutate({
                  invoiceIds: selectedInvoices,
                  includeDocuments
                })}
                disabled={sendToAPMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {sendToAPMutation.isPending ? 'Sending...' : 'Send to AP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {viewingInvoice && (
        <InvoiceDetailsModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* Invoice Preview Modal */}
      {previewingInvoice && (
        <InvoicePreviewModal
          invoice={previewingInvoice}
          onClose={() => setPreviewingInvoice(null)}
          onSendToAP={(invoiceId) => {
            setSelectedInvoices([invoiceId]);
            setShowSendModal(true);
            setPreviewingInvoice(null);
          }}
        />
      )}
    </div>
  );
};

// Invoice Details Modal Component
const InvoiceDetailsModal: React.FC<{
  invoice: Invoice;
  onClose: () => void;
}> = ({ invoice, onClose }) => {
  const { data: fullInvoice, isLoading } = useQuery({
    queryKey: ['invoice', invoice.id],
    queryFn: async () => {
      const response = await api.get(`/invoices/${invoice.id}`);
      return response.data;
    }
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl">
          <p>Loading invoice details...</p>
        </div>
      </div>
    );
  }

  const invoiceData = fullInvoice || invoice;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Invoice {invoiceData.invoiceNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Carrier Information (Remit To)</h3>
            <p className="text-sm text-gray-900 font-medium">
              {invoiceData.carrierName || invoiceData.booking.carrier?.name || 'N/A'}
            </p>
            {invoiceData.carrierContactPerson && (
              <p className="text-sm text-gray-600">
                Contact: {invoiceData.carrierContactPerson}
              </p>
            )}
            {invoiceData.carrierPhone && (
              <p className="text-sm text-gray-600">
                Phone: {invoiceData.carrierPhone}
              </p>
            )}
            {invoiceData.carrierEmail && (
              <p className="text-sm text-gray-600">
                Email: {invoiceData.carrierEmail}
              </p>
            )}
            
            {/* Address */}
            {(invoiceData.carrierStreetAddress1 || invoiceData.carrierCity || invoiceData.carrierState) && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Payment Address:</p>
                {invoiceData.carrierStreetAddress1 && (
                  <p className="text-sm text-gray-600">{invoiceData.carrierStreetAddress1}</p>
                )}
                {invoiceData.carrierStreetAddress2 && (
                  <p className="text-sm text-gray-600">{invoiceData.carrierStreetAddress2}</p>
                )}
                {(invoiceData.carrierCity || invoiceData.carrierState || invoiceData.carrierZipCode) && (
                  <p className="text-sm text-gray-600">
                    {[invoiceData.carrierCity, invoiceData.carrierState, invoiceData.carrierZipCode].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            )}
            
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Booking #{invoiceData.booking.id}
              </p>
              {invoiceData.booking.manifestNumber && (
                <p className="text-sm text-gray-600">
                  Manifest: {invoiceData.booking.manifestNumber}
                </p>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Details</h3>
            <div className="space-y-1">
              <p className="text-sm">
                <span className="text-gray-600">Status:</span>{' '}
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(invoiceData.status)}`}>
                  {invoiceData.status.replace('_', ' ')}
                </span>
              </p>
              <p className="text-sm">
                <span className="text-gray-600">Created:</span>{' '}
                <span className="text-gray-900">
                  {format(parseISO(invoiceData.createdAt), 'MMM dd, yyyy')}
                </span>
              </p>
              {invoiceData.sentToAPAt && (
                <p className="text-sm">
                  <span className="text-gray-600">Sent to AP:</span>{' '}
                  <span className="text-gray-900">
                    {format(parseISO(invoiceData.sentToAPAt), 'MMM dd, yyyy')}
                    {invoiceData.sentToAPBy && ` by ${invoiceData.sentToAPBy}`}
                  </span>
                </p>
              )}
              {invoiceData.paidAt && (
                <p className="text-sm">
                  <span className="text-gray-600">Paid:</span>{' '}
                  <span className="text-gray-900">
                    {format(parseISO(invoiceData.paidAt), 'MMM dd, yyyy')}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Route Information */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Route Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-900">
              {invoiceData.booking.route?.name || 'Custom Route'}
            </p>
            <p className="text-sm text-gray-600">
              {invoiceData.booking.route?.origin} → {invoiceData.booking.route?.destination}
            </p>
            <p className="text-sm text-gray-600">
              Booking Date: {format(parseISO(invoiceData.booking.bookingDate), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>

        {/* Amount Breakdown */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Breakdown</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Base Service Rate:</span>
              <span className="font-medium">${Number(invoiceData.baseAmount).toFixed(2)}</span>
            </div>
            {Number(invoiceData.lineItemsAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span>Additional Payments:</span>
                <span className="font-medium">${Number(invoiceData.lineItemsAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between text-base font-semibold">
              <span>Total Payment Due:</span>
              <span className="text-green-600">${Number(invoiceData.amount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        {invoiceData.booking?.lineItems && invoiceData.booking.lineItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoiceData.booking.lineItems.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-sm">{item.category}</td>
                      <td className="px-4 py-2 text-sm">{item.description}</td>
                      <td className="px-4 py-2 text-sm">{item.quantity}</td>
                      <td className="px-4 py-2 text-sm">${Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Attachments */}
        {invoiceData.attachments && invoiceData.attachments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Attachments</h3>
            <div className="space-y-2">
              {invoiceData.attachments.map((attachment: any) => (
                <div key={attachment.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">{attachment.filename}</span>
                  <span className="text-xs text-gray-500">({attachment.documentType})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {invoiceData.notes && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{invoiceData.notes}</p>
          </div>
        )}

        {/* Actions */}
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

// Invoice Preview Modal Component
const InvoicePreviewModal: React.FC<{
  invoice: Invoice;
  onClose: () => void;
  onSendToAP: (invoiceId: number) => void;
}> = ({ invoice, onClose, onSendToAP }) => {
  const { data: fullInvoice, isLoading } = useQuery({
    queryKey: ['invoice', invoice.id],
    queryFn: async () => {
      const response = await api.get(`/invoices/${invoice.id}`);
      return response.data;
    }
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl">
          <p>Loading invoice preview...</p>
        </div>
      </div>
    );
  }

  const invoiceData = fullInvoice || invoice;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileImage className="w-5 h-5" />
            Invoice Preview: {invoiceData.invoiceNumber}
          </h2>
          <div className="flex items-center gap-2">
            {invoiceData.status === 'PENDING' && (
              <button
                onClick={() => onSendToAP(invoiceData.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Send to AP
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

        {/* Invoice Preview Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white shadow-lg rounded-lg p-8 max-w-4xl mx-auto">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
                <p className="text-lg text-gray-600">{invoiceData.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Invoice Date</p>
                <p className="text-lg font-semibold">{format(parseISO(invoiceData.createdAt), 'MMM dd, yyyy')}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(invoiceData.status)}`}>
                    {invoiceData.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Bill To Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bill To:</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-lg font-semibold text-gray-900">
                    CrossCountry Freight Solutions, Inc.
                  </p>
                  <p className="text-gray-600">Linehaul Department</p>
                  <p className="text-gray-600">PO Box 4030</p>
                  <p className="text-gray-600">Bismarck, ND 58501</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Remit To:</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-lg font-semibold text-gray-900">
                    {invoiceData.carrierName || invoiceData.booking.carrier?.name || 'N/A'}
                  </p>
                  {invoiceData.carrierContactPerson && (
                    <p className="text-gray-600">Attn: {invoiceData.carrierContactPerson}</p>
                  )}
                  {invoiceData.carrierStreetAddress1 && (
                    <p className="text-gray-600">{invoiceData.carrierStreetAddress1}</p>
                  )}
                  {invoiceData.carrierStreetAddress2 && (
                    <p className="text-gray-600">{invoiceData.carrierStreetAddress2}</p>
                  )}
                  {(invoiceData.carrierCity || invoiceData.carrierState || invoiceData.carrierZipCode) && (
                    <p className="text-gray-600">
                      {[invoiceData.carrierCity, invoiceData.carrierState, invoiceData.carrierZipCode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {invoiceData.carrierPhone && (
                    <p className="text-gray-600">Phone: {invoiceData.carrierPhone}</p>
                  )}
                  {invoiceData.carrierEmail && (
                    <p className="text-gray-600">Email: {invoiceData.carrierEmail}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Service Details Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Details:</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Booking ID</p>
                    <p className="font-semibold">#{invoiceData.booking.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Service Date</p>
                    <p className="font-semibold">{format(parseISO(invoiceData.booking.bookingDate), 'MMM dd, yyyy')}</p>
                  </div>
                  {invoiceData.booking.manifestNumber && (
                    <div>
                      <p className="text-sm text-gray-600">Manifest Number</p>
                      <p className="font-semibold">{invoiceData.booking.manifestNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Route</p>
                    <p className="font-semibold">{invoiceData.booking.route?.name || 'Custom Route'}</p>
                    <p className="text-gray-600 text-sm">
                      {invoiceData.booking.route?.origin || invoiceData.booking.origin} → {invoiceData.booking.route?.destination || invoiceData.booking.destination}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Service Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment for Services Provided by Carrier:</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Service Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Payment Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        Linehaul Transportation Services - {invoiceData.booking.route?.name || 'Custom Route'}
                        <br />
                        <span className="text-gray-600 text-xs">
                          Route: {invoiceData.booking.route?.origin || invoiceData.booking.origin} to {invoiceData.booking.route?.destination || invoiceData.booking.destination}
                        </span>
                        <br />
                        <span className="text-gray-600 text-xs">
                          Service Date: {format(parseISO(invoiceData.booking.bookingDate), 'MMM dd, yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 text-right font-medium">
                        ${Number(invoiceData.baseAmount).toFixed(2)}
                      </td>
                    </tr>
                    
                    {/* Line Items */}
                    {invoiceData.booking?.lineItems && invoiceData.booking.lineItems.length > 0 && 
                      invoiceData.booking.lineItems.map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-4 py-4 text-sm text-gray-900">
                            {item.description}
                            <br />
                            <span className="text-gray-600 text-xs">
                              {item.category} - Qty: {item.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900 text-right font-medium">
                            ${Number(item.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Section */}
            <div className="flex justify-end">
              <div className="w-64">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Base Service Rate:</span>
                    <span className="font-medium">${Number(invoiceData.baseAmount).toFixed(2)}</span>
                  </div>
                  {Number(invoiceData.lineItemsAmount) > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Additional Payments:</span>
                      <span className="font-medium">${Number(invoiceData.lineItemsAmount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold">Total Payment Due:</span>
                      <span className="text-lg font-bold text-green-600">
                        ${Number(invoiceData.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Payment Terms:</h4>
                  <p className="text-sm text-gray-600">Net 30 days from invoice date</p>
                  <p className="text-sm text-gray-600">Payment due: {format(new Date(new Date(invoiceData.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}</p>
                  <p className="text-sm text-gray-600 mt-2">Payment will be processed to carrier via ACH or check</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Invoice Questions:</h4>
                  <p className="text-sm text-gray-600">CrossCountry Freight Solutions, Inc.</p>
                  <p className="text-sm text-gray-600">Linehaul Department</p>
                  <p className="text-sm text-gray-600">accounts@ccfs.com</p>
                  <p className="text-sm text-gray-600">Phone: (701) 555-0123</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mt-6">
                <h4 className="font-semibold text-gray-900 mb-2">Notes:</h4>
                <p className="text-sm text-gray-600">{invoiceData.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close
          </button>
          {invoiceData.status === 'PENDING' && (
            <button
              onClick={() => onSendToAP(invoiceData.id)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Send to AP
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function for status badge (reused from main component)
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'SENT_TO_AP':
      return 'bg-blue-100 text-blue-800';
    case 'PAID':
      return 'bg-green-100 text-green-800';
    case 'OVERDUE':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default Invoices;