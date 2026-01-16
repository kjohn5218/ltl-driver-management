import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Printer, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/common/PageHeader';
import { manifestService } from '../services/manifestService';
import { locationService } from '../services/locationService';
import { HazmatBOLRequest } from '../types';

export const PrintHazmatBOL: React.FC = () => {
  const [manifestNumber, setManifestNumber] = useState('');
  const [proNumber, setProNumber] = useState('');
  const [terminalId, setTerminalId] = useState<number | null>(null);
  const [printerId, setPrinterId] = useState('');

  // Fetch locations (terminals)
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationService.getLocationsList()
  });

  // Print mutation
  const printMutation = useMutation({
    mutationFn: (request: HazmatBOLRequest) => manifestService.printHazmatBOL(request),
    onSuccess: (data) => {
      toast.success(data.message || 'Print job sent successfully');
    },
    onError: () => {
      toast.error('Failed to send print job');
    }
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async (request: HazmatBOLRequest) => {
      const blob = await manifestService.downloadHazmatBOL(request);
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hazmat-bol-${request.manifestNumber || request.proNumber || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast.success('PDF downloaded successfully');
    },
    onError: () => {
      toast.error('Failed to download PDF');
    }
  });

  const handlePrint = () => {
    if (!terminalId) {
      toast.error('Please select a terminal');
      return;
    }

    if (!manifestNumber && !proNumber) {
      toast.error('Please enter a manifest number or PRO number');
      return;
    }

    printMutation.mutate({
      manifestNumber: manifestNumber || undefined,
      proNumber: proNumber || undefined,
      terminalId,
      printerId: printerId || undefined
    });
  };

  const handleDownload = () => {
    if (!terminalId) {
      toast.error('Please select a terminal');
      return;
    }

    if (!manifestNumber && !proNumber) {
      toast.error('Please enter a manifest number or PRO number');
      return;
    }

    downloadMutation.mutate({
      manifestNumber: manifestNumber || undefined,
      proNumber: proNumber || undefined,
      terminalId,
      printerId: printerId || undefined
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Print Hazmat BOL"
        subtitle="Generate and print hazardous materials bills of lading"
      />

      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center mb-6">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
              <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hazmat Bill of Lading
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter the manifest or PRO number to generate the document
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Manifest Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manifest #
              </label>
              <input
                type="text"
                value={manifestNumber}
                onChange={(e) => setManifestNumber(e.target.value)}
                placeholder="Enter manifest number..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center">
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
              <span className="px-3 text-sm text-gray-500 dark:text-gray-400">OR</span>
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
            </div>

            {/* PRO/TrueTrak Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PRO or TrueTrak #
              </label>
              <input
                type="text"
                value={proNumber}
                onChange={(e) => setProNumber(e.target.value)}
                placeholder="Enter PRO or TrueTrak number..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Terminal & Printer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Terminal & Printer *
              </label>
              <select
                value={terminalId || ''}
                onChange={(e) => setTerminalId(e.target.value ? Number(e.target.value) : null)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select terminal...</option>
                {locations?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name || location.city}
                  </option>
                ))}
              </select>
            </div>

            {/* Printer ID (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Printer ID (Optional)
              </label>
              <input
                type="text"
                value={printerId}
                onChange={(e) => setPrinterId(e.target.value)}
                placeholder="Enter printer ID..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handlePrint}
                disabled={printMutation.isPending || (!manifestNumber && !proNumber) || !terminalId}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="h-4 w-4 mr-2" />
                {printMutation.isPending ? 'Sending...' : 'Print Hazmat BOL(s)'}
              </button>

              <button
                onClick={handleDownload}
                disabled={downloadMutation.isPending || (!manifestNumber && !proNumber) || !terminalId}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadMutation.isPending ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
