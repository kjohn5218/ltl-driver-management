import React, { useState, useMemo } from 'react';
import { Carrier } from '../../types';
import { Eye, Trash2, Shield, CheckCircle, AlertCircle, XCircle, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import './CarrierList.css';

interface CarrierListProps {
  carriers: Carrier[];
  onView: (carrier: Carrier) => void;
  onDelete: (carrier: Carrier) => void;
}

type SortField = 'name' | 'location' | 'mcNumber' | 'status' | 'mcpMonitored' | 'safetyRating' | 'mcpRiskScore' | 'mcpInsuranceExpiration';
type SortDirection = 'asc' | 'desc';

export const CarrierList: React.FC<CarrierListProps> = ({ carriers, onView, onDelete }) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedCarriers = useMemo(() => {
    if (!sortField) return carriers;

    return [...carriers].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'location':
          aVal = `${a.city || ''}${a.state || ''}`.toLowerCase();
          bVal = `${b.city || ''}${b.state || ''}`.toLowerCase();
          break;
        case 'mcNumber':
          aVal = a.mcNumber || '';
          bVal = b.mcNumber || '';
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        case 'mcpMonitored':
          aVal = a.mcpMonitored ? 1 : 0;
          bVal = b.mcpMonitored ? 1 : 0;
          break;
        case 'safetyRating':
          aVal = a.mcpSafetyRating || a.safetyRating || '';
          bVal = b.mcpSafetyRating || b.safetyRating || '';
          break;
        case 'mcpRiskScore':
          aVal = a.mcpRiskScore ?? -1;
          bVal = b.mcpRiskScore ?? -1;
          break;
        case 'mcpInsuranceExpiration':
          aVal = a.mcpInsuranceExpiration ? new Date(a.mcpInsuranceExpiration).getTime() : 0;
          bVal = b.mcpInsuranceExpiration ? new Date(b.mcpInsuranceExpiration).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aVal === bVal) return 0;
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [carriers, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="w-3 h-3 opacity-0 group-hover:opacity-30" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-blue-600" /> 
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };
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
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (carrier.mcpAuthorityStatus === 'INACTIVE' || carrier.mcpAuthorityStatus === 'SUSPENDED') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getSafetyRatingBadge = (rating: string | undefined, mcpRating: string | undefined) => {
    const displayRating = mcpRating || rating;
    if (!displayRating) return <span className="text-gray-400">N/A</span>;
    
    const upperRating = displayRating.toUpperCase();
    const colors = {
      SATISFACTORY: 'text-green-600',
      ACCEPTABLE: 'text-green-600',
      CONDITIONAL: 'text-yellow-600',
      UNSATISFACTORY: 'text-red-600',
      UNACCEPTABLE: 'text-red-600',
      'NOT RATED': 'text-gray-500'
    };
    
    const color = colors[upperRating as keyof typeof colors] || 'text-gray-500';
    return <span className={`font-medium ${color}`}>{displayRating}</span>;
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
      <div className="carrier-list-scroll-container overflow-x-auto max-w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px] cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Carrier
                  <SortIcon field="name" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('location')}
              >
                <div className="flex items-center gap-1">
                  Location
                  <SortIcon field="location" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('mcNumber')}
              >
                <div className="flex items-center gap-1">
                  MC/DOT
                  <SortIcon field="mcNumber" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('mcpMonitored')}
              >
                <div className="flex items-center gap-1">
                  MCP Status
                  <SortIcon field="mcpMonitored" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('safetyRating')}
              >
                <div className="flex items-center gap-1">
                  Safety
                  <SortIcon field="safetyRating" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('mcpRiskScore')}
              >
                <div className="flex items-center gap-1">
                  Risk
                  <SortIcon field="mcpRiskScore" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                onClick={() => handleSort('mcpInsuranceExpiration')}
              >
                <div className="flex items-center gap-1">
                  Insurance Exp
                  <SortIcon field="mcpInsuranceExpiration" />
                </div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCarriers.map((carrier) => {
              const isInsuranceExpiring = carrier.mcpInsuranceExpiration && 
                new Date(carrier.mcpInsuranceExpiration) > new Date() &&
                Math.ceil((new Date(carrier.mcpInsuranceExpiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 30;
              const isInsuranceExpired = carrier.mcpInsuranceExpiration && 
                new Date(carrier.mcpInsuranceExpiration) < new Date();

              return (
                <tr key={carrier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 break-words max-w-xs">{carrier.name}</div>
                      {carrier.email && (
                        <div className="text-sm text-gray-500 break-all max-w-xs">{carrier.email}</div>
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
                          <Shield className="w-4 h-4 text-blue-500" />
                          {getMCPStatusIcon(carrier)}
                          {carrier.mcpPacketCompleted && (
                            <span className="text-xs text-purple-600">
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
                    {getSafetyRatingBadge(carrier.safetyRating, carrier.mcpSafetyRating)}
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
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(carrier.mcNumber || carrier.dotNumber) && (
                        <button
                          onClick={() => window.open('https://safer.fmcsa.dot.gov/CompanySnapshot.aspx', '_blank')}
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(carrier)}
                        className="text-gray-600 hover:text-red-600"
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
      
      {sortedCarriers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No carriers found</p>
        </div>
      )}
    </div>
  );
};