import React, { useState, useEffect } from 'react';
import {
  LinehaulTrip,
  LinehaulProfile,
  CarrierDriver,
  EquipmentTruck,
  EquipmentTrailer,
  EquipmentDolly,
  TripStatus
} from '../../types';

interface TripFormProps {
  trip?: LinehaulTrip | null;
  profiles: LinehaulProfile[];
  drivers: CarrierDriver[];
  trucks: EquipmentTruck[];
  trailers: EquipmentTrailer[];
  dollies: EquipmentDolly[];
  onSubmit: (data: Partial<LinehaulTrip>) => void;
  onCancel: () => void;
}

const statusOptions: { value: TripStatus; label: string }[] = [
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'DISPATCHED', label: 'Dispatched' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

export const TripForm: React.FC<TripFormProps> = ({
  trip,
  profiles,
  drivers,
  trucks,
  trailers,
  dollies,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    linehaulProfileId: '',
    dispatchDate: new Date().toISOString().split('T')[0],
    plannedDeparture: '',
    plannedArrival: '',
    driverId: '',
    teamDriverId: '',
    truckId: '',
    trailerId: '',
    trailer2Id: '',
    dollyId: '',
    status: 'PLANNED' as TripStatus,
    notes: ''
  });

  useEffect(() => {
    if (trip) {
      setFormData({
        linehaulProfileId: trip.linehaulProfileId?.toString() || '',
        dispatchDate: trip.dispatchDate ? new Date(trip.dispatchDate).toISOString().split('T')[0] : '',
        plannedDeparture: trip.plannedDeparture ? trip.plannedDeparture.substring(0, 16) : '',
        plannedArrival: trip.plannedArrival ? trip.plannedArrival.substring(0, 16) : '',
        driverId: trip.driverId?.toString() || '',
        teamDriverId: trip.teamDriverId?.toString() || '',
        truckId: trip.truckId?.toString() || '',
        trailerId: trip.trailerId?.toString() || '',
        trailer2Id: trip.trailer2Id?.toString() || '',
        dollyId: trip.dollyId?.toString() || '',
        status: trip.status || 'PLANNED',
        notes: trip.notes || ''
      });
    }
  }, [trip]);

  const handleProfileChange = (profileId: string) => {
    setFormData({ ...formData, linehaulProfileId: profileId });

    // Auto-fill departure/arrival times from profile
    if (profileId) {
      const profile = profiles.find(p => p.id === parseInt(profileId));
      if (profile) {
        setFormData(prev => ({
          ...prev,
          linehaulProfileId: profileId,
          plannedDeparture: profile.standardDepartureTime || '',
          plannedArrival: profile.standardArrivalTime || ''
        }));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      linehaulProfileId: formData.linehaulProfileId ? parseInt(formData.linehaulProfileId) : undefined,
      dispatchDate: formData.dispatchDate || undefined,
      plannedDeparture: formData.plannedDeparture || undefined,
      plannedArrival: formData.plannedArrival || undefined,
      driverId: formData.driverId ? parseInt(formData.driverId) : undefined,
      teamDriverId: formData.teamDriverId ? parseInt(formData.teamDriverId) : undefined,
      truckId: formData.truckId ? parseInt(formData.truckId) : undefined,
      trailerId: formData.trailerId ? parseInt(formData.trailerId) : undefined,
      trailer2Id: formData.trailer2Id ? parseInt(formData.trailer2Id) : undefined,
      dollyId: formData.dollyId ? parseInt(formData.dollyId) : undefined,
      status: formData.status,
      notes: formData.notes || undefined
    });
  };

  const selectedProfile = profiles.find(p => p.id === parseInt(formData.linehaulProfileId));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Profile Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Linehaul Profile *</label>
        <select
          required
          value={formData.linehaulProfileId}
          onChange={(e) => handleProfileChange(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select Profile</option>
          {[...profiles].sort((a, b) => (a.profileCode || '').localeCompare(b.profileCode || '')).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.profileCode} - {profile.name}
            </option>
          ))}
        </select>
        {selectedProfile && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedProfile.originTerminal?.code} to {selectedProfile.destinationTerminal?.code}
            {selectedProfile.distanceMiles && ` | ${selectedProfile.distanceMiles} miles`}
          </p>
        )}
      </div>

      {/* Date and Times */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Dispatch Date *</label>
          <input
            type="date"
            required
            value={formData.dispatchDate}
            onChange={(e) => setFormData({ ...formData, dispatchDate: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Departure Time</label>
          <input
            type="time"
            value={formData.plannedDeparture}
            onChange={(e) => setFormData({ ...formData, plannedDeparture: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Arrival Time</label>
          <input
            type="time"
            value={formData.plannedArrival}
            onChange={(e) => setFormData({ ...formData, plannedArrival: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Driver Assignment */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Driver</label>
          <select
            value={formData.driverId}
            onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Driver</option>
            {[...drivers].filter(d => d.active).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} {driver.number && `(#${driver.number})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Team Driver</label>
          <select
            value={formData.teamDriverId}
            onChange={(e) => setFormData({ ...formData, teamDriverId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Team Driver (optional)</option>
            {[...drivers].filter(d => d.active && d.id !== parseInt(formData.driverId)).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name} {driver.number && `(#${driver.number})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Equipment Assignment */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Truck</label>
          <select
            value={formData.truckId}
            onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Truck</option>
            {[...trucks].filter(t => t.status === 'AVAILABLE' || t.id === trip?.truckId).sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || '')).map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.unitNumber} - {truck.make} {truck.model}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Trailer 1</label>
          <select
            value={formData.trailerId}
            onChange={(e) => setFormData({ ...formData, trailerId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Trailer</option>
            {[...trailers].filter(t => t.status === 'AVAILABLE' || t.id === trip?.trailerId).sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || '')).map((trailer) => (
              <option key={trailer.id} value={trailer.id}>
                {trailer.unitNumber} - {trailer.trailerType} ({trailer.lengthFeet}')
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Trailer 2 (if doubles)</label>
          <select
            value={formData.trailer2Id}
            onChange={(e) => setFormData({ ...formData, trailer2Id: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Second Trailer (optional)</option>
            {[...trailers].filter(t => (t.status === 'AVAILABLE' || t.id === trip?.trailer2Id) && t.id !== parseInt(formData.trailerId)).sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || '')).map((trailer) => (
              <option key={trailer.id} value={trailer.id}>
                {trailer.unitNumber} - {trailer.trailerType} ({trailer.lengthFeet}')
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Dolly (if doubles)</label>
          <select
            value={formData.dollyId}
            onChange={(e) => setFormData({ ...formData, dollyId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Dolly (optional)</option>
            {[...dollies].filter(d => d.status === 'AVAILABLE' || d.id === trip?.dollyId).sort((a, b) => (a.unitNumber || '').localeCompare(b.unitNumber || '')).map((dolly) => (
              <option key={dolly.id} value={dolly.id}>
                {dolly.unitNumber} - {dolly.dollyType}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status */}
      {trip && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as TripStatus })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Any special instructions or notes..."
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
          {trip ? 'Update Trip' : 'Create Trip'}
        </button>
      </div>
    </form>
  );
};
