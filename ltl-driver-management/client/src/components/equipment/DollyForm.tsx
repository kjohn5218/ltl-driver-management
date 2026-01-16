import React, { useState, useEffect } from 'react';
import { EquipmentDolly, DollyType, EquipmentStatus, Location } from '../../types';

interface DollyFormProps {
  dolly?: EquipmentDolly | null;
  locations: Location[];
  onSubmit: (data: Partial<EquipmentDolly>) => void;
  onCancel: () => void;
}

const dollyTypes: { value: DollyType; label: string }[] = [
  { value: 'A_DOLLY', label: 'A-Dolly (Converter)' },
  { value: 'B_DOLLY', label: 'B-Dolly (Fixed)' }
];

const statusOptions: { value: EquipmentStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service' }
];

export const DollyForm: React.FC<DollyFormProps> = ({
  dolly,
  locations,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    unitNumber: '',
    dollyType: 'A_DOLLY' as DollyType,
    currentTerminalId: '',
    status: 'AVAILABLE' as EquipmentStatus,
    maintenanceNotes: ''
  });

  useEffect(() => {
    if (dolly) {
      setFormData({
        unitNumber: dolly.unitNumber || '',
        dollyType: dolly.dollyType || 'A_DOLLY',
        currentTerminalId: dolly.currentTerminalId?.toString() || '',
        status: dolly.status || 'AVAILABLE',
        maintenanceNotes: dolly.maintenanceNotes || ''
      });
    }
  }, [dolly]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      unitNumber: formData.unitNumber,
      dollyType: formData.dollyType,
      currentTerminalId: formData.currentTerminalId ? parseInt(formData.currentTerminalId) : undefined,
      status: formData.status,
      maintenanceNotes: formData.maintenanceNotes || undefined
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Unit Number *</label>
          <input
            type="text"
            required
            value={formData.unitNumber}
            onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Dolly Type *</label>
          <select
            required
            value={formData.dollyType}
            onChange={(e) => setFormData({ ...formData, dollyType: e.target.value as DollyType })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {dollyTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Current Location</label>
          <select
            value={formData.currentTerminalId}
            onChange={(e) => setFormData({ ...formData, currentTerminalId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.code} - {location.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Maintenance Notes</label>
        <textarea
          rows={3}
          value={formData.maintenanceNotes}
          onChange={(e) => setFormData({ ...formData, maintenanceNotes: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
        >
          {dolly ? 'Update Dolly' : 'Add Dolly'}
        </button>
      </div>
    </form>
  );
};
