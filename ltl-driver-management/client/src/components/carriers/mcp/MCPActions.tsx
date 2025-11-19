import React, { useState } from 'react';
import { RefreshCw, Shield, ShieldOff, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface MCPActionsProps {
  carrier: {
    id: number;
    dotNumber: string | null;
    mcNumber: string | null;
    mcpMonitored: boolean;
  };
  onUpdate: () => void;
  disabled?: boolean;
}

interface MCPStatus {
  mcpStatus: {
    isConfigured: boolean;
    isMonitored: boolean;
    lastSync: string | null;
    packetCompleted: boolean;
    packetCompletedAt: string | null;
    insuranceExpiration: string | null;
    authorityStatus: string | null;
    safetyRating: string | null;
    riskScore: number | null;
    urls: {
      intellivite: string | null;
      view: string | null;
      viewWithInsurance: string | null;
    };
  };
}

export const MCPActions: React.FC<MCPActionsProps> = ({ carrier, onUpdate, disabled = false }) => {
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch MCP status on component mount
  React.useEffect(() => {
    fetchMCPStatus();
  }, [carrier.id]);

  const fetchMCPStatus = async () => {
    if (!carrier.dotNumber) return;
    
    try {
      setLoading(true);
      const response = await axios.get<MCPStatus>(`/api/carriers/${carrier.id}/mcp/status`);
      setMcpStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch MCP status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!carrier.dotNumber) {
      toast.error('DOT Number is required for MCP sync');
      return;
    }

    try {
      setSyncing(true);
      const response = await axios.post(`/api/carriers/${carrier.id}/mcp/sync`);
      
      if (response.data.success) {
        toast.success('Carrier data synced from MyCarrierPackets');
        onUpdate();
        fetchMCPStatus(); // Refresh status
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to sync carrier data';
      toast.error(message);
      
      // If MCP is not configured, show additional help
      if (error.response?.status === 503) {
        toast.error('MyCarrierPackets integration is not configured. Please add API credentials.', {
          duration: 5000
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleMonitoring = async () => {
    if (!carrier.dotNumber) {
      toast.error('DOT Number is required for monitoring');
      return;
    }

    const newMonitoringState = !carrier.mcpMonitored;
    const action = newMonitoringState ? 'enable' : 'disable';

    try {
      setToggling(true);
      const response = await axios.post(`/api/carriers/${carrier.id}/mcp/monitor`, {
        monitor: newMonitoringState
      });

      if (response.data.success) {
        toast.success(`Monitoring ${newMonitoringState ? 'enabled' : 'disabled'}`);
        onUpdate();
        fetchMCPStatus(); // Refresh status
      }
    } catch (error: any) {
      const message = error.response?.data?.message || `Failed to ${action} monitoring`;
      toast.error(message);
    } finally {
      setToggling(false);
    }
  };

  const openInMCP = () => {
    if (mcpStatus?.mcpStatus?.urls?.view) {
      window.open(mcpStatus.mcpStatus.urls.view, '_blank', 'noopener,noreferrer');
    }
  };

  const openIntellivite = () => {
    if (mcpStatus?.mcpStatus?.urls?.intellivite) {
      window.open(mcpStatus.mcpStatus.urls.intellivite, '_blank', 'noopener,noreferrer');
    }
  };

  const isConfigured = mcpStatus?.mcpStatus?.isConfigured ?? false;

  if (!carrier.dotNumber) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
          <p className="text-sm text-yellow-800">
            DOT Number is required for MyCarrierPackets integration
          </p>
        </div>
      </div>
    );
  }

  if (!isConfigured && !loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-gray-400 mr-2" />
          <p className="text-sm text-gray-600">
            MyCarrierPackets integration is not configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={disabled || syncing || !isConfigured}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`-ml-0.5 mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Data'}
        </button>

        {/* Toggle Monitoring Button */}
        <button
          onClick={handleToggleMonitoring}
          disabled={disabled || toggling || !isConfigured}
          className={`inline-flex items-center px-3 py-2 border shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
            carrier.mcpMonitored
              ? 'border-red-300 text-red-700 bg-white hover:bg-red-50'
              : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
          }`}
        >
          {carrier.mcpMonitored ? (
            <>
              <ShieldOff className="-ml-0.5 mr-2 h-4 w-4" />
              {toggling ? 'Updating...' : 'Stop Monitoring'}
            </>
          ) : (
            <>
              <Shield className="-ml-0.5 mr-2 h-4 w-4" />
              {toggling ? 'Updating...' : 'Start Monitoring'}
            </>
          )}
        </button>

        {/* View in MCP Button */}
        {mcpStatus?.mcpStatus?.urls?.view && (
          <button
            onClick={openInMCP}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="-ml-0.5 mr-2 h-4 w-4" />
            View in MCP
          </button>
        )}

        {/* Intellivite Link */}
        {mcpStatus?.mcpStatus?.urls?.intellivite && (
          <button
            onClick={openIntellivite}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ExternalLink className="-ml-0.5 mr-2 h-4 w-4" />
            Intellivite Link
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="text-sm text-gray-500">
        {carrier.mcpMonitored ? (
          <p className="flex items-center">
            <Shield className="w-4 h-4 mr-1 text-blue-500" />
            This carrier is being actively monitored for changes
          </p>
        ) : (
          <p>Enable monitoring to receive automatic updates for this carrier</p>
        )}
      </div>
    </div>
  );
};