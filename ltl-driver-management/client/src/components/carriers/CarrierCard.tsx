import React from 'react';
import { Carrier } from '../../types';
import { MapPin, Phone, Mail, ExternalLink, Eye, Trash2, Shield, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CarrierCardProps {
  carrier: Carrier;
  onView: (carrier: Carrier) => void;
  onDelete: (carrier: Carrier) => void;
}

export const CarrierCard: React.FC<CarrierCardProps> = ({ carrier, onView, onDelete }) => {
  const getStatusBadge = (status: string) => {
    const statusColors = {
      ACTIVE: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      ONBOARDED: 'bg-blue-100 text-blue-800',
      NOT_ONBOARDED: 'bg-orange-100 text-orange-800'
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getMCPStatusIcon = () => {
    if (!carrier.mcpMonitored) return null;
    
    if (carrier.mcpPacketCompleted && carrier.mcpAuthorityStatus === 'ACTIVE') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (carrier.mcpAuthorityStatus === 'INACTIVE' || carrier.mcpAuthorityStatus === 'SUSPENDED') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSafetyRatingColor = (rating: string | undefined) => {
    switch (rating?.toUpperCase()) {
      case 'SATISFACTORY':
        return 'text-green-600';
      case 'CONDITIONAL':
        return 'text-yellow-600';
      case 'UNSATISFACTORY':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const isInsuranceExpiring = () => {
    if (!carrier.mcpInsuranceExpiration) return false;
    const expDate = new Date(carrier.mcpInsuranceExpiration);
    const daysUntilExpiration = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  };

  const isInsuranceExpired = () => {
    if (!carrier.mcpInsuranceExpiration) return false;
    return new Date(carrier.mcpInsuranceExpiration) < new Date();
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{carrier.name}</h3>
            {carrier.mcpMonitored && (
              <div className="flex items-center gap-1" title="MyCarrierPackets Monitored">
                <Shield className="w-4 h-4 text-blue-500" />
                {getMCPStatusIcon()}
              </div>
            )}
          </div>
          <div className="mt-1">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(carrier.status)}`}>
              {carrier.status}
            </span>
            {carrier.mcpPacketCompleted && (
              <span className="ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Packet Completed
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            className="p-1 text-gray-500 hover:text-blue-600"
            onClick={() => onView(carrier)}
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            className="p-1 text-gray-500 hover:text-red-600"
            onClick={() => onDelete(carrier)}
            title="Delete Carrier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        {(carrier.city || carrier.state) && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{carrier.city}{carrier.city && carrier.state && ', '}{carrier.state}</span>
          </div>
        )}
        {carrier.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span>{carrier.phone}</span>
          </div>
        )}
        {carrier.email && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="truncate">{carrier.email}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">MC #:</span>
            <span className="ml-1 font-medium">{carrier.mcNumber || 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">DOT #:</span>
            <span className="ml-1 font-medium">{carrier.dotNumber || 'N/A'}</span>
          </div>
          
          {carrier.mcpMonitored && (
            <>
              {carrier.mcpAuthorityStatus && (
                <div className="col-span-2">
                  <span className="text-gray-500">Authority:</span>
                  <span className={`ml-1 font-medium ${
                    carrier.mcpAuthorityStatus === 'ACTIVE' ? 'text-green-600' : 
                    carrier.mcpAuthorityStatus === 'INACTIVE' ? 'text-red-600' : 
                    'text-yellow-600'
                  }`}>
                    {carrier.mcpAuthorityStatus}
                  </span>
                </div>
              )}
              
              {carrier.mcpSafetyRating && (
                <div className="col-span-2">
                  <span className="text-gray-500">Safety:</span>
                  <span className={`ml-1 font-medium ${getSafetyRatingColor(carrier.mcpSafetyRating)}`}>
                    {carrier.mcpSafetyRating}
                  </span>
                </div>
              )}

              {carrier.mcpInsuranceExpiration && (
                <div className="col-span-2">
                  <span className="text-gray-500">Insurance Exp:</span>
                  <span className={`ml-1 font-medium ${
                    isInsuranceExpired() ? 'text-red-600' : 
                    isInsuranceExpiring() ? 'text-yellow-600' :
                    'text-gray-700'
                  }`}>
                    {format(new Date(carrier.mcpInsuranceExpiration), 'MM/dd/yyyy')}
                    {isInsuranceExpired() && ' (Expired)'}
                    {isInsuranceExpiring() && !isInsuranceExpired() && ' (Expiring Soon)'}
                  </span>
                </div>
              )}

              {carrier.mcpRiskScore !== undefined && carrier.mcpRiskScore !== null && (
                <div className="col-span-2">
                  <span className="text-gray-500">Risk Score:</span>
                  <span className={`ml-1 font-medium ${
                    carrier.mcpRiskScore >= 90 ? 'text-green-600' :
                    carrier.mcpRiskScore >= 70 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {carrier.mcpRiskScore}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {(carrier.mcNumber || carrier.dotNumber) && (
          <div className="mt-3">
            <button
              onClick={() => window.open('https://safer.fmcsa.dot.gov/CompanySnapshot.aspx', '_blank')}
              className="w-full text-center text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3 h-3" />
              View FMCSA Co.Snapshot
            </button>
          </div>
        )}
      </div>

      {/* Bottom status indicators */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {carrier._count && (
            <>
              {carrier._count.bookings > 0 && (
                <span title="Active bookings">{carrier._count.bookings} bookings</span>
              )}
              {carrier._count.drivers && carrier._count.drivers > 0 && (
                <span title="Registered drivers">{carrier._count.drivers} drivers</span>
              )}
            </>
          )}
        </div>
        {carrier.mcpLastSync && (
          <span className="text-xs" title="Last MCP sync">
            Synced {format(new Date(carrier.mcpLastSync), 'MM/dd h:mm a')}
          </span>
        )}
      </div>
    </div>
  );
};