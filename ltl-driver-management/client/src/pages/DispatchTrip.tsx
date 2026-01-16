import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Truck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/common/PageHeader';
import { linehaulTripService } from '../services/linehaulTripService';
import { driverService } from '../services/driverService';
import { equipmentService } from '../services/equipmentService';
import { locationService } from '../services/locationService';
import { manifestService } from '../services/manifestService';
import { CarrierDriver, Manifest, DispatchTripRequest } from '../types';

export const DispatchTrip: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<DispatchTripRequest>>({
    isOwnerOperator: false
  });
  const [driverSearch, setDriverSearch] = useState('');
  const [manifestSearch, setManifestSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<CarrierDriver | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<Manifest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch drivers
  const { data: driversData } = useQuery({
    queryKey: ['drivers', driverSearch],
    queryFn: () => driverService.getDrivers({ search: driverSearch, limit: 20 }),
    enabled: driverSearch.length >= 2
  });

  // Fetch trucks (power units)
  const { data: trucksData } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => equipmentService.getTrucks({ status: 'AVAILABLE', limit: 100 })
  });

  // Fetch dollies
  const { data: dolliesData } = useQuery({
    queryKey: ['dollies'],
    queryFn: () => equipmentService.getDollies({ status: 'AVAILABLE', limit: 100 })
  });

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationService.getLocationsList()
  });

  // Fetch manifests
  const { data: manifests } = useQuery({
    queryKey: ['manifests', manifestSearch],
    queryFn: () => manifestService.getOpenManifests(),
    enabled: true
  });

  const trucks = trucksData?.trucks || [];
  const dollies = dolliesData?.dollies || [];
  const drivers = driversData?.drivers || [];

  const handleDriverSelect = (driver: CarrierDriver) => {
    setSelectedDriver(driver);
    setFormData(prev => ({ ...prev, driverId: driver.id }));
    setDriverSearch(driver.name);
  };

  const handleManifestSelect = (manifest: Manifest) => {
    setSelectedManifest(manifest);
    setFormData(prev => ({ ...prev, manifestId: manifest.id }));
    setManifestSearch(manifest.manifestNumber);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.driverId || !formData.originTerminalId || !formData.destinationTerminalId || !formData.powerUnitId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const tripData = {
        driverId: formData.driverId,
        truckId: formData.powerUnitId,
        dollyId: formData.dollyId,
        notes: formData.notes,
        status: 'DISPATCHED' as const
      };

      await linehaulTripService.createTrip(tripData);
      toast.success('Trip created and dispatched successfully');
      navigate('/dispatch');
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Failed to create trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch Trip"
        subtitle="Create and dispatch a new linehaul trip"
      />

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Driver Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search by Driver Detail *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder="Enter driver name or number..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {driverSearch.length >= 2 && drivers.length > 0 && !selectedDriver && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    {drivers.map((driver) => (
                      <button
                        key={driver.id}
                        type="button"
                        onClick={() => handleDriverSelect(driver)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        <span className="font-medium">{driver.name}</span>
                        {driver.number && <span className="text-gray-500 dark:text-gray-400 ml-2">#{driver.number}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedDriver && (
                <p className="mt-1 text-sm text-green-600">Selected: {selectedDriver.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Add 1st Manifest to Trip
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  placeholder="Search manifest number..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {manifests && manifests.length > 0 && !selectedManifest && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    {manifests
                      .filter(m => m.manifestNumber.toLowerCase().includes(manifestSearch.toLowerCase()))
                      .slice(0, 10)
                      .map((manifest) => (
                        <button
                          key={manifest.id}
                          type="button"
                          onClick={() => handleManifestSelect(manifest)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100"
                        >
                          {manifest.manifestNumber}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {selectedManifest && (
                <p className="mt-1 text-sm text-green-600">Selected: {selectedManifest.manifestNumber}</p>
              )}
            </div>
          </div>

          {/* Equipment Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Converter Dolly
              </label>
              <select
                value={formData.dollyId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, dollyId: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select dolly...</option>
                {dollies.map((dolly) => (
                  <option key={dolly.id} value={dolly.id}>
                    {dolly.unitNumber} - {dolly.dollyType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Seal Number
              </label>
              <input
                type="text"
                value={formData.sealNumber || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, sealNumber: e.target.value }))}
                placeholder="Enter seal number..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Origin & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Origin *
              </label>
              <select
                value={formData.originTerminalId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, originTerminalId: Number(e.target.value) }))}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select origin...</option>
                {locations?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name || location.city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Destination *
              </label>
              <select
                value={formData.destinationTerminalId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, destinationTerminalId: Number(e.target.value) }))}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select destination...</option>
                {locations?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name || location.city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Owner Operator & Power Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Is this an Owner Op?
              </label>
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isOwnerOperator"
                    checked={formData.isOwnerOperator === true}
                    onChange={() => setFormData(prev => ({ ...prev, isOwnerOperator: true }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Yes</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="isOwnerOperator"
                    checked={formData.isOwnerOperator === false}
                    onChange={() => setFormData(prev => ({ ...prev, isOwnerOperator: false }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">No</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Power Unit *
              </label>
              <select
                value={formData.powerUnitId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, powerUnitId: Number(e.target.value) }))}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select power unit...</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.unitNumber} - {truck.truckType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => navigate('/dispatch')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              <Truck className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
