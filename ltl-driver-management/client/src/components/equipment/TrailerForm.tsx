import React, { useState, useEffect } from 'react';
import { EquipmentTrailer, TrailerType, EquipmentStatus, Location } from '../../types';

interface TrailerFormProps {
  trailer?: EquipmentTrailer | null;
  locations: Location[];
  onSubmit: (data: Partial<EquipmentTrailer>) => void;
  onCancel: () => void;
}

const trailerTypes: { value: TrailerType; label: string }[] = [
  { value: 'DRY_VAN_53', label: "Dry Van 53'" },
  { value: 'DRY_VAN_28', label: "Dry Van 28'" },
  { value: 'PUP_TRAILER', label: 'Pup Trailer' },
  { value: 'REEFER_53', label: "Reefer 53'" },
  { value: 'REEFER_28', label: "Reefer 28'" },
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'STEP_DECK', label: 'Step Deck' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'INTERMODAL', label: 'Intermodal' }
];

const statusOptions: { value: EquipmentStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service' }
];

export const TrailerForm: React.FC<TrailerFormProps> = ({
  trailer,
  locations,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    unitNumber: '',
    trailerType: 'DRY_VAN_53' as TrailerType,
    lengthFeet: 53,
    capacityWeight: '',
    licensePlate: '',
    licensePlateState: '',
    currentTerminalId: '',
    status: 'AVAILABLE' as EquipmentStatus,
    maintenanceNotes: ''
  });

  useEffect(() => {
    if (trailer) {
      setFormData({
        unitNumber: trailer.unitNumber || '',
        trailerType: trailer.trailerType || 'DRY_VAN_53',
        lengthFeet: trailer.lengthFeet || 53,
        capacityWeight: trailer.capacityWeight?.toString() || '',
        licensePlate: trailer.licensePlate || '',
        licensePlateState: trailer.licensePlateState || '',
        currentTerminalId: trailer.currentTerminalId?.toString() || '',
        status: trailer.status || 'AVAILABLE',
        maintenanceNotes: trailer.maintenanceNotes || ''
      });
    }
  }, [trailer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      unitNumber: formData.unitNumber,
      trailerType: formData.trailerType,
      lengthFeet: formData.lengthFeet,
      capacityWeight: formData.capacityWeight ? parseInt(formData.capacityWeight) : undefined,
      licensePlate: formData.licensePlate || undefined,
      licensePlateState: formData.licensePlateState || undefined,
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
          <label className="block text-sm font-medium text-gray-700">Trailer Type *</label>
          <select
            required
            value={formData.trailerType}
            onChange={(e) => setFormData({ ...formData, trailerType: e.target.value as TrailerType })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {trailerTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Length (feet)</label>
          <select
            value={formData.lengthFeet}
            onChange={(e) => setFormData({ ...formData, lengthFeet: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value={28}>28'</option>
            <option value={40}>40'</option>
            <option value={45}>45'</option>
            <option value={48}>48'</option>
            <option value={53}>53'</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Capacity (lbs)</label>
          <input
            type="number"
            value={formData.capacityWeight}
            onChange={(e) => setFormData({ ...formData, capacityWeight: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="45000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">License Plate</label>
          <input
            type="text"
            value={formData.licensePlate}
            onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">License State</label>
          <input
            type="text"
            maxLength={2}
            value={formData.licensePlateState}
            onChange={(e) => setFormData({ ...formData, licensePlateState: e.target.value.toUpperCase() })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="CA"
          />
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
          {trailer ? 'Update Trailer' : 'Add Trailer'}
        </button>
      </div>
    </form>
  );
};
