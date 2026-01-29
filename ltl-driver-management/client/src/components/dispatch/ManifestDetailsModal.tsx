import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loadsheet, LoadsheetStatus, TripDocument, ManifestFreightItem } from '../../types';
import { loadsheetService } from '../../services/loadsheetService';
import { tripDocumentService } from '../../services/tripDocumentService';
import {
  X,
  FileText,
  Download,
  Truck,
  Package,
  Scale,
  Clock,
  MapPin,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

// Configurable base URL for external shipment details
// TODO: Update this URL to point to the actual TMS/shipment tracking system
const SHIPMENT_DETAILS_BASE_URL = 'https://tms.example.com/shipment';

interface ManifestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadsheets: Loadsheet[];
  tripId?: number;
  tripNumber?: string;
}

// Status badge component
const StatusBadge: React.FC<{ status: LoadsheetStatus }> = ({ status }) => {
  const statusStyles: Record<LoadsheetStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    LOADING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    CLOSED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    DISPATCHED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
};

// Shipments table component
const ShipmentsTable: React.FC<{
  shipments: ManifestFreightItem[];
  onProClick: (proNumber: string) => void;
}> = ({ shipments, onProClick }) => {
  if (shipments.length === 0) return null;

  return (
    <div className="mt-4">
      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Shipments ({shipments.length})
      </h5>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Pro #
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Destination
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Consignee
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Pieces
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Weight
              </th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Hazmat
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
            {shipments.map((item: ManifestFreightItem) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    onClick={() => onProClick(item.proNumber)}
                    className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    {item.proNumber}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </button>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {item.destTerminal || '-'}
                  {item.destTerminalSub && (
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      ({item.destTerminalSub})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                  <div className="max-w-[200px] truncate" title={item.consigneeName || ''}>
                    {item.consigneeName || '-'}
                  </div>
                  {item.consigneeCity && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.consigneeCity}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {item.pieces?.toLocaleString() || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {item.weight?.toLocaleString() || '-'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  {item.isHazmat ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                      <AlertTriangle className="w-3 h-3 mr-0.5" />
                      {item.hazmatClass || 'HM'}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ManifestDetailsModal: React.FC<ManifestDetailsModalProps> = ({
  isOpen,
  onClose,
  loadsheets,
  tripId,
  tripNumber
}) => {
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingManifestId, setDownloadingManifestId] = useState<number | null>(null);

  // Fetch trip documents if we have a tripId
  const { data: tripDocuments, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['trip-documents', tripId],
    queryFn: () => tripDocumentService.getTripDocuments(tripId!),
    enabled: isOpen && !!tripId,
    refetchInterval: (query) => {
      const docs = query.state.data?.documents;
      if (docs?.some((d: TripDocument) => d.status === 'PENDING')) {
        return 2000;
      }
      return false;
    }
  });

  // Generate documents mutation
  const generateMutation = useMutation({
    mutationFn: () => tripDocumentService.generateDocuments(tripId!),
    onSuccess: () => {
      toast.success('Documents generated successfully');
      queryClient.invalidateQueries({ queryKey: ['trip-documents', tripId] });
    },
    onError: () => {
      toast.error('Failed to generate documents');
    }
  });

  if (!isOpen) return null;

  // Find the LINEHAUL_MANIFEST document
  const linehaulManifest = tripDocuments?.documents?.find(
    (doc: TripDocument) => doc.documentType === 'LINEHAUL_MANIFEST' && doc.status === 'GENERATED'
  );

  // Check if manifest is still pending
  const manifestPending = tripDocuments?.documents?.some(
    (doc: TripDocument) => doc.documentType === 'LINEHAUL_MANIFEST' && doc.status === 'PENDING'
  );

  // Get all freight items (shipments) from the manifest
  const allFreightItems: ManifestFreightItem[] = linehaulManifest?.manifestData?.freightItems || [];

  // Check if we have no documents at all
  const noDocuments = !isLoadingDocs && (!tripDocuments?.documents || tripDocuments.documents.length === 0);

  // Function to get shipments for a specific loadsheet based on manifestNumber
  const getShipmentsForLoadsheet = (loadsheet: Loadsheet): ManifestFreightItem[] => {
    if (!loadsheet.manifestNumber || allFreightItems.length === 0) {
      return [];
    }
    return allFreightItems.filter(
      item => item.manifestNumber === loadsheet.manifestNumber
    );
  };

  // Get unmatched shipments (shipments that don't have a manifestNumber or don't match any loadsheet)
  const getUnmatchedShipments = (): ManifestFreightItem[] => {
    if (loadsheets.length === 0) return allFreightItems;

    const loadsheetManifestNumbers = new Set(
      loadsheets.map(ls => ls.manifestNumber).filter(Boolean)
    );

    return allFreightItems.filter(
      item => !item.manifestNumber || !loadsheetManifestNumbers.has(item.manifestNumber)
    );
  };

  const handleDownloadLoadsheet = async (loadsheet: Loadsheet) => {
    setDownloadingId(loadsheet.id);
    try {
      const blob = await loadsheetService.downloadLoadsheet(loadsheet.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loadsheet-${loadsheet.manifestNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Downloaded loadsheet ${loadsheet.manifestNumber}`);
    } catch (error) {
      console.error('Failed to download loadsheet:', error);
      toast.error('Failed to download loadsheet PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadManifest = async (tripDoc: TripDocument) => {
    setDownloadingManifestId(tripDoc.id);
    try {
      const blob = await tripDocumentService.downloadDocument(tripDoc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `load-manifest-${tripDoc.documentNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Downloaded load manifest');
    } catch (error) {
      console.error('Failed to download load manifest:', error);
      toast.error('Failed to download load manifest PDF');
    } finally {
      setDownloadingManifestId(null);
    }
  };

  const openShipmentDetails = (proNumber: string) => {
    const url = `${SHIPMENT_DETAILS_BASE_URL}/${encodeURIComponent(proNumber)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string | undefined | null): string => {
    if (!timeStr) return '-';
    const match = timeStr.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
    return match ? match[1] : timeStr;
  };

  const hasHazmat = (loadsheet: Loadsheet): boolean => {
    if (loadsheet.hazmatPlacards) {
      try {
        const placards = JSON.parse(loadsheet.hazmatPlacards);
        return Array.isArray(placards) && placards.length > 0;
      } catch {
        return false;
      }
    }
    return (loadsheet.hazmatItems && loadsheet.hazmatItems.length > 0) || false;
  };

  const unmatchedShipments = getUnmatchedShipments();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-4xl p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <FileText className="w-6 h-6 text-indigo-500 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Manifest Details
                </h3>
                {tripNumber && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Trip {tripNumber}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Download All button */}
              {linehaulManifest && (
                <button
                  onClick={() => handleDownloadManifest(linehaulManifest)}
                  disabled={downloadingManifestId === linehaulManifest.id}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50"
                >
                  {downloadingManifestId === linehaulManifest.id ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-1.5" />
                  )}
                  Load Manifest PDF
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Loading state */}
            {isLoadingDocs && (
              <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                <span>Loading manifest details...</span>
              </div>
            )}

            {/* Pending state */}
            {manifestPending && (
              <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                <span>Generating manifest...</span>
              </div>
            )}

            {/* No documents - show generate button */}
            {noDocuments && (
              <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg">
                <ClipboardList className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Load manifest not yet generated for this trip
                </p>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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

            {/* Each Loadsheet as a separate section */}
            {loadsheets.map((loadsheet) => {
              const loadsheetShipments = getShipmentsForLoadsheet(loadsheet);

              return (
                <div
                  key={loadsheet.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  {/* Manifest Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {loadsheet.manifestNumber}
                      </span>
                      <StatusBadge status={loadsheet.status} />
                      {hasHazmat(loadsheet) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          HAZMAT
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownloadLoadsheet(loadsheet)}
                      disabled={downloadingId === loadsheet.id}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                    >
                      {downloadingId === loadsheet.id ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-1.5" />
                      )}
                      Loadsheet PDF
                    </button>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <Truck className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Trailer</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loadsheet.trailerNumber}
                        {loadsheet.suggestedTrailerLength && (
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            ({loadsheet.suggestedTrailerLength}')
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <MapPin className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Route</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center">
                        {loadsheet.originTerminalCode || '-'}
                        <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />
                        {loadsheet.destinationTerminalCode || '-'}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <Clock className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Load Date</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(loadsheet.loadDate)}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <Package className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Pieces</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loadsheet.pieces?.toLocaleString() || '-'}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <Scale className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Weight</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loadsheet.weight ? `${loadsheet.weight.toLocaleString()} lbs` : '-'}
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <CheckCircle className="w-3 h-3 text-gray-400 mr-1" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Capacity</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loadsheet.capacity || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Additional Details Row */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {loadsheet.targetDispatchTime && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Target Dispatch: </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatTime(loadsheet.targetDispatchTime)}
                        </span>
                      </div>
                    )}
                    {loadsheet.closeTime && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Closed: </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatTime(loadsheet.closeTime)}
                        </span>
                      </div>
                    )}
                    {loadsheet.sealNumber && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Seal: </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {loadsheet.sealNumber}
                        </span>
                      </div>
                    )}
                    {loadsheet.doorNumber && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Door: </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {loadsheet.doorNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Shipments for this manifest */}
                  {!isLoadingDocs && !manifestPending && linehaulManifest && (
                    <>
                      {loadsheetShipments.length > 0 ? (
                        <ShipmentsTable
                          shipments={loadsheetShipments}
                          onProClick={openShipmentDetails}
                        />
                      ) : (
                        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                          No shipments scanned to manifest {loadsheet.manifestNumber}
                        </p>
                      )}
                    </>
                  )}

                  {/* Load Photo Placeholder */}
                  <div className="mt-4 p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                    <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <ImageIcon className="w-5 h-5 mr-2" />
                      <span className="text-sm">Load photo coming soon</span>
                    </div>
                  </div>

                  {/* Exceptions */}
                  {loadsheet.exceptions && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-center mb-1">
                        <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400 mr-1" />
                        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Exceptions</span>
                      </div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        {loadsheet.exceptions}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unmatched shipments (if any) */}
            {!isLoadingDocs && !manifestPending && linehaulManifest && unmatchedShipments.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-500" />
                  Other Shipments
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Shipments not matched to a specific manifest by destination
                </p>
                <ShipmentsTable
                  shipments={unmatchedShipments}
                  onProClick={openShipmentDetails}
                />
              </div>
            )}

            {/* No loadsheets message */}
            {loadsheets.length === 0 && !noDocuments && !isLoadingDocs && !manifestPending && (
              <div className="py-8 text-center text-gray-500">
                No manifests associated with this trip
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
