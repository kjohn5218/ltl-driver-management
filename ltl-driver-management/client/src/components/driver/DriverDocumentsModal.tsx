/**
 * Driver Documents Modal
 *
 * Mobile-friendly modal for viewing and downloading trip documents
 * after dispatch from the driver portal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, AlertTriangle, Download, Printer, Loader2, CheckCircle, XCircle, X } from 'lucide-react';

const API_BASE = '/api/public/driver';

interface TripDocument {
  id: number;
  documentType: 'LINEHAUL_MANIFEST' | 'PLACARD_SHEET' | 'HAZMAT_BOL';
  documentNumber: string;
  status: 'PENDING' | 'GENERATED' | 'ERROR';
  generatedAt?: string;
}

interface DriverDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripNumber?: string;
  driverId: number;
}

const documentTypeLabels: Record<string, string> = {
  LINEHAUL_MANIFEST: 'Linehaul Manifest',
  PLACARD_SHEET: 'Placard Information Sheet',
  HAZMAT_BOL: 'Hazmat BOL',
};

const documentTypeIcons: Record<string, React.ReactNode> = {
  LINEHAUL_MANIFEST: <FileText className="h-6 w-6" />,
  PLACARD_SHEET: <AlertTriangle className="h-6 w-6" />,
  HAZMAT_BOL: <FileText className="h-6 w-6" />,
};

export const DriverDocumentsModal: React.FC<DriverDocumentsModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripNumber,
  driverId,
}) => {
  const [documents, setDocuments] = useState<TripDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  // Detect if device is mobile (for UI adjustments)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!tripId || !driverId) return;

    try {
      const response = await fetch(`${API_BASE}/trip/${tripId}/documents?driverId=${driverId}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [tripId, driverId]);

  // Initial fetch and polling for pending documents
  useEffect(() => {
    if (!isOpen) {
      setDocuments([]);
      setIsLoading(true);
      setError(null);
      return;
    }

    fetchDocuments();

    // Poll every 2 seconds if any documents are pending
    const interval = setInterval(() => {
      if (documents.some(d => d.status === 'PENDING')) {
        fetchDocuments();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, fetchDocuments, documents]);

  // Download a single document
  const handleDownload = async (doc: TripDocument) => {
    setDownloadingId(doc.id);
    try {
      const response = await fetch(`${API_BASE}/document/${doc.id}/download?driverId=${driverId}`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.documentType.toLowerCase().replace('_', '-')}-${doc.documentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Download all documents
  const handleDownloadAll = async () => {
    const generatedDocs = documents.filter(d => d.status === 'GENERATED');
    if (generatedDocs.length === 0) return;

    setDownloadingAll(true);
    try {
      for (const doc of generatedDocs) {
        await handleDownload(doc);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  // Print a document (opens in new tab for browser print)
  const handlePrint = async (doc: TripDocument) => {
    try {
      const response = await fetch(`${API_BASE}/document/${doc.id}/download?driverId=${driverId}`);
      if (!response.ok) throw new Error('Failed to load document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Ready
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating...
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const hasGeneratedDocs = documents.some(d => d.status === 'GENERATED');
  const hasPendingDocs = documents.some(d => d.status === 'PENDING');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal - full screen on mobile, centered on desktop */}
      <div className="relative min-h-screen md:min-h-0 md:flex md:items-center md:justify-center md:p-4">
        <div className="relative bg-white w-full md:max-w-lg md:rounded-xl shadow-xl">
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 text-white px-4 py-4 md:rounded-t-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Trip Documents</h2>
              {tripNumber && (
                <p className="text-blue-100 text-sm">#{tripNumber}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[calc(100vh-200px)] md:max-h-96 overflow-y-auto">
            {/* Description */}
            <p className="text-sm text-gray-600 mb-4">
              {hasPendingDocs
                ? 'Your documents are being generated. They will be ready shortly.'
                : 'Your trip documents are ready. Download them for your records.'}
            </p>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading documents...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={fetchDocuments}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-500"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Documents list */}
            {!isLoading && !error && documents.length > 0 && (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-gray-50 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-blue-600">
                          {documentTypeIcons[doc.documentType]}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {documentTypeLabels[doc.documentType]}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {doc.documentNumber}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>

                    {doc.status === 'GENERATED' && (
                      <div className="flex gap-2">
                        {/* Download button - primary action, larger on mobile */}
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Download className="h-5 w-5" />
                          )}
                          Download
                        </button>

                        {/* Print button - secondary action, smaller or hidden on mobile */}
                        {!isMobile && (
                          <button
                            onClick={() => handlePrint(doc)}
                            className="px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                          >
                            <Printer className="h-5 w-5" />
                            Print
                          </button>
                        )}
                      </div>
                    )}

                    {doc.status === 'PENDING' && (
                      <div className="flex items-center justify-center py-2 text-gray-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Generating document...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No documents yet */}
            {!isLoading && !error && documents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                <p className="text-gray-600">Generating documents...</p>
                <p className="text-sm text-gray-500">This may take a moment</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="sticky bottom-0 bg-white border-t p-4 md:rounded-b-xl">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              >
                {hasGeneratedDocs ? 'Done' : 'Close'}
              </button>

              {hasGeneratedDocs && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="flex-1 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {downloadingAll ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  Download All
                </button>
              )}
            </div>

            {/* Mobile print option - shown as text link */}
            {isMobile && hasGeneratedDocs && (
              <p className="text-center text-sm text-gray-500 mt-3">
                To print, download and open the PDF on your device
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDocumentsModal;
