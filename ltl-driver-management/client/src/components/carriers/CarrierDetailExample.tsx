/**
 * Example implementation of MCP integration in a carrier detail page
 * This shows how to use the MCP components in your existing carrier pages
 */

import React, { useState } from 'react';
import { MCPIntegration } from './mcp';
import { toast } from 'react-hot-toast';

// Example carrier type that includes MCP fields
interface Carrier {
  id: number;
  name: string;
  email: string;
  phone: string;
  dotNumber?: string | null;
  mcNumber?: string | null;
  status: string;
  safetyRating?: string | null;
  // MCP fields
  mcpMonitored: boolean;
  mcpLastSync?: string | null;
  mcpPacketCompleted: boolean;
  mcpPacketCompletedAt?: string | null;
  mcpPacketStatus?: string | null;
  mcpInsuranceExpiration?: string | null;
  mcpAuthorityStatus?: string | null;
  mcpSafetyRating?: string | null;
  mcpRiskScore?: number | null;
}

interface CarrierDetailExampleProps {
  carrier: Carrier;
  onRefresh: () => void;
}

export const CarrierDetailExample: React.FC<CarrierDetailExampleProps> = ({ 
  carrier, 
  onRefresh 
}) => {
  const [activeTab, setActiveTab] = useState('details');

  const handleMCPUpdate = () => {
    // Refresh carrier data after MCP action
    toast.success('Carrier data updated');
    onRefresh();
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      {/* Header */}
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          {carrier.name}
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          DOT: {carrier.dotNumber || 'N/A'} | MC: {carrier.mcNumber || 'N/A'}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('details')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('mcp')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'mcp'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            MyCarrierPackets
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'documents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Documents
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="px-4 py-5 sm:p-6">
        {activeTab === 'details' && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Full name</dt>
              <dd className="mt-1 text-sm text-gray-900">{carrier.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email address</dt>
              <dd className="mt-1 text-sm text-gray-900">{carrier.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone number</dt>
              <dd className="mt-1 text-sm text-gray-900">{carrier.phone}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">{carrier.status}</dd>
            </div>
          </dl>
        )}

        {activeTab === 'mcp' && (
          <div className="max-w-3xl">
            <MCPIntegration 
              carrier={carrier} 
              onUpdate={handleMCPUpdate}
              showActions={true}
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            <p className="text-sm text-gray-500">
              Document management would go here...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};