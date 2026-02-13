/**
 * Trip Documents Modal
 *
 * Modal that displays generated trip documents after dispatch.
 * Allows users to preview, download, and print documents.
 */

import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripDocumentService } from '../../services/tripDocumentService';
import { TripDocument, TripDocumentType } from '../../types';
import { Modal } from '../common/Modal';
import {
  FileText,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TripDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripNumber?: string;
}

const documentTypeLabels: Record<TripDocumentType, string> = {
  LINEHAUL_MANIFEST: 'Linehaul Manifest',
  PLACARD_SHEET: 'Placard Information Sheet',
  HAZMAT_BOL: 'Hazmat BOL',
};

const documentTypeIcons: Record<TripDocumentType, React.ReactNode> = {
  LINEHAUL_MANIFEST: <FileText className="h-5 w-5" />,
  PLACARD_SHEET: <AlertTriangle className="h-5 w-5" />,
  HAZMAT_BOL: <FileText className="h-5 w-5" />,
};

export const TripDocumentsModal: React.FC<TripDocumentsModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripNumber,
}) => {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [printingAll, setPrintingAll] = useState(false);

  // Fetch documents for the trip
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tripDocuments', tripId],
    queryFn: () => tripDocumentService.getTripDocuments(tripId),
    enabled: isOpen && tripId > 0,
    refetchInterval: (query) => {
      // Keep refetching if any document is still pending
      const docs = query.state.data?.documents;
      if (docs?.some((d: TripDocument) => d.status === 'PENDING')) {
        return 2000; // Refetch every 2 seconds
      }
      return false;
    },
  });

  // Generate documents mutation
  const generateMutation = useMutation({
    mutationFn: () => tripDocumentService.generateDocuments(tripId),
    onSuccess: () => {
      toast.success('Documents generated successfully');
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
    },
    onError: () => {
      toast.error('Failed to generate documents');
    },
  });

  // Regenerate document mutation
  const regenerateMutation = useMutation({
    mutationFn: (documentId: number) => tripDocumentService.regenerateDocument(documentId),
    onSuccess: () => {
      toast.success('Document regenerated successfully');
      queryClient.invalidateQueries({ queryKey: ['tripDocuments', tripId] });
    },
    onError: () => {
      toast.error('Failed to regenerate document');
    },
  });

  const handleDownload = async (document: TripDocument) => {
    setDownloadingId(document.id);
    try {
      const filename = `${documentTypeLabels[document.documentType].toLowerCase().replace(/\s+/g, '-')}-${document.documentNumber}.pdf`;
      await tripDocumentService.triggerDownload(document.id, filename);
      toast.success('Document downloaded');
    } catch (err) {
      toast.error('Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrint = async (document: TripDocument) => {
    setPrintingId(document.id);
    try {
      await tripDocumentService.printDocument(document.id);
    } catch (err) {
      toast.error('Failed to open document for printing');
    } finally {
      setPrintingId(null);
    }
  };

  const handleRegenerate = (documentId: number) => {
    regenerateMutation.mutate(documentId);
  };

  const handleDownloadAll = async () => {
    if (!data?.documents) return;

    for (const doc of data.documents) {
      if (doc.status === 'GENERATED') {
        await handleDownload(doc);
      }
    }
  };

  const handlePrintAll = async () => {
    if (!data?.documents) return;

    setPrintingAll(true);
    try {
      const generatedDocs = data.documents.filter(d => d.status === 'GENERATED');

      for (const doc of generatedDocs) {
        await tripDocumentService.printDocument(doc.id);
        // Small delay between opening tabs to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      toast.success(`Opened ${generatedDocs.length} document(s) for printing`);
    } catch (err) {
      toast.error('Failed to open documents for printing');
    } finally {
      setPrintingAll(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3" />
            Ready
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating...
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="h-3 w-3" />
            Error
          </span>
        );
      default:
        return null;
    }
  };

  const documents = data?.documents || [];
  const hasGeneratedDocs = documents.some(d => d.status === 'GENERATED');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Trip Documents${tripNumber ? ` - ${tripNumber}` : ''}`}>
      <div className="space-y-4">
        {/* Header description */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The following documents have been generated for this trip. You can download or print them for your records.
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading documents...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load documents. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
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
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-indigo-600 dark:text-indigo-400">
                    {documentTypeIcons[doc.documentType]}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {documentTypeLabels[doc.documentType]}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.documentNumber}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusBadge(doc.status)}

                  {doc.status === 'GENERATED' && (
                    <>
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handlePrint(doc)}
                        disabled={printingId === doc.id}
                        className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 disabled:opacity-50"
                        title="Print"
                      >
                        {printingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}

                  {doc.status === 'ERROR' && (
                    <button
                      onClick={() => handleRegenerate(doc.id)}
                      disabled={regenerateMutation.isPending}
                      className="p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 disabled:opacity-50"
                      title="Regenerate"
                    >
                      {regenerateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No documents state */}
        {!isLoading && !error && documents.length === 0 && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              No documents have been generated yet.
            </p>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate Documents
            </button>
          </div>
        )}

        {/* Hazmat notice */}
        {data?.hasHazmat && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                This trip contains hazardous materials. Verify placard requirements before departure.
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Close
          </button>

          {hasGeneratedDocs && (
            <div className="flex gap-2">
              <button
                onClick={handlePrintAll}
                disabled={printingAll}
                className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 text-sm rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
              >
                {printingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print All
              </button>
              <button
                onClick={handleDownloadAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" />
                Download All
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TripDocumentsModal;
