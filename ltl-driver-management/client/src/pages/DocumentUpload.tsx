import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface BookingDocument {
  id: number;
  documentType: string;
  filename: string;
  uploadedAt: string;
  legNumber?: number;
}

interface Booking {
  id: number;
  shipmentNumber: string;
  carrier: {
    name: string;
  };
  routeName: string;
  bookingDate: string;
  status: string;
  documents: BookingDocument[];
  childBookings?: Array<{
    id: number;
    legNumber: number;
    route?: {
      name: string;
      origin: string;
      destination: string;
    };
    origin?: string;
    destination?: string;
  }>;
}

interface FileWithDetails extends File {
  documentType?: string;
  legNumber?: number;
}

export const DocumentUpload: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileWithDetails[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [token]);

  const fetchBookingDetails = async () => {
    try {
      const response = await api.get(`/documents/booking/${token}`);
      setBooking(response.data);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      setError(error.response?.data?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => 
        Object.assign(file, { documentType: 'invoice', legNumber: undefined })
      ) as FileWithDetails[];
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const updateFileDetails = (index: number, updates: Partial<FileWithDetails>) => {
    setSelectedFiles(prev => {
      const updated = [...prev];
      updated[index] = Object.assign(updated[index], updates);
      return updated;
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to upload');
      return;
    }

    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('files', file);
        formData.append('documentType', file.documentType || 'invoice');
        if (file.legNumber) {
          formData.append('legNumber', file.legNumber.toString());
        }

        await api.post(`/documents/upload/${token}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Documents uploaded successfully');
      setSelectedFiles([]);
      fetchBookingDetails(); // Refresh to show new documents
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await api.delete(`/documents/${booking!.id}/${documentId}`);
      toast.success('Document deleted successfully');
      fetchBookingDetails(); // Refresh the list
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete document');
    }
  };

  const handleDownloadDocument = async (documentId: number, filename: string) => {
    try {
      const response = await api.get(`/documents/download/${booking!.id}/${documentId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map(file => 
        Object.assign(file, { documentType: 'invoice', legNumber: undefined })
      ) as FileWithDetails[];
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="flex items-center mb-4 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <p className="text-gray-700">Booking not found</p>
        </div>
      </div>
    );
  }

  const hasMultipleLegs = booking.childBookings && booking.childBookings.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">Upload Documents</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload invoices and supporting documents for this booking
            </p>
          </div>

          {/* Booking Details */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Shipment Number</p>
                <p className="mt-1 text-sm text-gray-900">{booking.shipmentNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Carrier</p>
                <p className="mt-1 text-sm text-gray-900">{booking.carrier.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Route</p>
                <p className="mt-1 text-sm text-gray-900">{booking.routeName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Booking Date</p>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(booking.bookingDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Multi-leg information */}
            {hasMultipleLegs && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">Legs</p>
                <div className="space-y-1">
                  {booking.childBookings!.map((leg) => (
                    <div key={leg.id} className="text-sm text-gray-900">
                      Leg {leg.legNumber}: {leg.route?.name || `${leg.origin} → ${leg.destination}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Area */}
          <div className="p-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Drag and drop files here, or click to select
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
              >
                Select Files
              </label>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Selected Files</h3>
                <div className="space-y-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <FileText className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{file.name}</span>
                            <span className="ml-2 text-xs text-gray-500">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          
                          <div className="mt-2 flex items-center space-x-4">
                            <select
                              value={file.documentType}
                              onChange={(e) => updateFileDetails(index, { documentType: e.target.value })}
                              className="text-sm border-gray-300 rounded-md"
                            >
                              <option value="invoice">Invoice</option>
                              <option value="receipt">Receipt</option>
                              <option value="pod">Proof of Delivery</option>
                              <option value="other">Other</option>
                            </select>

                            {hasMultipleLegs && (
                              <select
                                value={file.legNumber || ''}
                                onChange={(e) => updateFileDetails(index, { 
                                  legNumber: e.target.value ? parseInt(e.target.value) : undefined 
                                })}
                                className="text-sm border-gray-300 rounded-md"
                              >
                                <option value="">All Legs</option>
                                {booking.childBookings!.map((leg) => (
                                  <option key={leg.id} value={leg.legNumber}>
                                    Leg {leg.legNumber}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeFile(index)}
                          className="ml-4 text-gray-400 hover:text-gray-500"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center">
                        <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                        Uploading...
                      </div>
                    ) : (
                      'Upload Documents'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Existing Documents */}
            {booking.documents.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Uploaded Documents</h3>
                <div className="space-y-3">
                  {booking.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center flex-1">
                        <FileText className="w-5 h-5 text-green-500 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-xs text-gray-500">
                            {doc.documentType} • Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            {doc.legNumber && ` • Leg ${doc.legNumber}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Message */}
            {booking.documents.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      Thank you for uploading your documents. They will be processed with your payment.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

