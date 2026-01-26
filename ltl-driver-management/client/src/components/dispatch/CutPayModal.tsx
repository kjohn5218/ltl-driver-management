import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Scissors, Clock, X, Search, Loader2 } from 'lucide-react';
import { Route as RouteIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { driverService } from '../../services/driverService';
import { cutPayService, TrailerConfig, CutPayType } from '../../services/cutPayService';
import { CarrierDriver } from '../../types';

// Cut pay reason options
const CUT_PAY_REASONS = [
  { value: 'LOW_FREIGHT_VOLUME', label: 'Low freight volume' },
  { value: 'EQUIPMENT_UNAVAILABLE', label: 'Equipment unavailable' },
  { value: 'WEATHER_DELAY', label: 'Weather delay' },
  { value: 'OTHER', label: 'Other' }
];

interface CutPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CutPayModal: React.FC<CutPayModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const queryClient = useQueryClient();

  // Driver selection state
  const [selectedDriver, setSelectedDriver] = useState<CarrierDriver | null>(null);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverDropdownOpen, setDriverDropdownOpen] = useState(false);

  // Cut pay form state
  const [cutPayType, setCutPayType] = useState<CutPayType>('HOURS');
  const [cutPayHours, setCutPayHours] = useState<string>('');
  const [cutPayMiles, setCutPayMiles] = useState<string>('');
  const [cutPayTrailerConfig, setCutPayTrailerConfig] = useState<TrailerConfig>('SINGLE');
  const [cutPayReason, setCutPayReason] = useState<string>('LOW_FREIGHT_VOLUME');
  const [cutPayReasonOther, setCutPayReasonOther] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch drivers
  const { data: driversData } = useQuery({
    queryKey: ['drivers', 'active'],
    queryFn: () => driverService.getDrivers({ active: true, limit: 500 }),
    enabled: isOpen
  });

  const drivers = driversData?.drivers || [];

  // Filter drivers based on search
  const filteredDrivers = useMemo(() => {
    if (!driverSearch.trim()) return drivers.slice(0, 20);
    const search = driverSearch.toLowerCase();
    return drivers
      .filter(d =>
        d.name?.toLowerCase().includes(search) ||
        d.number?.toLowerCase().includes(search)
      )
      .slice(0, 20);
  }, [drivers, driverSearch]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDriver(null);
      setDriverSearch('');
      setDriverDropdownOpen(false);
      setCutPayType('HOURS');
      setCutPayHours('');
      setCutPayMiles('');
      setCutPayTrailerConfig('SINGLE');
      setCutPayReason('LOW_FREIGHT_VOLUME');
      setCutPayReasonOther('');
      setNotes('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedDriver) {
      toast.error('Please select a driver');
      return;
    }

    if (cutPayType === 'HOURS' && (!cutPayHours || parseFloat(cutPayHours) <= 0)) {
      toast.error('Please enter cut hours');
      return;
    }

    if (cutPayType === 'MILES' && (!cutPayMiles || parseFloat(cutPayMiles) <= 0)) {
      toast.error('Please enter cut miles');
      return;
    }

    if (cutPayReason === 'OTHER' && !cutPayReasonOther.trim()) {
      toast.error('Please specify the reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const reasonText = cutPayReason === 'OTHER'
        ? cutPayReasonOther
        : CUT_PAY_REASONS.find(r => r.value === cutPayReason)?.label || cutPayReason;

      await cutPayService.createCutPayRequest({
        driverId: selectedDriver.id,
        trailerConfig: cutPayTrailerConfig,
        cutPayType: cutPayType,
        hoursRequested: cutPayType === 'HOURS' ? parseFloat(cutPayHours) : undefined,
        milesRequested: cutPayType === 'MILES' ? parseFloat(cutPayMiles) : undefined,
        reason: reasonText,
        notes: notes || undefined
      });

      toast.success('Cut pay request submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['cut-pay-requests'] });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error creating cut pay request:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create cut pay request';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enter Cut Pay Request" size="lg">
      <div className="space-y-6">
        {/* Info banner */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start">
            <Scissors className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-orange-800 dark:text-orange-200">
              Submit a cut pay request when a driver is unable to work due to low freight volume,
              equipment unavailability, or other reasons. The request will be reviewed and approved by payroll.
            </p>
          </div>
        </div>

        {/* Driver Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Driver *
          </label>
          {selectedDriver ? (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{selectedDriver.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">#{selectedDriver.number}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedDriver(null); setDriverSearch(''); }}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={driverSearch}
                onChange={(e) => { setDriverSearch(e.target.value); setDriverDropdownOpen(true); }}
                onFocus={() => setDriverDropdownOpen(true)}
                placeholder="Search by name or driver number..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {driverDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredDrivers.length > 0 ? (
                    filteredDrivers.map((driver) => (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => {
                          setSelectedDriver(driver);
                          setDriverSearch('');
                          setDriverDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{driver.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">#{driver.number}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-gray-500 dark:text-gray-400">No drivers found</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cut Pay Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Cut Pay Type *
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="cutPayType"
                checked={cutPayType === 'HOURS'}
                onChange={() => setCutPayType('HOURS')}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
              />
              <Clock className="h-4 w-4 ml-2 mr-1 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">Hours</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="cutPayType"
                checked={cutPayType === 'MILES'}
                onChange={() => setCutPayType('MILES')}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
              />
              <RouteIcon className="h-4 w-4 ml-2 mr-1 text-gray-500" />
              <span className="text-gray-700 dark:text-gray-300">Miles</span>
            </label>
          </div>
        </div>

        {/* Hours or Miles Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cutPayType === 'HOURS' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cut Hours *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={cutPayHours}
                  onChange={(e) => setCutPayHours(e.target.value)}
                  placeholder="Enter hours..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cut Miles *
              </label>
              <div className="relative">
                <RouteIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="1000"
                  value={cutPayMiles}
                  onChange={(e) => setCutPayMiles(e.target.value)}
                  placeholder="Enter miles..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Trailer Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Trailer Configuration *
            </label>
            <select
              value={cutPayTrailerConfig}
              onChange={(e) => setCutPayTrailerConfig(e.target.value as TrailerConfig)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="SINGLE">Single</option>
              <option value="DOUBLE">Double</option>
              <option value="TRIPLE">Triple</option>
            </select>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason *
          </label>
          <select
            value={cutPayReason}
            onChange={(e) => setCutPayReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            {CUT_PAY_REASONS.map(reason => (
              <option key={reason.value} value={reason.value}>{reason.label}</option>
            ))}
          </select>
        </div>

        {cutPayReason === 'OTHER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Specify Reason *
            </label>
            <input
              type="text"
              value={cutPayReasonOther}
              onChange={(e) => setCutPayReasonOther(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedDriver}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4 mr-2" />
                Submit Cut Pay Request
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
