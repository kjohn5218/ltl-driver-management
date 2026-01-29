import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Truck,
  User,
  FileText,
  MapPin,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LinehaulTrip, TripArrivalData, WaitTimeReason, EquipmentIssueType } from '../../types';
import { linehaulTripService } from '../../services/linehaulTripService';
import { mileageMatrixService } from '../../services/mileageMatrixService';

interface ArrivalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: LinehaulTrip;
  onSuccess?: () => void;
}

const waitTimeReasonOptions: { value: WaitTimeReason; label: string }[] = [
  { value: 'LATE_MEET_DRIVER', label: 'Late Meet Driver' },
  { value: 'DOCK_DELAY', label: 'Dock Delay' },
  { value: 'BREAKDOWN', label: 'Breakdown' }
];

const equipmentTypeOptions: { value: EquipmentIssueType; label: string }[] = [
  { value: 'TRAILER', label: 'Trailer' },
  { value: 'DOLLY', label: 'Dolly' }
];

export const ArrivalDetailsModal: React.FC<ArrivalDetailsModalProps> = ({
  isOpen,
  onClose,
  trip,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Form state
  const [arrivalDateTime, setArrivalDateTime] = useState<string>(''); // datetime-local format
  const [miles, setMiles] = useState<string>('');
  const [milesSource, setMilesSource] = useState<'matrix' | 'profile' | 'manual'>('manual');
  const [dropAndHook, setDropAndHook] = useState<string>('');
  const [chainUpCycles, setChainUpCycles] = useState<string>('');
  const [waitTimeStart, setWaitTimeStart] = useState<string>(''); // datetime-local format
  const [waitTimeEnd, setWaitTimeEnd] = useState<string>(''); // datetime-local format
  const [waitTimeReason, setWaitTimeReason] = useState<WaitTimeReason | ''>('');
  const [notes, setNotes] = useState<string>('');

  // Equipment issue state (for OWNOP)
  const [hasEquipmentIssue, setHasEquipmentIssue] = useState<boolean>(false);
  const [equipmentType, setEquipmentType] = useState<EquipmentIssueType>('TRAILER');
  const [equipmentNumber, setEquipmentNumber] = useState<string>('');
  const [issueDescription, setIssueDescription] = useState<string>('');

  // Morale rating state
  const [showMoraleRating, setShowMoraleRating] = useState<boolean>(false);
  const [moraleRating, setMoraleRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [arrivalResult, setArrivalResult] = useState<{ tripId: number; driverId: number } | null>(null);

  // Check if this is an OWNOP trip (no truck assigned)
  const isOwnOp = !trip.truckId;

  // Calculate wait time in minutes from datetime-local values
  const calculatedWaitTime = useMemo(() => {
    if (!waitTimeStart || !waitTimeEnd) return null;

    const start = new Date(waitTimeStart);
    const end = new Date(waitTimeEnd);

    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) return null;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    return { minutes: diffMins, formatted: `${hours}h ${mins}m` };
  }, [waitTimeStart, waitTimeEnd]);

  // Check if wait time is selected (both start and end are provided)
  const hasWaitTime = Boolean(waitTimeStart && waitTimeEnd);

  // Get manifest numbers from loadsheets
  const manifestNumbers = trip.loadsheets?.map(ls => ls.manifestNumber).join(', ') || '-';

  // Get trailer numbers
  const trailerNumbers = [
    trip.trailer?.unitNumber,
    trip.trailer2?.unitNumber,
    trip.trailer3?.unitNumber
  ].filter(Boolean).join(', ') || '-';

  // Get dolly numbers
  const dollyNumbers = [
    trip.dolly?.unitNumber,
    trip.dolly2?.unitNumber
  ].filter(Boolean).join(', ') || '-';

  // Get route info
  const origin = trip.linehaulProfile?.originTerminal?.code || '-';
  const destination = trip.linehaulProfile?.destinationTerminal?.code || '-';

  // Mutation for submitting arrival
  const arrivalMutation = useMutation({
    mutationFn: async (data: TripArrivalData) => {
      return linehaulTripService.submitArrival(trip.id, data);
    },
    onSuccess: async () => {
      toast.success('Trip arrived successfully');
      queryClient.invalidateQueries({ queryKey: ['trips-in-transit'] });

      // Check if we should show the morale rating dialog
      // Only show if: 1) NOT an OWNOP trip, 2) Driver is assigned, 3) This is the second arrival in 24 hours
      if (!isOwnOp && trip.driverId) {
        try {
          const arrivalCount = await linehaulTripService.checkDriverArrivalCount(trip.driverId);
          if (arrivalCount.isSecondArrival) {
            // Show the morale rating dialog
            setArrivalResult({ tripId: trip.id, driverId: trip.driverId });
            setShowMoraleRating(true);
            return; // Don't close the modal yet
          }
        } catch (error) {
          console.error('Failed to check arrival count:', error);
        }
      }

      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to arrive trip');
    }
  });

  // Mutation for saving morale rating
  const moraleRatingMutation = useMutation({
    mutationFn: async (rating: number) => {
      if (!arrivalResult) throw new Error('No arrival result');
      return linehaulTripService.saveMoraleRating({
        tripId: arrivalResult.tripId,
        driverId: arrivalResult.driverId,
        rating
      });
    },
    onSuccess: () => {
      toast.success('Thank you for your feedback!');
      setShowMoraleRating(false);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to save morale rating:', error);
      // Still close on error - the arrival was successful
      onSuccess?.();
      onClose();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields when wait time is selected
    if (hasWaitTime) {
      if (!waitTimeReason) {
        toast.error('Wait Time Reason is required when wait time is entered');
        return;
      }
      if (!notes.trim()) {
        toast.error('Notes are required when wait time is entered');
        return;
      }
    }

    // Build the arrival data
    const arrivalData: TripArrivalData = {
      actualArrival: arrivalDateTime ? new Date(arrivalDateTime).toISOString() : undefined,
      actualMileage: miles ? parseFloat(miles) : undefined,
      dropAndHook: dropAndHook ? parseInt(dropAndHook, 10) : undefined,
      chainUpCycles: chainUpCycles ? parseInt(chainUpCycles, 10) : undefined,
      waitTimeStart: waitTimeStart ? new Date(waitTimeStart).toISOString() : undefined,
      waitTimeEnd: waitTimeEnd ? new Date(waitTimeEnd).toISOString() : undefined,
      waitTimeReason: waitTimeReason || undefined,
      notes: notes || undefined
    };

    // Add equipment issue if OWNOP and issue is reported
    if (isOwnOp && hasEquipmentIssue && equipmentNumber && issueDescription) {
      arrivalData.equipmentIssue = {
        equipmentType,
        equipmentNumber,
        description: issueDescription
      };
    }

    arrivalMutation.mutate(arrivalData);
  };

  // Helper function to format date for datetime-local input
  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set arrival date/time to current date/time
      setArrivalDateTime(formatDateTimeLocal(new Date()));
      setMiles('');
      setMilesSource('manual');
      setDropAndHook('');
      setChainUpCycles('');
      setWaitTimeStart('');
      setWaitTimeEnd('');
      setWaitTimeReason('');
      setNotes('');
      setHasEquipmentIssue(false);
      setEquipmentType('TRAILER');
      setEquipmentNumber('');
      setIssueDescription('');
      setShowMoraleRating(false);
      setMoraleRating(0);
      setHoveredRating(0);
      setArrivalResult(null);
    }
  }, [isOpen]);

  // Lookup mileage from matrix when modal opens
  useEffect(() => {
    if (isOpen && origin !== '-' && destination !== '-') {
      // First check if linehaulProfile has distanceMiles
      if (trip.linehaulProfile?.distanceMiles) {
        setMiles(trip.linehaulProfile.distanceMiles.toString());
        setMilesSource('profile');
      } else {
        // Lookup from mileage matrix
        mileageMatrixService.lookupMiles(origin, destination)
          .then(result => {
            if (result.miles !== null) {
              setMiles(result.miles.toString());
              setMilesSource('matrix');
            }
          })
          .catch(() => {
            // Silently fail - field will just be empty
          });
      }
    }
  }, [isOpen, origin, destination, trip.linehaulProfile?.distanceMiles]);

  // Handle morale rating submission
  const handleMoraleRatingSubmit = () => {
    if (moraleRating > 0) {
      moraleRatingMutation.mutate(moraleRating);
    } else {
      // Skip if no rating selected
      onSuccess?.();
      onClose();
    }
  };

  // Get rating label
  const getRatingLabel = (rating: number): string => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Great'];
    return labels[rating] || '';
  };

  if (!isOpen) return null;

  // Show morale rating dialog
  if (showMoraleRating) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />

          <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Star className="h-6 w-6 text-yellow-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Quick Feedback
                </h3>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="text-center">
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  How was your work day?
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Your feedback helps us improve driver experience
                </p>

                {/* Star Rating */}
                <div className="flex justify-center space-x-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setMoraleRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-1 focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= (hoveredRating || moraleRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                {/* Rating Label */}
                <div className="h-6 mb-6">
                  {(hoveredRating || moraleRating) > 0 && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {getRatingLabel(hoveredRating || moraleRating)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  onSuccess?.();
                  onClose();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Skip
              </button>
              <button
                onClick={handleMoraleRatingSubmit}
                disabled={moraleRating === 0 || moraleRatingMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {moraleRatingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Arrive Trip
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Trip Information Section */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Trip Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <User className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 dark:text-gray-400">Driver:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {trip.driver?.name || trip.driverExternalId || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Truck className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 dark:text-gray-400">Power Unit:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {isOwnOp ? (
                        <span className="text-blue-600 dark:text-blue-400">OWNOP</span>
                      ) : (
                        trip.truck?.unitNumber || '-'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 dark:text-gray-400">Manifest(s):</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {manifestNumbers}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 dark:text-gray-400">Trailer(s):</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {trailerNumbers}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500 dark:text-gray-400">Dolly(s):</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {dollyNumbers}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-500 dark:text-gray-400">Route:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {origin} <ArrowRight className="inline h-3 w-3 mx-1" /> {destination}
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrival Date & Time Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Arrival Date & Time
                </h4>
                <div>
                  <input
                    type="datetime-local"
                    value={arrivalDateTime}
                    onChange={(e) => setArrivalDateTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Defaults to current date/time. Adjust if there was a delay in recording the arrival.
                  </p>
                </div>
              </div>

              {/* Operational Details Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Operational Details
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Miles
                      {milesSource === 'matrix' && (
                        <span className="text-xs text-blue-500 ml-1">(from matrix)</span>
                      )}
                      {milesSource === 'profile' && (
                        <span className="text-xs text-green-500 ml-1">(from profile)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={miles}
                      onChange={(e) => {
                        setMiles(e.target.value);
                        setMilesSource('manual');
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Drop & Hook
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={dropAndHook}
                      onChange={(e) => setDropAndHook(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Chain Up Cycles
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={chainUpCycles}
                      onChange={(e) => setChainUpCycles(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Wait Time Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Wait Time
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={waitTimeStart}
                      onChange={(e) => setWaitTimeStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={waitTimeEnd}
                      onChange={(e) => setWaitTimeEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {calculatedWaitTime && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Calculated Wait Time: <span className="font-medium">{calculatedWaitTime.formatted}</span>
                      <span className="text-blue-500 dark:text-blue-400 ml-2">({calculatedWaitTime.minutes} minutes)</span>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wait Time Reason
                      {hasWaitTime && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={waitTimeReason}
                      onChange={(e) => setWaitTimeReason(e.target.value as WaitTimeReason | '')}
                      required={hasWaitTime}
                      className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        hasWaitTime && !waitTimeReason
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <option value="">Select reason...</option>
                      {waitTimeReasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes
                      {hasWaitTime && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={hasWaitTime ? "Required - describe the wait time..." : "Additional notes..."}
                      required={hasWaitTime}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                        hasWaitTime && !notes.trim()
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Equipment Issue Section (OWNOP only) */}
              {isOwnOp && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
                    Equipment Issue (Owner Operator)
                  </h4>

                  <div className="mb-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={hasEquipmentIssue}
                        onChange={(e) => setHasEquipmentIssue(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Report an equipment issue
                      </span>
                    </label>
                  </div>

                  {hasEquipmentIssue && (
                    <div className="space-y-4 pl-6 border-l-2 border-amber-300 dark:border-amber-600">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Equipment Type
                        </label>
                        <div className="flex space-x-4">
                          {equipmentTypeOptions.map((option) => (
                            <label key={option.value} className="flex items-center">
                              <input
                                type="radio"
                                value={option.value}
                                checked={equipmentType === option.value}
                                onChange={(e) => setEquipmentType(e.target.value as EquipmentIssueType)}
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                              />
                              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                {option.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Equipment Number
                        </label>
                        <input
                          type="text"
                          value={equipmentNumber}
                          onChange={(e) => setEquipmentNumber(e.target.value)}
                          placeholder="Enter equipment number..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Issue Description
                        </label>
                        <textarea
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          placeholder="Describe the equipment issue..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={arrivalMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {arrivalMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Arriving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Arrival
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
