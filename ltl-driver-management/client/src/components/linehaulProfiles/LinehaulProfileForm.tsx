import React, { useState, useEffect } from 'react';
import { LinehaulProfile, Terminal, EquipmentConfig } from '../../types';

interface LinehaulProfileFormProps {
  profile?: LinehaulProfile | null;
  terminals: Terminal[];
  onSubmit: (data: Partial<LinehaulProfile>) => void;
  onCancel: () => void;
}

const frequencyOptions = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MON_FRI', label: 'Monday - Friday' },
  { value: 'MON_SAT', label: 'Monday - Saturday' },
  { value: 'TUE_SAT', label: 'Tuesday - Saturday' },
  { value: 'AS_NEEDED', label: 'As Needed' }
];

const equipmentConfigs: { value: EquipmentConfig; label: string }[] = [
  { value: 'SINGLE', label: 'Single Trailer' },
  { value: 'DOUBLE', label: 'Doubles (2 trailers)' },
  { value: 'TRIPLE', label: 'Triples (3 trailers)' },
  { value: 'ROCKY_MOUNTAIN', label: 'Rocky Mountain Doubles' },
  { value: 'TURNPIKE', label: 'Turnpike Doubles' }
];

export const LinehaulProfileForm: React.FC<LinehaulProfileFormProps> = ({
  profile,
  terminals,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    profileCode: '',
    name: '',
    originTerminalId: '',
    destinationTerminalId: '',
    standardDepartureTime: '',
    standardArrivalTime: '',
    distanceMiles: '',
    transitTimeMinutes: '',
    equipmentConfig: 'SINGLE' as EquipmentConfig,
    requiresTeamDriver: false,
    hazmatRequired: false,
    frequency: 'DAILY',
    notes: '',
    active: true
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        profileCode: profile.profileCode || '',
        name: profile.name || '',
        originTerminalId: profile.originTerminalId?.toString() || '',
        destinationTerminalId: profile.destinationTerminalId?.toString() || '',
        standardDepartureTime: profile.standardDepartureTime || '',
        standardArrivalTime: profile.standardArrivalTime || '',
        distanceMiles: profile.distanceMiles?.toString() || '',
        transitTimeMinutes: profile.transitTimeMinutes?.toString() || '',
        equipmentConfig: profile.equipmentConfig || 'SINGLE',
        requiresTeamDriver: profile.requiresTeamDriver || false,
        hazmatRequired: profile.hazmatRequired || false,
        frequency: profile.frequency || 'DAILY',
        notes: profile.notes || '',
        active: profile.active !== undefined ? profile.active : true
      });
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      profileCode: formData.profileCode.toUpperCase(),
      name: formData.name,
      originTerminalId: formData.originTerminalId ? parseInt(formData.originTerminalId) : undefined,
      destinationTerminalId: formData.destinationTerminalId ? parseInt(formData.destinationTerminalId) : undefined,
      standardDepartureTime: formData.standardDepartureTime || undefined,
      standardArrivalTime: formData.standardArrivalTime || undefined,
      distanceMiles: formData.distanceMiles ? parseInt(formData.distanceMiles) : undefined,
      transitTimeMinutes: formData.transitTimeMinutes ? parseInt(formData.transitTimeMinutes) : undefined,
      equipmentConfig: formData.equipmentConfig || undefined,
      requiresTeamDriver: formData.requiresTeamDriver,
      hazmatRequired: formData.hazmatRequired,
      frequency: formData.frequency || undefined,
      notes: formData.notes || undefined,
      active: formData.active
    });
  };

  const formatTransitTime = (minutes: string) => {
    if (!minutes) return '';
    const mins = parseInt(minutes);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Profile Code *</label>
          <input
            type="text"
            required
            maxLength={20}
            value={formData.profileCode}
            onChange={(e) => setFormData({ ...formData, profileCode: e.target.value.toUpperCase() })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="LAX-PHX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Profile Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Los Angeles to Phoenix"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Origin Terminal *</label>
          <select
            required
            value={formData.originTerminalId}
            onChange={(e) => setFormData({ ...formData, originTerminalId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Origin Terminal</option>
            {terminals.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {terminal.code} - {terminal.name} ({terminal.city}, {terminal.state})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Destination Terminal *</label>
          <select
            required
            value={formData.destinationTerminalId}
            onChange={(e) => setFormData({ ...formData, destinationTerminalId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Select Destination Terminal</option>
            {terminals.map((terminal) => (
              <option key={terminal.id} value={terminal.id}>
                {terminal.code} - {terminal.name} ({terminal.city}, {terminal.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Standard Departure Time</label>
          <input
            type="time"
            value={formData.standardDepartureTime}
            onChange={(e) => setFormData({ ...formData, standardDepartureTime: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Standard Arrival Time</label>
          <input
            type="time"
            value={formData.standardArrivalTime}
            onChange={(e) => setFormData({ ...formData, standardArrivalTime: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Distance (miles)</label>
          <input
            type="number"
            min="0"
            value={formData.distanceMiles}
            onChange={(e) => setFormData({ ...formData, distanceMiles: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="350"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Transit Time (minutes)
            {formData.transitTimeMinutes && (
              <span className="text-gray-500 ml-2">({formatTransitTime(formData.transitTimeMinutes)})</span>
            )}
          </label>
          <input
            type="number"
            min="0"
            value={formData.transitTimeMinutes}
            onChange={(e) => setFormData({ ...formData, transitTimeMinutes: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="360"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Equipment Configuration</label>
          <select
            value={formData.equipmentConfig}
            onChange={(e) => setFormData({ ...formData, equipmentConfig: e.target.value as EquipmentConfig })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {equipmentConfigs.map((config) => (
              <option key={config.value} value={config.value}>{config.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Frequency</label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {frequencyOptions.map((freq) => (
              <option key={freq.value} value={freq.value}>{freq.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="requiresTeamDriver"
            checked={formData.requiresTeamDriver}
            onChange={(e) => setFormData({ ...formData, requiresTeamDriver: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="requiresTeamDriver" className="ml-2 block text-sm text-gray-900">
            Requires Team Driver
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="hazmatRequired"
            checked={formData.hazmatRequired}
            onChange={(e) => setFormData({ ...formData, hazmatRequired: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="hazmatRequired" className="ml-2 block text-sm text-gray-900">
            Hazmat Required
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
          {profile ? 'Update Profile' : 'Add Profile'}
        </button>
      </div>
    </form>
  );
};
