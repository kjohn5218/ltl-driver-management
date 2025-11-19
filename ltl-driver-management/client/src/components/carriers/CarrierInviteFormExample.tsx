/**
 * Example implementation of MCP integration in a carrier invitation form
 * This shows how to use the MCP preview and invite components
 */

import React, { useState } from 'react';
import { MCPPreviewModal, MCPInviteOption } from './mcp';
import { Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

export const CarrierInviteFormExample: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    dotNumber: '',
    mcNumber: '',
    sendMCPInvite: false
  });
  const [showMCPModal, setShowMCPModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMCPToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sendMCPInvite: checked
    }));
  };

  const handleCarrierSelect = (carrierData: any) => {
    // Auto-fill form with MCP data
    setFormData(prev => ({
      ...prev,
      email: carrierData.Email || prev.email,
      dotNumber: carrierData.DOTNumber?.toString() || prev.dotNumber,
      mcNumber: carrierData.MCNumber || prev.mcNumber
    }));
    
    toast.success('Carrier information loaded from MyCarrierPackets');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      const response = await axios.post('/api/carriers/invite', {
        email: formData.email,
        dotNumber: formData.dotNumber || undefined,
        mcNumber: formData.mcNumber || undefined,
        sendMCPInvite: formData.sendMCPInvite && !!formData.dotNumber
      });

      if (response.data.success || response.status === 200) {
        toast.success('Carrier invitation sent successfully');
        
        if (response.data.mcpInviteSent) {
          toast.success('MyCarrierPackets invitation also sent', {
            icon: '📋'
          });
        }
        
        // Reset form
        setFormData({
          email: '',
          dotNumber: '',
          mcNumber: '',
          sendMCPInvite: false
        });
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to send invitation';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Invite New Carrier</h3>
          <p className="mt-1 text-sm text-gray-500">
            Send an invitation for a carrier to register with your system
          </p>
        </div>

        {/* MCP Lookup Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowMCPModal(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Search className="-ml-0.5 mr-2 h-4 w-4" />
            Lookup in MyCarrierPackets
          </button>
        </div>

        {/* Email Field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            id="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="carrier@example.com"
          />
        </div>

        {/* DOT Number */}
        <div>
          <label htmlFor="dotNumber" className="block text-sm font-medium text-gray-700">
            DOT Number
          </label>
          <input
            type="text"
            name="dotNumber"
            id="dotNumber"
            value={formData.dotNumber}
            onChange={handleInputChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="1234567"
          />
          <p className="mt-1 text-xs text-gray-500">
            Required for MyCarrierPackets integration
          </p>
        </div>

        {/* MC Number */}
        <div>
          <label htmlFor="mcNumber" className="block text-sm font-medium text-gray-700">
            MC Number
          </label>
          <input
            type="text"
            name="mcNumber"
            id="mcNumber"
            value={formData.mcNumber}
            onChange={handleInputChange}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="MC123456"
          />
        </div>

        {/* MCP Invite Option */}
        <MCPInviteOption
          checked={formData.sendMCPInvite}
          onChange={handleMCPToggle}
          dotNumber={formData.dotNumber}
          mcNumber={formData.mcNumber}
        />

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={submitting || !formData.email}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>

      {/* MCP Preview Modal */}
      <MCPPreviewModal
        isOpen={showMCPModal}
        onClose={() => setShowMCPModal(false)}
        onSelectCarrier={handleCarrierSelect}
      />
    </div>
  );
};