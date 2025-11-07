<<<<<<< HEAD
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
import api from '../services/api';
import toast from 'react-hot-toast';

interface BookingDocument {
=======
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface Document {
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
  id: number;
  documentType: string;
  filename: string;
  uploadedAt: string;
<<<<<<< HEAD
  legNumber?: number;
  notes?: string;
}

interface Booking {
  id: number;
  bookingDate: string;
  route?: {
    name: string;
    origin: string;
    destination: string;
  };
  origin?: string;
  destination?: string;
  carrier?: {
    name: string;
  };
  childBookings?: Array<{
    route?: {
      origin: string;
      destination: string;
    };
    origin?: string;
    destination?: string;
  }>;
  documents?: BookingDocument[];
}

export const DocumentUpload: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState('manifest');
  const [legNumber, setLegNumber] = useState<number | undefined>();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchBooking();
  }, [token]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/documents/upload/${token}`);
      setBooking(response.data);
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load booking information');
      if (error.response?.status === 404 || error.response?.status === 403) {
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const files = Array.from(event.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to upload');
=======
  uploadedBy: string;
}

interface BookingInfo {
  shipmentNumber: string;
  carrierName: string;
  route: string;
  bookingDate: string;
  documents: Document[];
}

function DocumentUpload() {
  const { token } = useParams<{ token: string }>();
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [documentType] = useState('invoice'); // Default to invoice, no user selection needed
  const [uploaderName] = useState('Carrier'); // Default uploader name
  const [uploading, setUploading] = useState(false);

  const fetchBookingInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/documents/upload/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Upload link not found or invalid');
        }
        if (response.status === 410) {
          throw new Error('Upload link has expired');
        }
        throw new Error('Failed to load upload page');
      }
      const data = await response.json();
      setBookingInfo(data);
    } catch (err) {
      console.error('Error fetching booking info:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBookingInfo();
  }, [fetchBookingInfo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error('Please select files to upload');
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
<<<<<<< HEAD
    selectedFiles.forEach(file => {
      formData.append('documents', file);
    });
    
    formData.append('documentType', documentType);
    if (legNumber) formData.append('legNumber', legNumber.toString());
    if (notes) formData.append('notes', notes);

    try {
      await api.post(`/documents/upload/${token}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Documents uploaded successfully!');
      setSelectedFiles([]);
      setNotes('');
      
      // Refresh booking data to show new documents
      await fetchBooking();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to upload documents');
=======
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('documents', selectedFiles[i]);
    }
    formData.append('documentType', documentType);
    formData.append('uploadedBy', uploaderName);

    try {
      const response = await fetch(`/api/bookings/documents/upload/${token}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload documents');
      }

      const result = await response.json();
      toast.success(result.message);
      
      // Reset form
      setSelectedFiles(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Refresh booking info
      await fetchBookingInfo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
    } finally {
      setUploading(false);
    }
  };

<<<<<<< HEAD
  const downloadDocument = async (documentId: number, filename: string) => {
    try {
      const response = await api.get(`/documents/download/${documentId}`, {
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
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
=======
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
      </div>
    );
  }

  if (error) {
    return (
<<<<<<< HEAD
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
=======
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <p className="text-gray-600">Please contact support if you need assistance.</p>
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  if (!booking) return null;

  const routeDisplay = booking.route 
    ? `${booking.route.origin} to ${booking.route.destination}`
    : `${booking.origin} to ${booking.destination}`;

  const hasMultipleLegs = booking.childBookings && booking.childBookings.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-semibold text-gray-900">Upload Documents</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload manifests and other documents for your completed trip
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Booking Details</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Carrier</dt>
                    <dd className="text-sm text-gray-900">{booking.carrier?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Date</dt>
                    <dd className="text-sm text-gray-900">
                      {new Date(booking.bookingDate).toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Route</dt>
                    <dd className="text-sm text-gray-900">
                      {routeDisplay}
                      {hasMultipleLegs && (
                        <div className="mt-1 text-xs text-gray-600">
                          Multi-leg trip with {booking.childBookings.length + 1} legs
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload New Documents</h2>
              
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="documentType" className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <select
                    id="documentType"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="manifest">Manifest</option>
                    <option value="pod">Proof of Delivery</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {hasMultipleLegs && (
                  <div>
                    <label htmlFor="legNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Leg Number (Optional)
                    </label>
                    <select
                      id="legNumber"
                      value={legNumber || ''}
                      onChange={(e) => setLegNumber(e.target.value ? parseInt(e.target.value) : undefined)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">All legs</option>
                      {[...Array(booking.childBookings.length + 1)].map((_, index) => (
                        <option key={index + 1} value={index + 1}>
                          Leg {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Add any notes about these documents..."
                />
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  accept=".jpeg,.jpg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Click to select files
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: Images, PDF, Word, Excel (max 10MB)
                  </p>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Selected Files</h3>
                  <ul className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">{file.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4">
                    <button
                      onClick={handleUpload}
                      disabled={uploading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                    >
                      {uploading ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Documents
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {booking.documents && booking.documents.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Uploaded Documents</h2>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <ul className="divide-y divide-gray-200">
                    {booking.documents.map((doc) => (
                      <li key={doc.id} className="px-4 py-3 hover:bg-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                              <p className="text-xs text-gray-500">
                                {doc.documentType} • Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                                {doc.legNumber && ` • Leg ${doc.legNumber}`}
                              </p>
                              {doc.notes && (
                                <p className="text-xs text-gray-600 mt-1">{doc.notes}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => downloadDocument(doc.id, doc.filename)}
                            className="ml-4 text-blue-600 hover:text-blue-800"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center text-sm text-gray-500">
              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
              Thank you for uploading your documents
            </div>
=======
  if (!bookingInfo) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Upload</h1>
            <p className="text-gray-600">Submit your invoice and trip manifests for processing</p>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Shipment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Shipment #</p>
                <p className="font-medium">{bookingInfo.shipmentNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Carrier</p>
                <p className="font-medium">{bookingInfo.carrierName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Route</p>
                <p className="font-medium">{bookingInfo.route}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Booking Date</p>
                <p className="font-medium">
                  {(() => {
                    try {
                      return new Date(bookingInfo.bookingDate).toLocaleDateString();
                    } catch (error) {
                      return bookingInfo.bookingDate;
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Files
                </label>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Accepted formats: PDF, DOC, DOCX, JPG, PNG (Max 10 files)
                </p>
              </div>

              {selectedFiles && selectedFiles.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Selected files:</p>
                  <ul className="list-disc list-inside text-sm text-blue-700">
                    {Array.from(selectedFiles).map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Upload Documents
                  </>
                )}
              </button>
            </div>
          </div>

          {bookingInfo.documents.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Previously Uploaded Documents</h2>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="space-y-3">
                  {bookingInfo.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-white p-3 rounded-md">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.filename}</p>
                          <p className="text-sm text-gray-500">
                            Uploaded on {(() => {
                              try {
                                return new Date(doc.uploadedAt).toLocaleString();
                              } catch (error) {
                                return doc.uploadedAt;
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This link will expire 24 hours after your rate confirmation was signed. 
              If you need assistance, please contact our support team.
            </p>
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
          </div>
        </div>
      </div>
    </div>
  );
<<<<<<< HEAD
};
=======
}

export default DocumentUpload;
>>>>>>> ca61f3ad1c8501e12d62e957e30c0b8a190b6fa1
