import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { lateDepartureReasonService, LATE_REASON_LABELS, LateDepartureReason } from '../../services/lateDepartureReasonService';
import {
  X,
  AlertTriangle,
  Clock,
  Building2,
  FileText,
  User,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LateReasonViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  tripNumber: string;
}

export const LateReasonViewModal: React.FC<LateReasonViewModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripNumber
}) => {
  // Fetch the late departure reason for this trip
  const { data: lateReason, isLoading, error } = useQuery({
    queryKey: ['late-departure-reason', tripId],
    queryFn: () => lateDepartureReasonService.getByTripId(tripId),
    enabled: isOpen
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-md p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Late Reason - Trip {tripNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              Loading late reason details...
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              Failed to load late reason details
            </div>
          ) : lateReason ? (
            <div className="space-y-4">
              {/* Late Reason */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="flex items-center mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Late Reason</span>
                </div>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                  {LATE_REASON_LABELS[lateReason.reason]}
                </p>
              </div>

              {/* Time Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center mb-1">
                    <Clock className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Scheduled</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lateReason.scheduledDepartTime || '-'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center mb-1">
                    <Clock className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Actual</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lateReason.actualDepartTime || '-'}
                  </p>
                </div>
              </div>

              {/* Minutes Late */}
              {lateReason.minutesLate !== undefined && lateReason.minutesLate !== null && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {lateReason.minutesLate}
                  </span>
                  <span className="text-sm text-red-600 dark:text-red-400 ml-1">minutes late</span>
                </div>
              )}

              {/* Service Failure */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Will cause service failure?</span>
                  {lateReason.willCauseServiceFailure ? (
                    <span className="flex items-center text-red-600 dark:text-red-400 font-medium">
                      <XCircle className="w-4 h-4 mr-1" />
                      Yes
                    </span>
                  ) : (
                    <span className="flex items-center text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      No
                    </span>
                  )}
                </div>
              </div>

              {/* Accountable Terminal */}
              {(lateReason.accountableTerminal || lateReason.accountableTerminalCode) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center mb-1">
                    <Building2 className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Accountable Terminal</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lateReason.accountableTerminal
                      ? `${lateReason.accountableTerminal.code} - ${lateReason.accountableTerminal.name}`
                      : lateReason.accountableTerminalCode}
                  </p>
                </div>
              )}

              {/* Notes */}
              {lateReason.notes && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center mb-1">
                    <FileText className="w-3 h-3 text-gray-400 mr-1" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Notes</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {lateReason.notes}
                  </p>
                </div>
              )}

              {/* Recorded Info */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center justify-between">
                  <span>
                    Recorded: {format(parseISO(lateReason.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                  {lateReason.creator && (
                    <span className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {lateReason.creator.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No late reason recorded for this trip
            </div>
          )}

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
