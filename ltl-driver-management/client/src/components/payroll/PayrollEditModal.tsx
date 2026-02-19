import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { PayrollLineItem, PayrollLineItemUpdate } from '../../types';
import { DollarSign, User, MapPin, Calendar, Truck, FileText, ChevronDown, ChevronUp, Package, Clock } from 'lucide-react';

interface PayrollEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PayrollLineItem | null;
  onSave: (type: 'trip' | 'cut', id: number, data: PayrollLineItemUpdate) => Promise<void>;
}

export const PayrollEditModal: React.FC<PayrollEditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSave
}) => {
  const [formData, setFormData] = useState({
    basePay: 0,
    mileagePay: 0,
    dropAndHookPay: 0,
    chainUpPay: 0,
    waitTimePay: 0,
    otherAccessorialPay: 0,
    bonusPay: 0,
    deductions: 0,
    totalPay: 0,
    notes: '',
    status: '',
    // Editable trip info fields
    totalMiles: 0,
    dropAndHookCount: 0,
    chainUpCount: 0,
    waitTimeMinutes: 0,
    trailerConfig: ''
  });
  const [saving, setSaving] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        basePay: item.basePay || 0,
        mileagePay: item.mileagePay || 0,
        dropAndHookPay: item.dropAndHookPay || 0,
        chainUpPay: item.chainUpPay || 0,
        waitTimePay: item.waitTimePay || 0,
        otherAccessorialPay: item.otherAccessorialPay || 0,
        bonusPay: item.bonusPay || 0,
        deductions: item.deductions || 0,
        totalPay: item.totalGrossPay || 0,
        notes: item.notes || '',
        status: item.status || '',
        totalMiles: item.totalMiles || 0,
        dropAndHookCount: item.dropAndHookCount || 0,
        chainUpCount: item.chainUpCount || 0,
        waitTimeMinutes: item.waitTimeMinutes || 0,
        trailerConfig: item.trailerConfig || ''
      });
    }
  }, [item]);

  // Calculate total when individual amounts change
  useEffect(() => {
    if (item?.source === 'TRIP_PAY') {
      const total = formData.basePay + formData.mileagePay +
                    formData.dropAndHookPay + formData.chainUpPay +
                    formData.waitTimePay + formData.otherAccessorialPay +
                    formData.bonusPay - formData.deductions;
      setFormData(prev => ({ ...prev, totalPay: Math.round(total * 100) / 100 }));
    }
  }, [
    formData.basePay,
    formData.mileagePay,
    formData.dropAndHookPay,
    formData.chainUpPay,
    formData.waitTimePay,
    formData.otherAccessorialPay,
    formData.bonusPay,
    formData.deductions,
    item?.source
  ]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const type = item.source === 'TRIP_PAY' ? 'trip' : 'cut';
      const updateData: PayrollLineItemUpdate = {
        notes: formData.notes
      };

      // Include status if it was changed
      if (formData.status && formData.status !== item.status) {
        updateData.status = formData.status;
      }

      if (item.source === 'TRIP_PAY') {
        const totalAccessorial = formData.dropAndHookPay + formData.chainUpPay +
                                 formData.waitTimePay + formData.otherAccessorialPay;
        updateData.basePay = formData.basePay;
        updateData.mileagePay = formData.mileagePay;
        updateData.accessorialPay = totalAccessorial;
        updateData.bonusPay = formData.bonusPay;
        updateData.deductions = formData.deductions;
        // Trip info fields
        updateData.totalMiles = formData.totalMiles;
        updateData.dropAndHookCount = formData.dropAndHookCount;
        updateData.chainUpCount = formData.chainUpCount;
        updateData.waitTimeMinutes = formData.waitTimeMinutes;
        updateData.trailerConfig = formData.trailerConfig;
      } else {
        // For cut pay, only allow total and notes to be edited
        updateData.totalPay = formData.totalPay;
      }

      await onSave(type, item.sourceId, updateData);
      onClose();
    } catch (error) {
      console.error('Error saving payroll item:', error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (!item) return null;

  const isTripPay = item.source === 'TRIP_PAY';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${isTripPay ? 'Trip Pay' : 'Cut Pay'}`}
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Item Info */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <User className="w-4 h-4 mr-2" />
            <span className="font-medium">{item.driverName}</span>
            {item.driverNumber && <span className="ml-2 text-gray-500">#{item.driverNumber}</span>}
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{new Date(item.date).toLocaleDateString()}</span>
          </div>
          {isTripPay && item.tripNumber && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <Truck className="w-4 h-4 mr-2" />
              <span>{item.tripNumber}</span>
            </div>
          )}
          {isTripPay && (item.origin || item.destination) && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{item.origin || '?'} → {item.destination || '?'}</span>
            </div>
          )}
          {!isTripPay && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <FileText className="w-4 h-4 mr-2" />
              <span>
                {item.cutPayType === 'HOURS'
                  ? `${item.cutPayHours} hours`
                  : `${item.cutPayMiles} miles (${item.trailerConfig})`
                }
                {item.reason && ` - ${item.reason}`}
              </span>
            </div>
          )}
        </div>

        {/* Trip Info - Editable for Trip Pay */}
        {isTripPay && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <Truck className="w-4 h-4 mr-2" />
              Trip Information
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Miles
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.totalMiles}
                  onChange={(e) => setFormData({ ...formData, totalMiles: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Equipment
                </label>
                <select
                  value={formData.trailerConfig}
                  onChange={(e) => setFormData({ ...formData, trailerConfig: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select Equipment</option>
                  <option value="SINGLE">Single</option>
                  <option value="DOUBLE">Doubles</option>
                  <option value="TRIPLE">Triples</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop & Hook Count
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.dropAndHookCount}
                  onChange={(e) => setFormData({ ...formData, dropAndHookCount: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Chain Up Cycles
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.chainUpCount}
                  onChange={(e) => setFormData({ ...formData, chainUpCount: parseInt(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Wait Time (minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.waitTimeMinutes}
                    onChange={(e) => setFormData({ ...formData, waitTimeMinutes: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {formData.waitTimeMinutes > 0 && (
                    <span className="mt-1 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      = {formatWaitTime(formData.waitTimeMinutes)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay Breakdown - Trip Pay */}
        {isTripPay && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Pay Breakdown
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Base Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.basePay}
                    onChange={(e) => setFormData({ ...formData, basePay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mileage Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mileagePay}
                    onChange={(e) => setFormData({ ...formData, mileagePay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Accessorials</h5>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400">
                  Drop & Hook Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.dropAndHookPay}
                    onChange={(e) => setFormData({ ...formData, dropAndHookPay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400">
                  Chain Up Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.chainUpPay}
                    onChange={(e) => setFormData({ ...formData, chainUpPay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400">
                  Wait Time Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.waitTimePay}
                    onChange={(e) => setFormData({ ...formData, waitTimePay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400">
                  Other Accessorials
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.otherAccessorialPay}
                    onChange={(e) => setFormData({ ...formData, otherAccessorialPay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Bonus Pay
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bonusPay}
                    onChange={(e) => setFormData({ ...formData, bonusPay: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Deductions
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay Amount - Cut Pay */}
        {!isTripPay && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Pay
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={formData.totalPay}
                onChange={(e) => setFormData({ ...formData, totalPay: parseFloat(e.target.value) || 0 })}
                className="pl-7 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* Total Display */}
        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100">Total Gross Pay</span>
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {formatCurrency(formData.totalPay)}
            </span>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETE">Complete</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="APPROVED">Approved</option>
            <option value="CANCELLED">Cancelled (Will not be exported to Workday)</option>
          </select>
          {formData.status === 'CANCELLED' && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              Cancelled items will not be exported to Workday.
            </p>
          )}
        </div>

        {/* Trip Details - Collapsible for Trip Pay */}
        {isTripPay && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <button
              type="button"
              onClick={() => setShowTripDetails(!showTripDetails)}
              className="w-full px-4 py-3 flex items-center justify-between text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                <Package className="w-4 h-4 mr-2" />
                View Trip Details
              </span>
              {showTripDetails ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {showTripDetails && (
              <div className="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Linehaul Codes:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {[item.linehaulCode1, item.linehaulCode2, item.linehaulCode3].filter(Boolean).join(' / ') || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Employer:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.employer || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Terminal:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.terminalCode || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Workday ID:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.workdayEmployeeId || '-'}</p>
                  </div>
                  {item.dispatchTime && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Dispatch Time:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {new Date(item.dispatchTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {item.arrivalTime && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Arrival Time:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {new Date(item.arrivalTime).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Work Hours:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.workHours ? `${item.workHours.toFixed(1)}h` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Stop Hours:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.stopHours ? `${item.stopHours.toFixed(1)}h` : '-'}
                    </p>
                  </div>
                  {item.waitTimeReason && (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Wait Time Reason:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {item.waitTimeReason.replace(/_/g, ' ')}
                      </p>
                    </div>
                  )}
                </div>
                {item.approvedAt && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Approved:</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(item.approvedAt).toLocaleString()}
                      {item.approvedBy && ` by ${item.approvedBy}`}
                    </p>
                  </div>
                )}
                {item.exportedAt && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">Exported to Workday:</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {new Date(item.exportedAt).toLocaleString()}
                      {item.exportedBy && ` by ${item.exportedBy}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Notes
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Add notes about this pay adjustment..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
