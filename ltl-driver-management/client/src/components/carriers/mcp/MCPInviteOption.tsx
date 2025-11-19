import React from 'react';
import { Shield, Info } from 'lucide-react';

interface MCPInviteOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  dotNumber?: string;
  mcNumber?: string;
  disabled?: boolean;
  className?: string;
}

export const MCPInviteOption: React.FC<MCPInviteOptionProps> = ({
  checked,
  onChange,
  dotNumber,
  mcNumber,
  disabled = false,
  className = ''
}) => {
  const canSendMCPInvite = !!dotNumber;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            type="checkbox"
            id="send-mcp-invite"
            checked={checked && canSendMCPInvite}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled || !canSendMCPInvite}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
          />
        </div>
        <div className="ml-3 flex-1">
          <label 
            htmlFor="send-mcp-invite" 
            className={`font-medium text-gray-700 ${!canSendMCPInvite ? 'opacity-50' : ''}`}
          >
            <Shield className="inline h-4 w-4 text-blue-600 mr-1" />
            Also send MyCarrierPackets invitation
          </label>
          <p className="text-sm text-gray-600 mt-1">
            Send an additional invitation through MyCarrierPackets to complete carrier packet and insurance verification
          </p>
          
          {!dotNumber && (
            <div className="mt-2 flex items-center text-sm text-yellow-700">
              <Info className="h-4 w-4 mr-1" />
              <span>DOT number is required to send MCP invitation</span>
            </div>
          )}
          
          {canSendMCPInvite && checked && (
            <div className="mt-3 text-sm text-gray-600 space-y-1">
              <p className="font-medium">The carrier will receive:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Your standard registration invitation</li>
                <li>MyCarrierPackets intellivite link</li>
                <li>Instructions to complete their carrier packet</li>
              </ul>
              {dotNumber && (
                <p className="mt-2 text-xs">
                  DOT: {dotNumber} {mcNumber && `| MC: ${mcNumber}`}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};