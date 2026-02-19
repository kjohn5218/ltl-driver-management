import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationService, TerminalLocation } from '../../services/locationService';
import { tmsDispositionService, BulkDispositionRequest, BulkDispositionResponse } from '../../services/tmsDispositionService';
import { LateReasonType } from '../../services/lateDepartureReasonService';
import { LoadItem } from './LoadsTab';
import { getNextBusinessDayFormatted } from '../../utils/dateUtils';
import {
  X,
  AlertTriangle,
  Building2,
  FileText,
  CheckCircle,
  Calendar,
  Truck,
  XCircle
} from 'lucide-react';

// Late reason options
const LATE_REASONS: { value: LateReasonType; label: string }[] = [
  { value: 'PRE_LOAD', label: 'Pre-load' },
  { value: 'DOCK_ISSUE', label: 'Dock Issue' },
  { value: 'STAFFING', label: 'Staffing' },
  { value: 'DRIVER_ISSUE', label: 'Driver Issue' },
  { value: 'WEATHER', label: 'Weather' },
  { value: 'LATE_INBOUND', label: 'Late inbound' },
  { value: 'DISPATCH_ISSUE', label: 'Dispatch Issue' }
];

interface BulkDispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLoadsheets: LoadItem[];
  onSuccess: () => void;
}

