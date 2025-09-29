import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Upload, FileText, CheckCircle } from 'lucide-react';

interface Document {
  id: number;
  documentType: string;
  filename: string;
  uploadedAt: string;
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
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
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
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <p className="text-gray-600">Please contact support if you need assistance.</p>
        </div>
      </div>
    );
  }

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
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentUpload;