import React from 'react';
import { Shield, AlertCircle, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface MCPStatusProps {
  carrier: {
    id: number;
    dotNumber: string | null;
    mcNumber: string | null;
    mcpMonitored: boolean;
    mcpLastSync: string | null;
    mcpPacketCompleted: boolean;
    mcpPacketCompletedAt: string | null;
    mcpInsuranceExpiration: string | null;
    mcpAuthorityStatus: string | null;
    mcpSafetyRating: string | null;
    mcpRiskScore: number | null;
  };
}

export const MCPStatus: React.FC<MCPStatusProps> = ({ carrier }) => {
  const getStatusColor = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'text-green-600';
      case 'INACTIVE':
        return 'text-red-600';
      case 'PENDING':
        return 'text-yellow-600';
      default:
        return 'text-gray-500';
    }
  };

  const getSafetyRatingBadge = (rating: string | null) => {
    switch (rating?.toUpperCase()) {
      case 'SATISFACTORY':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Satisfactory
          </span>
        );
      case 'CONDITIONAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Conditional
          </span>
        );
      case 'UNSATISFACTORY':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Unsatisfactory
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Not Available
          </span>
        );
    }
  };

  const getRiskScoreBadge = (score: number | null) => {
    if (!score) return null;
    
    let colorClass = '';
    if (score >= 90) colorClass = 'bg-green-100 text-green-800';
    else if (score >= 70) colorClass = 'bg-yellow-100 text-yellow-800';
    else colorClass = 'bg-red-100 text-red-800';

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        Score: {score}
      </span>
    );
  };

  const isInsuranceExpiring = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  };

  const isInsuranceExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Shield className="h-6 w-6 text-blue-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">MyCarrierPackets Integration</h3>
        </div>
        <div className="flex items-center space-x-2">
          {carrier.mcpMonitored ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Monitored
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Not Monitored
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Packet Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Carrier Packet:</span>
          {carrier.mcpPacketCompleted ? (
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-sm text-green-700">
                Completed {carrier.mcpPacketCompletedAt && 
                  `on ${format(new Date(carrier.mcpPacketCompletedAt), 'MM/dd/yyyy')}`
                }
              </span>
            </div>
          ) : (
            <div className="flex items-center">
              <XCircle className="w-4 h-4 text-gray-400 mr-1" />
              <span className="text-sm text-gray-500">Not Completed</span>
            </div>
          )}
        </div>

        {/* Authority Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Authority Status:</span>
          <span className={`text-sm font-medium ${getStatusColor(carrier.mcpAuthorityStatus)}`}>
            {carrier.mcpAuthorityStatus || 'Unknown'}
          </span>
        </div>

        {/* Safety Rating */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Safety Rating:</span>
          {getSafetyRatingBadge(carrier.mcpSafetyRating)}
        </div>

        {/* Risk Score */}
        {carrier.mcpRiskScore && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Risk Score:</span>
            {getRiskScoreBadge(carrier.mcpRiskScore)}
          </div>
        )}

        {/* Insurance Expiration */}
        {carrier.mcpInsuranceExpiration && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Insurance Expiration:</span>
            <div className="flex items-center">
              {isInsuranceExpired(carrier.mcpInsuranceExpiration) && (
                <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              )}
              {isInsuranceExpiring(carrier.mcpInsuranceExpiration) && !isInsuranceExpired(carrier.mcpInsuranceExpiration) && (
                <AlertCircle className="w-4 h-4 text-yellow-500 mr-1" />
              )}
              <span className={`text-sm ${
                isInsuranceExpired(carrier.mcpInsuranceExpiration) 
                  ? 'text-red-600 font-medium' 
                  : isInsuranceExpiring(carrier.mcpInsuranceExpiration)
                    ? 'text-yellow-600 font-medium'
                    : 'text-gray-700'
              }`}>
                {format(new Date(carrier.mcpInsuranceExpiration), 'MM/dd/yyyy')}
              </span>
            </div>
          </div>
        )}

        {/* Last Sync */}
        {carrier.mcpLastSync && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-600">Last Synced:</span>
            <div className="flex items-center">
              <Clock className="w-3 h-3 text-gray-400 mr-1" />
              <span className="text-sm text-gray-500">
                {format(new Date(carrier.mcpLastSync), 'MM/dd/yyyy h:mm a')}
              </span>
            </div>
          </div>
        )}

        {/* No DOT Number Warning */}
        {!carrier.dotNumber && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-800">
                  DOT Number required for MyCarrierPackets integration
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};