export const BulkDispositionModal: React.FC<BulkDispositionModalProps> = ({
  isOpen,
  onClose,
  selectedLoadsheets,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // State for form fields
  const [lateReason, setLateReason] = useState<LateReasonType | ''>('');
  const [willCauseServiceFailure, setWillCauseServiceFailure] = useState<boolean | null>(null);
  const [accountableTerminalId, setAccountableTerminalId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [newScheduledDepartDate, setNewScheduledDepartDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<BulkDispositionResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch terminal locations for accountable terminal dropdown
  const { data: terminalLocations = [] } = useQuery({
    queryKey: ['terminal-locations'],
    queryFn: () => locationService.getTerminalLocations(),
    staleTime: 5 * 60 * 1000
  });

  // Initialize form with defaults
  useEffect(() => {
    if (isOpen) {
      setNewScheduledDepartDate(getNextBusinessDayFormatted());
      setSubmitResult(null);
      setSubmitError(null);
    }
  }, [isOpen]);

  // Mutation for bulk disposition
  const bulkDispositionMutation = useMutation({
    mutationFn: tmsDispositionService.bulkDisposition,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-loads-tab'] });
      queryClient.invalidateQueries({ queryKey: ['late-departure-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
      setSubmitResult(result);
    }
  });

  const handleSubmit = async () => {
    if (!lateReason || willCauseServiceFailure === null || !newScheduledDepartDate) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedTerminal = accountableTerminalId
        ? terminalLocations.find((t: TerminalLocation) => t.id === accountableTerminalId)
        : null;

      const request: BulkDispositionRequest = {
        loadsheetIds: selectedLoadsheets.map(ls => ls.id),
        lateReason,
        willCauseServiceFailure,
        accountableTerminalId: accountableTerminalId || undefined,
        accountableTerminalCode: selectedTerminal?.code,
        notes: notes || undefined,
        newScheduledDepartDate
      };

      await bulkDispositionMutation.mutateAsync(request);
    } catch (error: any) {
      console.error('Error in bulk disposition:', error);
      setSubmitError(error.response?.data?.message || 'Failed to process bulk disposition. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitResult) {
      onSuccess();
    }
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setLateReason('');
    setWillCauseServiceFailure(null);
    setAccountableTerminalId('');
    setNotes('');
    setNewScheduledDepartDate('');
    setSubmitResult(null);
    setSubmitError(null);
  };

  if (!isOpen) return null;

  const accountableTerminalRequired = willCauseServiceFailure === true;
  const canSubmit = lateReason && willCauseServiceFailure !== null && newScheduledDepartDate &&
    (!accountableTerminalRequired || accountableTerminalId);

  // Count loadsheets with trips for late reason creation
  const loadsheetsWithTrips = selectedLoadsheets.filter(ls => ls.linehaulTripId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
          {/* Results overlay */}
          {submitResult && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-95 dark:bg-opacity-95 flex items-center justify-center rounded-lg z-10">
              <div className="text-center px-6">
                {submitResult.failed === 0 ? (
                  <>
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Bulk Disposition Complete
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Successfully processed {submitResult.processed} loadsheet{submitResult.processed !== 1 ? 's' : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Partial Success
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Processed: {submitResult.processed} | Failed: {submitResult.failed}
                    </p>
                    <div className="max-h-40 overflow-y-auto text-left bg-gray-50 dark:bg-gray-700 rounded p-3">
                      {submitResult.results.filter(r => r.errors.length > 0).map((r, i) => (
                        <div key={i} className="text-xs text-red-600 dark:text-red-400 mb-1">
                          <span className="font-medium">{r.manifestNumber}:</span> {r.errors.join(', ')}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <button
                  onClick={handleClose}
                  className="mt-6 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-amber-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Bulk Late Disposition
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error message */}
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
            </div>
          )}

          {/* Selection Summary */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Selected Loadsheets:
                </span>
                <span className="ml-2 text-lg font-bold text-primary-600 dark:text-primary-400">
                  {selectedLoadsheets.length}
                </span>
              </div>
              {loadsheetsWithTrips.length < selectedLoadsheets.length && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {selectedLoadsheets.length - loadsheetsWithTrips.length} without trips
                </div>
              )}
            </div>
            <div className="mt-2 max-h-20 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {selectedLoadsheets.slice(0, 10).map(ls => (
                  <span
                    key={ls.id}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    {ls.manifestNumber}
                  </span>
                ))}
                {selectedLoadsheets.length > 10 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                    +{selectedLoadsheets.length - 10} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Late Reason Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Late Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value as LateReasonType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select a reason...</option>
                {LATE_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Failure Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Will this cause a service failure? <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="bulkServiceFailure"
                    value="yes"
                    checked={willCauseServiceFailure === true}
                    onChange={() => setWillCauseServiceFailure(true)}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Yes</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="bulkServiceFailure"
                    value="no"
                    checked={willCauseServiceFailure === false}
                    onChange={() => {
                      setWillCauseServiceFailure(false);
                      setAccountableTerminalId('');
                    }}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">No</span>
                </label>
              </div>
            </div>

            {/* Accountable Terminal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 mr-1" />
                  Accountable Terminal {accountableTerminalRequired && <span className="text-red-500 ml-1">*</span>}
                  {!accountableTerminalRequired && willCauseServiceFailure === false && (
                    <span className="text-gray-400 text-xs ml-2">(optional)</span>
                  )}
                </div>
              </label>
              <select
                value={accountableTerminalId}
                onChange={(e) => setAccountableTerminalId(e.target.value ? parseInt(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
                disabled={willCauseServiceFailure === null}
              >
                <option value="">Select terminal...</option>
                {terminalLocations.map((terminal: TerminalLocation) => (
                  <option key={terminal.id} value={terminal.id}>
                    {terminal.code} - {terminal.name || terminal.city}
                  </option>
                ))}
              </select>
            </div>

            {/* New Scheduled Departure Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  New Scheduled Departure Date <span className="text-red-500">*</span>
                </div>
              </label>
              <input
                type="date"
                value={newScheduledDepartDate}
                onChange={(e) => setNewScheduledDepartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Defaults to next business day
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Notes
                </div>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Enter additional notes..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            {/* What Will Happen */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                This action will:
              </p>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>Record late departure reasons for {loadsheetsWithTrips.length} loadsheet{loadsheetsWithTrips.length !== 1 ? 's' : ''} with trips</li>
                <li>Update scheduled departure dates to {newScheduledDepartDate || 'selected date'}</li>
                <li>Update planned delivery dates for shipments (TMS)</li>
                <li>Add delay notes to orders (TMS)</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Processing...' : `Apply to ${selectedLoadsheets.length} Loadsheet${selectedLoadsheets.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
