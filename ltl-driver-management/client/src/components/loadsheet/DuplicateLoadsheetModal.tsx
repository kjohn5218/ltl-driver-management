import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { DuplicateLoadsheet } from '../../types';
import { loadsheetService } from '../../services/loadsheetService';
import { toast } from 'react-hot-toast';
import {
  X,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

interface DuplicateLoadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateLoadsheet[];
  trailerNumber: string;
  onReprintSelected: (loadsheet: DuplicateLoadsheet) => void;
  onContinueCreate: () => void;
}

export const DuplicateLoadsheetModal: React.FC<DuplicateLoadsheetModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  trailerNumber,
  onReprintSelected,
  onContinueCreate
}) => {
  const [selectedLoadsheet, setSelectedLoadsheet] = useState<DuplicateLoadsheet | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleDownload = async (loadsheet: DuplicateLoadsheet) => {
    try {
      setDownloading(true);
      const blob = await loadsheetService.downloadLoadsheet(loadsheet.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `loadsheet-${loadsheet.manifestNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Loadsheet ${loadsheet.manifestNumber} downloaded`);
    } catch (error) {
      toast.error('Failed to download loadsheet');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async (loadsheet: DuplicateLoadsheet) => {
    try {
      setPrinting(true);
      const blob = await loadsheetService.downloadLoadsheet(loadsheet.id);
      const url = window.URL.createObjectURL(blob);

      // Create a hidden iframe to print the PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = url;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Clean up after printing
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
            setPrinting(false);
          }, 1000);
        }, 500);
      };
    } catch (error) {
      toast.error('Failed to print loadsheet');
      setPrinting(false);
    }
  };

  const formatLoadDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      case 'OPEN':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'LOADING':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                {/* Warning Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-white">
                      Existing Loadsheets Found
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      The following loadsheets exist for trailer <span className="font-mono font-bold">{trailerNumber}</span> from
                      this location within the last 4 days:
                    </p>
                  </div>
                </div>

                {/* Duplicate Loadsheets List */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-6">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Manifest #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Linehaul
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Load Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {duplicates.map((loadsheet) => (
                        <tr
                          key={loadsheet.id}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            selectedLoadsheet?.id === loadsheet.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                                {loadsheet.manifestNumber}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {loadsheet.linehaulName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatLoadDate(loadsheet.loadDate)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(loadsheet.status)}`}>
                              {loadsheet.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleDownload(loadsheet)}
                                disabled={downloading}
                                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handlePrint(loadsheet)}
                                disabled={printing}
                                className="p-1.5 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Question and Action Buttons */}
                <div className="bg-gray-50 dark:bg-gray-700/50 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 px-4 py-4 sm:px-6">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    Would you like to re-print an existing loadsheet or continue creating a new one?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onContinueCreate}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Loadsheet
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};
