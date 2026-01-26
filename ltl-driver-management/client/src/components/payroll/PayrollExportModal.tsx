import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PayrollExportOptions, PayrollSummary } from '../../types';
import { Download, FileSpreadsheet, Calendar, CheckCircle, AlertCircle } from 'lucide-react';

interface PayrollExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: PayrollSummary | null;
  onExport: (options: PayrollExportOptions) => Promise<void>;
}

export const PayrollExportModal: React.FC<PayrollExportModalProps> = ({
  isOpen,
  onClose,
  summary,
  onExport
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await onExport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        onlyApproved
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to export payroll data');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Set default dates to current pay period (last 2 weeks)
  React.useEffect(() => {
    if (isOpen && !startDate && !endDate) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 14);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Payroll to Workday"
    >
      <div className="space-y-6">
        {/* Export Info */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
          <div className="flex items-start">
            <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3" />
            <div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Export payroll data to an Excel file formatted for Workday import.
                The export includes two sheets:
              </p>
              <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 list-disc list-inside">
                <li><strong>Summary</strong> - Driver totals by category</li>
                <li><strong>Workday Import</strong> - Detail lines with paycodes</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Export Options */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={onlyApproved}
              onChange={(e) => setOnlyApproved(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Only export approved items
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
            Recommended to avoid exporting unreviewed pay items
          </p>
        </div>

        {/* Summary Preview */}
        {summary && (
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Export Preview
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total Records:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{summary.totalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Unapproved:</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">{summary.unapprovedCount}</span>
              </div>
              {onlyApproved && (
                <div className="col-span-2 flex justify-between border-t dark:border-gray-700 pt-2 mt-2">
                  <span className="text-gray-500 dark:text-gray-400">Items to Export:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {summary.totalCount - summary.unapprovedCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warning for non-approved */}
        {!onlyApproved && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Exporting non-approved items may include unreviewed pay amounts.
                Consider approving all items before exporting to Workday.
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export to XLS'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
