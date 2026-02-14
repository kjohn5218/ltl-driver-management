import React, { useState, useEffect } from 'react';
import { X, Truck, MapPin, Package, Scale, Clock, Calendar, Send, Loader2 } from 'lucide-react';
import { LoadItem } from './LoadsTab';
import { api } from '../../services/api';
import { toast } from 'react-hot-toast';

interface RequestContractPowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadItem: LoadItem | null;
  onSuccess: () => void;
}

export const RequestContractPowerModal: React.FC<RequestContractPowerModalProps> = ({
  isOpen,
  onClose,
  loadItem,
  onSuccess
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    manifestNumber: '',
    origin: '',
    destination: '',
    linehaulName: '',
    trailerNumber: '',
    trailerLength: 53,
    weight: 0,
    pieces: 0,
    scheduledDate: '',
    scheduledTime: '',
    notes: ''
  });

  // Reset form when loadItem changes
  useEffect(() => {
    if (loadItem) {
      setFormData({
        manifestNumber: loadItem.manifestNumber || '',
        origin: loadItem.originTerminalCode || '',
        destination: loadItem.destinationTerminalCode || '',
        linehaulName: loadItem.linehaulName || '',
        trailerNumber: loadItem.trailerNumber || '',
        trailerLength: loadItem.trailerLength || 53,
        weight: loadItem.weight || 0,
        pieces: loadItem.pieces || 0,
        scheduledDate: loadItem.scheduledDepartDate || '',
        scheduledTime: loadItem.scheduledDeparture || '',
        notes: ''
      });
    }
  }, [loadItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loadItem) return;

    setSubmitting(true);
    try {
      const response = await api.post('/contract-power/request', {
        loadsheetId: loadItem.id,
        manifestNumber: formData.manifestNumber,
        origin: formData.origin,
        destination: formData.destination,
        linehaulName: formData.linehaulName,
        trailerNumber: formData.trailerNumber,
        trailerLength: formData.trailerLength,
        weight: formData.weight,
        pieces: formData.pieces,
        scheduledDate: formData.scheduledDate,
        scheduledTime: formData.scheduledTime,
        notes: formData.notes
      });

      if (response.data.success) {
        toast.success('Contract power request submitted successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(response.data.message || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Failed to submit contract power request:', error);
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !loadItem) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Request Contract Power
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Load Information */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Load Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Manifest Number
                  </label>
                  <input
                    type="text"
                    value={formData.manifestNumber}
                    onChange={(e) => setFormData({ ...formData, manifestNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Linehaul
                  </label>
                  <input
                    type="text"
                    value={formData.linehaulName}
                    onChange={(e) => setFormData({ ...formData, linehaulName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Route Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Origin
                </label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Destination
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Trailer Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trailer Number
                </label>
                <input
                  type="text"
                  value={formData.trailerNumber}
                  onChange={(e) => setFormData({ ...formData, trailerNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trailer Length (ft)
                </label>
                <select
                  value={formData.trailerLength}
                  onChange={(e) => setFormData({ ...formData, trailerLength: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value={28}>28′</option>
                  <option value={40}>40′</option>
                  <option value={45}>45′</option>
                  <option value={48}>48′</option>
                  <option value={53}>53′</option>
                </select>
              </div>
            </div>

            {/* Load Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Scale className="w-4 h-4 inline mr-1" />
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Package className="w-4 h-4 inline mr-1" />
                  Pieces
                </label>
                <input
                  type="number"
                  value={formData.pieces}
                  onChange={(e) => setFormData({ ...formData, pieces: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Scheduled Time
                </label>
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Any special requirements or notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Request
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
