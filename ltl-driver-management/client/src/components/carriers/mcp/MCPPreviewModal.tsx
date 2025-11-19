import React, { useState } from 'react';
import { X, Search, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface MCPPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCarrier?: (carrierData: any) => void;
}

export const MCPPreviewModal: React.FC<MCPPreviewModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelectCarrier 
}) => {
  const [dotNumber, setDotNumber] = useState('');
  const [mcNumber, setMcNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [carrierData, setCarrierData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!dotNumber.trim()) {
      toast.error('Please enter a DOT number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCarrierData(null);

      const params = new URLSearchParams({
        dotNumber: dotNumber.trim()
      });
      
      if (mcNumber.trim()) {
        params.append('mcNumber', mcNumber.trim());
      }

      const response = await axios.get(`/api/carriers/mcp/preview?${params}`);
      
      if (response.data.success) {
        setCarrierData(response.data.data);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to lookup carrier';
      setError(message);
      
      if (error.response?.status === 503) {
        setError('MyCarrierPackets integration is not configured. Please contact your administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCarrier = () => {
    if (onSelectCarrier && carrierData) {
      onSelectCarrier(carrierData);
      onClose();
      // Reset modal state
      setDotNumber('');
      setMcNumber('');
      setCarrierData(null);
      setError(null);
    }
  };

  const formatAddress = (data: any) => {
    const parts = [data.Address1, data.Address2, data.City, data.State, data.Zipcode]
      .filter(Boolean)
      .join(', ');
    return parts || 'Not available';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Lookup Carrier in MyCarrierPackets
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {/* Search Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="dot-number" className="block text-sm font-medium text-gray-700">
                  DOT Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="dot-number"
                  value={dotNumber}
                  onChange={(e) => setDotNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter DOT number"
                />
              </div>

              <div>
                <label htmlFor="mc-number" className="block text-sm font-medium text-gray-700">
                  MC Number (Optional)
                </label>
                <input
                  type="text"
                  id="mc-number"
                  value={mcNumber}
                  onChange={(e) => setMcNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter MC number"
                />
              </div>

              <button
                onClick={handleSearch}
                disabled={loading || !dotNumber.trim()}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="-ml-1 mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="-ml-1 mr-2 h-4 w-4" />
                    Search Carrier
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <p className="ml-3 text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Carrier Data Display */}
            {carrierData && (
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-900">
                    {carrierData.LegalName || carrierData.DBAName || 'Unknown Carrier'}
                  </h4>
                  {carrierData.PacketComplete && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Packet Complete
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">DOT Number:</span>
                    <p className="text-gray-900">{carrierData.DOTNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">MC Number:</span>
                    <p className="text-gray-900">{carrierData.MCNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Phone:</span>
                    <p className="text-gray-900">{carrierData.Phone || carrierData.CellPhone || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Email:</span>
                    <p className="text-gray-900">{carrierData.Email || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-500">Address:</span>
                    <p className="text-gray-900">{formatAddress(carrierData)}</p>
                  </div>
                  {carrierData.AuthorityStatus && (
                    <div>
                      <span className="font-medium text-gray-500">Authority Status:</span>
                      <p className={`text-gray-900 font-medium ${
                        carrierData.AuthorityStatus === 'ACTIVE' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {carrierData.AuthorityStatus}
                      </p>
                    </div>
                  )}
                  {carrierData.CarrierOperationalDetail && (
                    <>
                      <div>
                        <span className="font-medium text-gray-500">Fleet Size:</span>
                        <p className="text-gray-900">
                          {carrierData.CarrierOperationalDetail.FleetSize || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-500">Power Units:</span>
                        <p className="text-gray-900">
                          {carrierData.CarrierOperationalDetail.TotalPowerUnits || 'N/A'}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {onSelectCarrier && (
                  <button
                    onClick={handleSelectCarrier}
                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Use This Carrier Information
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};