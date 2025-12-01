import React from 'react';
import { Carrier } from '../../types';
import { Eye, Trash2, Shield, CheckCircle, AlertCircle, XCircle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface CarrierListProps {
  carriers: Carrier[];
  onView: (carrier: Carrier) => void;
  onDelete: (carrier: Carrier) => void;
}

export const CarrierList: React.FC<CarrierListProps> = ({ carriers, onView, onDelete }) => {
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

  const getMCPStatusIcon = (carrier: Carrier) => {
    if (!carrier.mcpMonitored) return null;
    
    if (carrier.mcpPacketCompleted && carrier.mcpAuthorityStatus === 'ACTIVE') {
      return <CheckCircle className="w-4 h-4 text-green-500" title="MCP Active & Packet Completed" />;
    } else if (carrier.mcpAuthorityStatus === 'INACTIVE' || carrier.mcpAuthorityStatus === 'SUSPENDED') {
      return <XCircle className="w-4 h-4 text-red-500" title="MCP Inactive/Suspended" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-yellow-500" title="MCP Monitored - Check Status" />;
    }
  };

  const getSafetyRatingBadge = (rating: string | undefined) => {
    if (!rating) return <span className="text-gray-400">N/A</span>;
    
    const colors = {
      SATISFACTORY: 'text-green-600',
      CONDITIONAL: 'text-yellow-600',
      UNSATISFACTORY: 'text-red-600'
    };
    
    const color = colors[rating.toUpperCase() as keyof typeof colors] || 'text-gray-500';
    return <span className={`font-medium ${color}`}>{rating}</span>;
  };

  const getRiskScoreBadge = (score: number | undefined) => {
    if (score === undefined || score === null) return <span className="text-gray-400">N/A</span>;
    
    let colorClass = '';
    if (score >= 90) colorClass = 'text-green-600';
    else if (score >= 70) colorClass = 'text-yellow-600';
    else colorClass = 'text-red-600';
    
    return <span className={`font-medium ${colorClass}`}>{score}</span>;
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Carrier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MC/DOT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MCP Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Safety
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Insurance Exp
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {carriers.map((carrier) => {
              const isInsuranceExpiring = carrier.mcpInsuranceExpiration && 
                new Date(carrier.mcpInsuranceExpiration) > new Date() &&
                Math.ceil((new Date(carrier.mcpInsuranceExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30;
              const isInsuranceExpired = carrier.mcpInsuranceExpiration && 
                new Date(carrier.mcpInsuranceExpiration) < new Date();

              return (
                <tr key={carrier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{carrier.name}</div>
                      {carrier.email && (
                        <div className="text-sm text-gray-500">{carrier.email}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {carrier.city || carrier.state ? (
                        `${carrier.city || ''}${carrier.city && carrier.state ? ', ' : ''}${carrier.state || ''}`
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div>MC: {carrier.mcNumber || <span className="text-gray-400">N/A</span>}</div>
                      <div>DOT: {carrier.dotNumber || <span className="text-gray-400">N/A</span>}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(carrier.status)}`}>
                      {carrier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {carrier.mcpMonitored ? (
                        <>
                          <Shield className="w-4 h-4 text-blue-500" title="MCP Monitored" />
                          {getMCPStatusIcon(carrier)}
                          {carrier.mcpPacketCompleted && (
                            <span className="text-xs text-purple-600" title="Packet Completed">
                              Packet ✓
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">Not Monitored</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSafetyRatingBadge(carrier.mcpSafetyRating)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRiskScoreBadge(carrier.mcpRiskScore)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {carrier.mcpInsuranceExpiration ? (
                      <span className={`text-sm ${
                        isInsuranceExpired ? 'text-red-600 font-medium' : 
                        isInsuranceExpiring ? 'text-yellow-600 font-medium' :
                        'text-gray-700'
                      }`}>
                        {format(new Date(carrier.mcpInsuranceExpiration), 'MM/dd/yyyy')}
                        {isInsuranceExpired && ' (Expired)'}
                        {isInsuranceExpiring && !isInsuranceExpired && ' (Soon)'}
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onView(carrier)}
                        className="text-gray-600 hover:text-blue-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(carrier.mcNumber || carrier.dotNumber) && (
                        <button
                          onClick={() => window.open('https://safer.fmcsa.dot.gov/CompanySnapshot.aspx', '_blank')}
                          className="text-gray-600 hover:text-blue-600"
                          title="View FMCSA"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(carrier)}
                        className="text-gray-600 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {carriers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No carriers found</p>
        </div>
      )}
    </div>
  );
};