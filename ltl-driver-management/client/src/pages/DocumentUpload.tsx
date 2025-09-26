import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader,
  Download,
  Trash2
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface BookingDocument {
  id: number;
  documentType: string;
  filename: string;
  uploadedAt: string;
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

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
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
    } finally {
      setUploading(false);
    }
  };

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
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

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

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">
                  {isDragActive
                    ? "Drop the files here..."
                    : "Drag and drop files here, or click to select"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: Images, PDF, Word, Excel (max 10MB)
                </p>
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
          </div>
        </div>
      </div>
    </div>
  );
};