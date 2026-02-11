import React, { useState, useEffect } from 'react';
import { EquipmentTruck, TruckType, EquipmentStatus, Location } from '../../types';

interface TruckFormProps {
  truck?: EquipmentTruck | null;
  locations: Location[];
  onSubmit: (data: Partial<EquipmentTruck>) => void;
  onCancel: () => void;
}

const truckTypes: { value: TruckType; label: string }[] = [
  { value: 'DAY_CAB', label: 'Day Cab' },
  { value: 'SLEEPER', label: 'Sleeper' },
  { value: 'STRAIGHT_TRUCK', label: 'Straight Truck' }
];

const statusOptions: { value: EquipmentStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OUT_OF_SERVICE', label: 'Out of Service' }
];

export const TruckForm: React.FC<TruckFormProps> = ({
  truck,
  locations,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    unitNumber: '',
    truckType: 'DAY_CAB' as TruckType,
    make: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    licensePlate: '',
    licensePlateState: '',
    currentTerminalId: '',
    status: 'AVAILABLE' as EquipmentStatus,
    maintenanceNotes: ''
  });

  useEffect(() => {
    if (truck) {
      setFormData({
        unitNumber: truck.unitNumber || '',
        truckType: truck.truckType || 'DAY_CAB',
        make: truck.make || '',
        model: truck.model || '',
        year: truck.year || new Date().getFullYear(),
        vin: truck.vin || '',
        licensePlate: truck.licensePlate || '',
        licensePlateState: truck.licensePlateState || '',
        currentTerminalId: truck.currentTerminalId?.toString() || '',
        status: truck.status || 'AVAILABLE',
        maintenanceNotes: truck.maintenanceNotes || ''
      });
    }
  }, [truck]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      unitNumber: formData.unitNumber,
      truckType: formData.truckType,
      make: formData.make || undefined,
      model: formData.model || undefined,
      year: formData.year,
      vin: formData.vin || undefined,
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
          <label className="block text-sm font-medium text-gray-700">Truck Type *</label>
          <select
            required
            value={formData.truckType}
            onChange={(e) => setFormData({ ...formData, truckType: e.target.value as TruckType })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {truckTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Make</label>
          <input
            type="text"
            value={formData.make}
            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Model</label>
          <input
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Year</label>
          <input
            type="number"
            min="1990"
            max="2030"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">VIN</label>
          <input
            type="text"
            value={formData.vin}
            onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          <label className="block text-sm font-medium text-gray-700">Current Terminal</label>
          <select
            value={formData.currentTerminalId}
            onChange={(e) => setFormData({ ...formData, currentTerminalId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Location</option>
            {[...locations].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map((location) => (
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
          {truck ? 'Update Truck' : 'Add Truck'}
        </button>
      </div>
    </form>
  );
};
