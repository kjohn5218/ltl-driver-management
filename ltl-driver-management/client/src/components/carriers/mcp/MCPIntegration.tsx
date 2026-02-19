import React from 'react';
import { MCPStatus } from './MCPStatus';
import { MCPActions } from './MCPActions';

interface MCPIntegrationProps {
  carrier: {
    id: number;
    dotNumber?: string | null;
    mcNumber?: string | null;
    mcpMonitored: boolean;
    mcpLastSync?: string | null;
    mcpPacketCompleted: boolean;
    mcpPacketCompletedAt?: string | null;
    mcpPacketStatus?: string | null;
    mcpInsuranceExpiration?: string | null;
    mcpAuthorityStatus?: string | null;
    mcpSafetyRating?: string | null;
    mcpRiskScore?: number | null;
    safetyRating?: string | null;
  };
  onUpdate: () => void;
  showActions?: boolean;
  className?: string;
}

export const MCPIntegration: React.FC<MCPIntegrationProps> = ({ 
  carrier, 
  onUpdate, 
  showActions = true,
  className = ''
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <MCPStatus carrier={carrier} onUpdate={onUpdate} />
      {showActions && (
        <MCPActions carrier={carrier} onUpdate={onUpdate} />
      )}
    </div>
  );
};