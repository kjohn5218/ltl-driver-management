import React from 'react';
import { X, Building2, Phone, MapPin, Clock, FileText } from 'lucide-react';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const companyInfo = {
    name: 'CrossCountry Freight Solutions, Inc.',
    dotNumber: '313378',
    docketNumber: 'MC209657',
    phone: '(800) 521-0287',
    fax: '',
    address: {
      street: '1929 Hancock Driver',
      city: 'BISMARCK',
      state: 'North Dakota',
      zipCode: '58501',
      country: 'United States'
    },
    timeZone: '(UTC-06:00) Central Time (US & Canada)'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Company Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Company Name */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Company Name</h3>
            </div>
            <p className="text-lg font-medium text-blue-800">{companyInfo.name}</p>
          </div>

          {/* Regulatory Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">DOT Number</h4>
              </div>
              <p className="text-gray-800 font-mono text-lg">{companyInfo.dotNumber}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <h4 className="font-medium text-gray-900">Docket Number</h4>
              </div>
              <p className="text-gray-800 font-mono text-lg">{companyInfo.docketNumber}</p>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Phone Number</p>
                  <p className="text-gray-700">{companyInfo.phone}</p>
                </div>
              </div>

              {companyInfo.fax && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Fax</p>
                    <p className="text-gray-700">{companyInfo.fax}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-red-600 mt-1" />
              <div>
                <p className="text-gray-800">{companyInfo.address.street}</p>
                <p className="text-gray-800">
                  {companyInfo.address.city}, {companyInfo.address.state} {companyInfo.address.zipCode}
                </p>
                <p className="text-gray-800">{companyInfo.address.country}</p>
              </div>
            </div>
          </div>

          {/* Time Zone */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Zone</h3>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-purple-600" />
              <p className="text-gray-800">{companyInfo.timeZone}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};