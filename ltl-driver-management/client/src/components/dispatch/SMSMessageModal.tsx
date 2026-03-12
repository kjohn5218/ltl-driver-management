/**
 * SMS Message Modal
 *
 * Modal component for sending SMS messages to drivers/carriers
 * from the dispatch tabs (Loads, Inbound, Outbound)
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { smsService, SMSResult } from '../../services/smsService';
import { toast } from 'react-hot-toast';
import { MessageSquare, Send, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export interface SMSRecipient {
  name: string;
  phoneNumber: string;
  type: 'driver' | 'carrier' | 'other';
  referenceId?: number;
  referenceType?: string; // 'trip', 'loadsheet', 'booking'
}

interface SMSMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients?: SMSRecipient[];
  defaultMessage?: string;
  tripInfo?: {
    tripNumber?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
    departureTime?: string;
  };
  messageType?: string;
  referenceId?: number;
}

// Message templates
const MESSAGE_TEMPLATES = [
  {
    id: 'custom',
    label: 'Custom Message',
    template: '',
  },
  {
    id: 'trip_reminder',
    label: 'Trip Reminder',
    template: 'Reminder: You are scheduled for trip {tripNumber} from {origin} to {destination} on {departureDate}. Please confirm your availability.',
  },
  {
    id: 'departure_update',
    label: 'Departure Update',
    template: 'Update: Your trip {tripNumber} departure time has been updated. Please check dispatch for details.',
  },
  {
    id: 'delay_notification',
    label: 'Delay Notification',
    template: 'Notice: Trip {tripNumber} has been delayed. New departure time will be communicated shortly.',
  },
  {
    id: 'arrival_confirmation',
    label: 'Arrival Confirmation',
    template: 'Please confirm your arrival at {destination} for trip {tripNumber}.',
  },
  {
    id: 'document_reminder',
    label: 'Document Reminder',
    template: 'Reminder: Please ensure all required documents are submitted for trip {tripNumber}.',
  },
];

export const SMSMessageModal: React.FC<SMSMessageModalProps> = ({
  isOpen,
  onClose,
  recipients = [],
  defaultMessage = '',
  tripInfo,
  messageType = 'custom',
  referenceId,
}) => {
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ recipient: string; result: SMSResult }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRecipients(new Set(recipients.map(r => r.phoneNumber)));
      setMessage(defaultMessage);
      setSelectedTemplate('custom');
      setResults([]);
      setShowResults(false);
      setCustomPhoneNumber('');
    }
  }, [isOpen, recipients, defaultMessage]);

  // Apply template
  const applyTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template && template.template) {
      let text = template.template;
      // Replace placeholders with trip info
      if (tripInfo) {
        text = text.replace('{tripNumber}', tripInfo.tripNumber || 'N/A');
        text = text.replace('{origin}', tripInfo.origin || 'N/A');
        text = text.replace('{destination}', tripInfo.destination || 'N/A');
        text = text.replace('{departureDate}', tripInfo.departureDate || 'N/A');
        text = text.replace('{departureTime}', tripInfo.departureTime || 'N/A');
      }
      setMessage(text);
    }
  };

  // Toggle recipient selection
  const toggleRecipient = (phoneNumber: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(phoneNumber)) {
      newSelected.delete(phoneNumber);
    } else {
      newSelected.add(phoneNumber);
    }
    setSelectedRecipients(newSelected);
  };

  // Format phone number for display
  const formatPhoneDisplay = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  // Send messages
  const handleSend = async () => {
    const phoneNumbers: string[] = [];

    // Add selected recipients
    selectedRecipients.forEach(phone => phoneNumbers.push(phone));

    // Add custom phone number if provided
    if (customPhoneNumber.trim()) {
      const cleaned = customPhoneNumber.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        phoneNumbers.push(customPhoneNumber.trim());
      }
    }

    if (phoneNumbers.length === 0) {
      toast.error('Please select or enter at least one recipient');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (message.length > 1600) {
      toast.error('Message is too long (max 1600 characters)');
      return;
    }

    setSending(true);
    const sendResults: { recipient: string; result: SMSResult }[] = [];

    try {
      if (phoneNumbers.length === 1) {
        // Single recipient - use send endpoint
        const result = await smsService.send(
          phoneNumbers[0],
          message,
          messageType,
          referenceId
        );
        sendResults.push({ recipient: phoneNumbers[0], result });
      } else {
        // Multiple recipients - use bulk endpoint
        const bulkResult = await smsService.sendBulk(phoneNumbers, message, messageType);
        bulkResult.results.forEach(r => {
          sendResults.push({
            recipient: r.recipient,
            result: {
              success: r.success,
              messageId: r.messageId,
              error: r.error,
            },
          });
        });
      }

      setResults(sendResults);
      setShowResults(true);

      const successCount = sendResults.filter(r => r.result.success).length;
      const failCount = sendResults.length - successCount;

      if (failCount === 0) {
        toast.success(`Message sent to ${successCount} recipient${successCount > 1 ? 's' : ''}`);
      } else if (successCount === 0) {
        toast.error('Failed to send message to all recipients');
      } else {
        toast.success(`Sent to ${successCount}, failed for ${failCount}`);
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS message');
    } finally {
      setSending(false);
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 1600;
  const segmentCount = Math.ceil(characterCount / 160) || 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send SMS Message" size="lg">
      <div className="space-y-4">
        {/* Recipients Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recipients
          </label>

          {recipients.length > 0 && (
            <div className="space-y-2 mb-3">
              {recipients.map((recipient) => (
                <label
                  key={recipient.phoneNumber}
                  className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipients.has(recipient.phoneNumber)}
                    onChange={() => toggleRecipient(recipient.phoneNumber)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {recipient.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 capitalize">
                      ({recipient.type})
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatPhoneDisplay(recipient.phoneNumber)}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Custom phone number input */}
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={customPhoneNumber}
              onChange={(e) => setCustomPhoneNumber(e.target.value)}
              placeholder="Enter phone number..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Message Template Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Message Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => applyTemplate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {MESSAGE_TEMPLATES.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Type your message here..."
            className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              isOverLimit
                ? 'border-red-500 dark:border-red-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {characterCount}/1600 characters
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {segmentCount} SMS segment{segmentCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Results Section */}
        {showResults && results.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Send Results
            </h4>
            <div className="space-y-2">
              {results.map((r, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    r.result.success
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}
                >
                  {r.result.success ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="flex-1">{formatPhoneDisplay(r.recipient)}</span>
                  {r.result.success ? (
                    <span className="text-xs">Sent</span>
                  ) : (
                    <span className="text-xs">{r.result.error || 'Failed'}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {showResults ? 'Close' : 'Cancel'}
          </button>
          {!showResults && (
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || isOverLimit || (!selectedRecipients.size && !customPhoneNumber.trim())}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Message
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

// Export icon for use in buttons
export { MessageSquare as SMSIcon };
