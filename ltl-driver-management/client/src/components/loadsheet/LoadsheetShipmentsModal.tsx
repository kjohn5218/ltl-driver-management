import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useQuery } from '@tanstack/react-query';
import { Loadsheet } from '../../types';
import { loadsheetService } from '../../services/loadsheetService';
import {
  X,
  Package,
  ExternalLink,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';

// Configurable base URL for external shipment details
const SHIPMENT_DETAILS_BASE_URL = 'https://tms.example.com/shipment';

interface LoadsheetShipmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadsheet: Loadsheet | null;
}

export const LoadsheetShipmentsModal: React.FC<LoadsheetShipmentsModalProps> = ({
  isOpen,
  onClose,
  loadsheet
}) => {
  // Fetch shipments directly for this loadsheet
  const { data: shipmentsData, isLoading } = useQuery({
    queryKey: ['loadsheet-shipments', loadsheet?.id],
    queryFn: () => loadsheetService.getLoadsheetShipments(loadsheet!.id),
    enabled: isOpen && !!loadsheet?.id
  });

  const shipments = shipmentsData?.shipments || [];
  const totalPieces = shipmentsData?.totalPieces || 0;
  const totalWeight = shipmentsData?.totalWeight || 0;
  const hazmatCount = shipmentsData?.hazmatCount || 0;

  const openShipmentDetails = (proNumber: string) => {
    const url = `${SHIPMENT_DETAILS_BASE_URL}/${encodeURIComponent(proNumber)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Transition.Root show={isOpen && !!loadsheet} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-6 pb-6 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <Package className="w-6 h-6 text-blue-500 mr-3" />
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Shipments on Manifest {loadsheet?.manifestNumber}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {loadsheet?.linehaulName} - Trailer {loadsheet?.trailerNumber}
                        <span className={`ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          loadsheet?.status === 'DISPATCHED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300' :
                          loadsheet?.status === 'CLOSED' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                          loadsheet?.status === 'LOADING' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {loadsheet?.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {/* Loading state */}
                  {isLoading && (
                    <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      <span>Loading shipments...</span>
                    </div>
                  )}

                  {/* No shipments yet */}
                  {!isLoading && shipments.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">
                        {loadsheet?.status === 'DRAFT' || loadsheet?.status === 'OPEN'
                          ? 'No shipments have been scanned to this loadsheet yet'
                          : 'No shipment data available'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Shipments will appear here as they are scanned
                      </p>
                    </div>
                  )}

                  {/* Shipments summary and table */}
                  {!isLoading && shipments.length > 0 && (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {shipments.length}
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">Shipments</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {totalPieces.toLocaleString()}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300">Total Pieces</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {totalWeight.toLocaleString()}
                          </p>
                          <p className="text-xs text-purple-700 dark:text-purple-300">Total Weight (lbs)</p>
                        </div>
                      </div>

                      {/* Hazmat warning if applicable */}
                      {hazmatCount > 0 && (
                        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          <span className="text-sm text-orange-800 dark:text-orange-200">
                            {hazmatCount} hazmat shipment{hazmatCount > 1 ? 's' : ''} on this manifest
                          </span>
                        </div>
                      )}

                      {/* Shipments table */}
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
                            {shipments.map((item: any) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <button
                                    onClick={() => openShipmentDetails(item.proNumber)}
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
                                  <div className="max-w-[180px] truncate" title={item.consigneeName || ''}>
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
                    </>
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
