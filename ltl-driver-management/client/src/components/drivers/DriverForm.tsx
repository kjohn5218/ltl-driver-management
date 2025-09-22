import React, { useState, useEffect } from 'react';
import { CarrierDriver, Carrier } from '../../types';
import { User, Hash, Phone, Mail, CreditCard, Truck } from 'lucide-react';

interface DriverFormProps {
  driver?: CarrierDriver | null;
  carriers: Carrier[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const DriverForm: React.FC<DriverFormProps> = ({
  driver,
  carriers,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    carrierId: driver?.carrierId || '',
    name: driver?.name || '',
    number: driver?.number || '',
    phoneNumber: driver?.phoneNumber || '',
    email: driver?.email || '',
    licenseNumber: driver?.licenseNumber || '',
    active: driver?.active ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      carrierId: parseInt(formData.carrierId as string),
      phoneNumber: formData.phoneNumber || undefined,
      email: formData.email || undefined,
      licenseNumber: formData.licenseNumber || undefined,
      number: formData.number || undefined
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Carrier Selection */}
      <div>
        <label htmlFor="carrierId" className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Truck className="w-4 h-4 mr-2" />
          Carrier *
        </label>
        <select
          id="carrierId"
          name="carrierId"
          value={formData.carrierId}
          onChange={handleChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
            errors.carrierId ? 'border-red-300' : ''
          }`}
        >
          <option value="">Select a carrier</option>
          {carriers.map((carrier) => (
            <option key={carrier.id} value={carrier.id}>
              {carrier.name}
            </option>
          ))}
        </select>
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