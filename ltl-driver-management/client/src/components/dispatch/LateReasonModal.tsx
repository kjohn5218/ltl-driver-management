import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationService, TerminalLocation } from '../../services/locationService';
import { linehaulTripService } from '../../services/linehaulTripService';
import { loadsheetService } from '../../services/loadsheetService';
import { lateDepartureReasonService, LateReasonType } from '../../services/lateDepartureReasonService';
import { tmsDispositionService } from '../../services/tmsDispositionService';
import { LinehaulTrip, Loadsheet } from '../../types';
import { getNextBusinessDayFormatted } from '../../utils/dateUtils';
import {
  X,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
  FileText,
  CheckCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

interface LateReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: LinehaulTrip;
  loadsheets: Loadsheet[];
  schedDepartTime: string | null;
  dispatchTime: string | null;
}

type CorrectionMode = 'none' | 'sched_depart' | 'dispatch';

export const LateReasonModal: React.FC<LateReasonModalProps> = ({
  isOpen,
  onClose,
  trip,
  loadsheets,
  schedDepartTime,
  dispatchTime
}) => {
  const queryClient = useQueryClient();

  // State for form fields
  const [correctionMode, setCorrectionMode] = useState<CorrectionMode>('none');
  const [correctedSchedDepartDate, setCorrectedSchedDepartDate] = useState('');
  const [correctedSchedDepartTime, setCorrectedSchedDepartTime] = useState('');
  const [correctedDispatchDate, setCorrectedDispatchDate] = useState('');
  const [correctedDispatchTime, setCorrectedDispatchTime] = useState('');
  const [lateReason, setLateReason] = useState<LateReasonType | ''>('');
  const [willCauseServiceFailure, setWillCauseServiceFailure] = useState<boolean | null>(null);
  const [accountableTerminalId, setAccountableTerminalId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tmsUpdateStatus, setTmsUpdateStatus] = useState<'pending' | 'success' | 'partial' | 'skipped' | null>(null);

  // Fetch terminal locations for accountable terminal dropdown
  const { data: terminalLocations = [] } = useQuery({
    queryKey: ['terminal-locations'],
    queryFn: () => locationService.getTerminalLocations(),
    staleTime: 5 * 60 * 1000
  });

  // Initialize form with current values
  useEffect(() => {
    if (isOpen) {
      // Parse current sched depart
      if (schedDepartTime) {
        const schedDate = trip.dispatchDate || format(new Date(), 'yyyy-MM-dd');
        setCorrectedSchedDepartDate(schedDate);
        setCorrectedSchedDepartTime(schedDepartTime);
      }

      // Parse current dispatch time
      if (dispatchTime) {
        const dispatchDate = trip.dispatchDate || format(new Date(), 'yyyy-MM-dd');
        setCorrectedDispatchDate(dispatchDate);
        setCorrectedDispatchTime(dispatchTime);
      } else if (trip.actualDeparture) {
        const actualDate = parseISO(trip.actualDeparture);
        setCorrectedDispatchDate(format(actualDate, 'yyyy-MM-dd'));
        setCorrectedDispatchTime(format(actualDate, 'HH:mm'));
      }

      // Reset success/error states
      setSubmitSuccess(false);
      setSubmitError(null);
    }
  }, [isOpen, schedDepartTime, dispatchTime, trip]);

  // Mutation for updating trip
  const updateTripMutation = useMutation({
    mutationFn: async (data: { tripId: number; updates: Partial<LinehaulTrip> }) => {
      return linehaulTripService.updateTrip(data.tripId, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
    }
  });

  // Mutation for updating loadsheet
  const updateLoadsheetMutation = useMutation({
    mutationFn: async (data: { loadsheetId: number; updates: { targetDispatchTime?: string } }) => {
      return loadsheetService.updateLoadsheet(data.loadsheetId, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loadsheets-for-outbound'] });
    }
  });

  // Mutation for creating late departure reason
  const createLateReasonMutation = useMutation({
    mutationFn: lateDepartureReasonService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outbound-trips'] });
      queryClient.invalidateQueries({ queryKey: ['late-departure-reasons'] });
      queryClient.invalidateQueries({ queryKey: ['late-departure-reasons-for-outbound'] });
    }
  });

  // Calculate minutes late
  const calculateMinutesLate = (): number | null => {
    if (!schedDepartTime || !dispatchTime) return null;

    const parseTime = (timeStr: string): number | null => {
      const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (match) {
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
      return null;
    };

    const schedMinutes = parseTime(schedDepartTime);
    const dispatchMinutes = parseTime(dispatchTime);

    if (schedMinutes === null || dispatchMinutes === null) return null;

    return dispatchMinutes - schedMinutes;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (correctionMode === 'sched_depart' && loadsheets.length > 0) {
        // Update the first loadsheet's target dispatch time
        const newSchedDepart = correctedSchedDepartTime;
        await updateLoadsheetMutation.mutateAsync({
          loadsheetId: loadsheets[0].id,
          updates: { targetDispatchTime: newSchedDepart }
        });
        setSubmitSuccess(true);
      } else if (correctionMode === 'dispatch') {
        // Update trip's actual departure
        const newDispatchDateTime = `${correctedDispatchDate}T${correctedDispatchTime}:00`;
        await updateTripMutation.mutateAsync({
          tripId: trip.id,
          updates: { actualDeparture: newDispatchDateTime }
        });
        setSubmitSuccess(true);
      } else if (correctionMode === 'none' && lateReason) {
        // Save late departure reason to database
        const selectedTerminal = accountableTerminalId
          ? terminalLocations.find((l: TerminalLocation) => l.id === accountableTerminalId)
          : null;

        await createLateReasonMutation.mutateAsync({
          tripId: trip.id,
          reason: lateReason,
          willCauseServiceFailure: willCauseServiceFailure || false,
          accountableTerminalId: accountableTerminalId || undefined,
          accountableTerminalCode: selectedTerminal?.code,
          notes: notes || undefined,
          scheduledDepartTime: schedDepartTime || undefined,
          actualDepartTime: dispatchTime || undefined,
          minutesLate: calculateMinutesLate() || undefined
        });

        // Call TMS service to update schedules and add delay notes
        try {
          setTmsUpdateStatus('pending');
          const tmsResult = await tmsDispositionService.singleDisposition(trip.id, {
            lateReason,
            willCauseServiceFailure: willCauseServiceFailure || false,
            accountableTerminalId: accountableTerminalId || undefined,
            accountableTerminalCode: selectedTerminal?.code,
            notes: notes || undefined,
            newScheduledDepartDate: getNextBusinessDayFormatted(),
            scheduledDepartTime: schedDepartTime || undefined,
            actualDepartTime: dispatchTime || undefined,
            minutesLate: calculateMinutesLate() || undefined
          });

          if (tmsResult.errors.length === 0) {
            setTmsUpdateStatus('success');
          } else {
            setTmsUpdateStatus('partial');
            console.warn('TMS update had some errors:', tmsResult.errors);
          }
        } catch (tmsError: any) {
          console.warn('TMS update failed (non-blocking):', tmsError);
          setTmsUpdateStatus('skipped');
        }

        setSubmitSuccess(true);
      }

      // Close modal after short delay to show success
      setTimeout(async () => {
        await onClose();
        resetForm();
      }, 1000);
    } catch (error: any) {
      console.error('Error updating late reason:', error);
      setSubmitError(error.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCorrectionMode('none');
    setCorrectedSchedDepartDate('');
    setCorrectedSchedDepartTime('');
    setCorrectedDispatchDate('');
    setCorrectedDispatchTime('');
    setLateReason('');
    setWillCauseServiceFailure(null);
    setAccountableTerminalId('');
    setNotes('');
    setSubmitSuccess(false);
    setSubmitError(null);
    setTmsUpdateStatus(null);
  };

  if (!isOpen) return null;

  // Accountable terminal is required only when service failure is Yes
  const accountableTerminalRequired = willCauseServiceFailure === true;

  const canSubmit = correctionMode !== 'none' ||
    (lateReason && willCauseServiceFailure !== null && (!accountableTerminalRequired || accountableTerminalId));

  const minutesLate = calculateMinutesLate();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-lg p-6 my-8 text-left align-middle bg-white dark:bg-gray-800 rounded-lg shadow-xl transform transition-all">
          {/* Success overlay */}
          {submitSuccess && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-95 dark:bg-opacity-95 flex items-center justify-center rounded-lg z-10">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Saved Successfully!</p>
                {tmsUpdateStatus && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {tmsUpdateStatus === 'success' && 'TMS updates applied'}
                    {tmsUpdateStatus === 'partial' && 'TMS updates partially applied'}
                    {tmsUpdateStatus === 'skipped' && 'TMS updates pending'}
                    {tmsUpdateStatus === 'pending' && 'Updating TMS...'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Late Departure - Trip {trip.tripNumber}
              </h3>
            </div>
            <button
              onClick={onClose}
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

          {/* Current Times Display */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Sched Depart:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {schedDepartTime || '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Dispatched:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {dispatchTime || '-'}
                </span>
              </div>
            </div>
            {minutesLate !== null && minutesLate > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {minutesLate} minutes late
                </span>
              </div>
            )}
          </div>

          {/* Correction Options */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Action
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="correctionMode"
                  value="sched_depart"
                  checked={correctionMode === 'sched_depart'}
                  onChange={() => setCorrectionMode('sched_depart')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Correct scheduled departure time
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="correctionMode"
                  value="dispatch"
                  checked={correctionMode === 'dispatch'}
                  onChange={() => setCorrectionMode('dispatch')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Correct dispatch date/time
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="correctionMode"
                  value="none"
                  checked={correctionMode === 'none'}
                  onChange={() => setCorrectionMode('none')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Enter late reason
                </span>
              </label>
            </div>
          </div>

          {/* Correction Fields */}
          {correctionMode === 'sched_depart' && (
            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center mb-3">
                <Clock className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Correct Scheduled Departure
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={correctedSchedDepartDate}
                    onChange={(e) => setCorrectedSchedDepartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={correctedSchedDepartTime}
                    onChange={(e) => setCorrectedSchedDepartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {correctionMode === 'dispatch' && (
            <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-center mb-3">
                <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Correct Dispatch Date/Time
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={correctedDispatchDate}
                    onChange={(e) => setCorrectedDispatchDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={correctedDispatchTime}
                    onChange={(e) => setCorrectedDispatchTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Late Reason Fields (shown when not correcting) */}
          {correctionMode === 'none' && (
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
                      name="serviceFailure"
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
                      name="serviceFailure"
                      value="no"
                      checked={willCauseServiceFailure === false}
                      onChange={() => {
                        setWillCauseServiceFailure(false);
                        // Clear accountable terminal when service failure is No
                        setAccountableTerminalId('');
                      }}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">No</span>
                  </label>
                </div>
              </div>

              {/* Accountable Terminal - only required when service failure is Yes */}
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
                {willCauseServiceFailure === null && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Answer the service failure question first
                  </p>
                )}
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
                  rows={3}
                  placeholder="Enter additional notes..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
