import React, { useState, useEffect } from 'react';
import { CarrierDriver, Location } from '../../types';
import { locationService } from '../../services/locationService';
import { CarrierSelect } from '../CarrierSelect';
import { User, Hash, Phone, Mail, CreditCard, Truck, MapPin, AlertTriangle, Users, Building } from 'lucide-react';

interface DriverFormProps {
  driver?: CarrierDriver | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const DriverForm: React.FC<DriverFormProps> = ({
  driver,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    carrierId: driver?.carrierId || '' as number | '',
    name: driver?.name || '',
    number: driver?.number || '',
    phoneNumber: driver?.phoneNumber || '',
    email: driver?.email || '',
    licenseNumber: driver?.licenseNumber || '',
    hazmatEndorsement: driver?.hazmatEndorsement ?? false,
    locationId: driver?.locationId ? driver.locationId.toString() : '',
    active: driver?.active ?? true,
    driverType: driver?.driverType || 'C'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Location[]>([]);

  // Fetch locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsList = await locationService.getLocationsList();
        setLocations(locationsList);
      } catch (error) {
        console.error('Failed to fetch locations:', error);
      }
    };
    fetchLocations();
  }, []);

  // Update form data when driver prop changes
  useEffect(() => {
    if (driver) {
      console.log('DriverForm: Setting driver data:', driver);
      console.log('DriverForm: CarrierId:', driver.carrierId);
      setFormData({
        carrierId: driver.carrierId || '' as number | '',
        name: driver.name || '',
        number: driver.number || '',
        phoneNumber: driver.phoneNumber || '',
        email: driver.email || '',
        licenseNumber: driver.licenseNumber || '',
        hazmatEndorsement: driver.hazmatEndorsement ?? false,
        locationId: driver.locationId ? driver.locationId.toString() : '',
        active: driver.active ?? true,
        driverType: driver.driverType || 'C'
      });
      // Clear any existing errors when driver changes
      setErrors({});
    }
  }, [driver]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.carrierId) {
      newErrors.carrierId = 'Carrier is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Driver name is required';
    }

    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      carrierId: formData.carrierId as number,
      phoneNumber: formData.phoneNumber || undefined,
      email: formData.email || undefined,
      licenseNumber: formData.licenseNumber || undefined,
      number: formData.number || undefined,
      hazmatEndorsement: formData.hazmatEndorsement,
      locationId: formData.locationId ? parseInt(formData.locationId as string) : null,
      driverType: formData.driverType
    };

    onSubmit(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleCarrierChange = (value: number | '') => {
    setFormData(prev => ({
      ...prev,
      carrierId: value
    }));

    // Clear error when carrier is selected
    if (errors.carrierId) {
      setErrors(prev => ({
        ...prev,
        carrierId: ''
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Carrier Selection */}
      <div>
        <label htmlFor="carrierId" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Truck className="w-4 h-4 mr-2" />
          Carrier *
          {driver && driver.carrier && (
            <span className="ml-2 text-xs text-gray-500">
              (Currently: {driver.carrier.name})
            </span>
          )}
        </label>
        <CarrierSelect
          value={formData.carrierId}
          onChange={handleCarrierChange}
          placeholder="Select a carrier..."
          showAllOption={false}
          className={errors.carrierId ? 'border-red-300' : ''}
        />
        {errors.carrierId && (
          <p className="mt-1 text-sm text-red-600">{errors.carrierId}</p>
        )}
      </div>

      {/* Driver Name */}
      <div>
        <label htmlFor="name" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <User className="w-4 h-4 mr-2" />
          Driver Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
            errors.name ? 'border-red-300' : ''
          }`}
          placeholder="Enter driver name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Driver Number */}
      <div>
        <label htmlFor="number" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Hash className="w-4 h-4 mr-2" />
          Driver Number
        </label>
        <input
          type="text"
          id="number"
          name="number"
          value={formData.number}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter driver number for dispatch"
        />
        <p className="mt-1 text-sm text-gray-500">
          Optional number used for dispatch identification
        </p>
      </div>

      {/* Phone Number */}
      <div>
        <label htmlFor="phoneNumber" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Phone className="w-4 h-4 mr-2" />
          Phone Number
        </label>
        <input
          type="tel"
          id="phoneNumber"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter phone number"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Mail className="w-4 h-4 mr-2" />
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
            errors.email ? 'border-red-300' : ''
          }`}
          placeholder="Enter email address"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* License Number */}
      <div>
        <label htmlFor="licenseNumber" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <CreditCard className="w-4 h-4 mr-2" />
          License Number
        </label>
        <input
          type="text"
          id="licenseNumber"
          name="licenseNumber"
          value={formData.licenseNumber}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Enter license number"
        />
      </div>

      {/* Hazmat Endorsement */}
      <div>
        <div className="flex items-center">
          <input
            id="hazmatEndorsement"
            name="hazmatEndorsement"
            type="checkbox"
            checked={formData.hazmatEndorsement}
            onChange={handleChange}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
          />
          <label htmlFor="hazmatEndorsement" className="ml-2 flex items-center text-sm text-gray-900">
            <AlertTriangle className="w-4 h-4 mr-1 text-orange-500" />
            Hazmat Endorsement
          </label>
        </div>
        <p className="mt-1 text-sm text-gray-500 ml-6">
          Check if driver has a valid hazmat endorsement on their CDL
        </p>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="locationId" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <MapPin className="w-4 h-4 mr-2" />
          Location
          {driver && driver.location && (
            <span className="ml-2 text-xs text-gray-500">
              (Currently: {driver.location.code}{driver.location.name ? ` - ${driver.location.name}` : ''})
            </span>
          )}
        </label>
        <select
          id="locationId"
          name="locationId"
          value={formData.locationId}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Select a location (optional)</option>
          {[...locations].sort((a, b) => (a.code || '').localeCompare(b.code || '')).map((location) => (
            <option key={location.id} value={location.id}>
              {location.code}{location.name ? ` - ${location.name}` : ''}{location.city && location.state ? ` (${location.city}, ${location.state})` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          Assign a home location for this driver
        </p>
      </div>

      {/* Driver Type */}
      <div>
        <label htmlFor="driverType" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Users className="w-4 h-4 mr-2" />
          Driver Type
        </label>
        <select
          id="driverType"
          name="driverType"
          value={formData.driverType}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="C">Contractor</option>
          <option value="E">Employee</option>
          <option value="T">Temp</option>
        </select>
        <p className="mt-1 text-sm text-gray-500">
          E=Employee, C=Contractor, T=Temp. Employees are synced from HR system.
        </p>
      </div>

      {/* HR Status (read-only, only show for existing drivers) */}
      {driver && driver.hrStatus && (
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Building className="w-4 h-4 mr-2" />
            HR Status
          </label>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            driver.hrStatus === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {driver.hrStatus}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            This status is managed by the HR system sync and cannot be changed manually.
          </p>
        </div>
      )}

      {/* Active Status (only show for editing) */}
      {driver && (
        <div>
          <div className="flex items-center">
            <input
              id="active"
              name="active"
              type="checkbox"
              checked={formData.active}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
              Driver is active
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Inactive drivers will not appear in booking forms
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
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
          {driver ? 'Update Driver' : 'Create Driver'}
        </button>
      </div>
    </form>
  );
};