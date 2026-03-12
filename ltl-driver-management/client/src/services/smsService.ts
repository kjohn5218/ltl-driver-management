/**
 * SMS Service
 *
 * Frontend service for sending SMS messages via the backend API
 */

import { api } from './api';

export interface SMSResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export interface SMSStatus {
  enabled: boolean;
  provider: string;
  configured: boolean;
}

export interface BulkSMSResult {
  success: boolean;
  sent: number;
  failed: number;
  results: Array<{
    recipient: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export const smsService = {
  /**
   * Get SMS service status
   */
  async getStatus(): Promise<SMSStatus> {
    const response = await api.get('/sms/status');
    return response.data;
  },

  /**
   * Send a test SMS
   */
  async sendTest(phoneNumber: string, message?: string): Promise<SMSResult> {
    const response = await api.post('/sms/test', { phoneNumber, message });
    return response.data;
  },

  /**
   * Send a custom SMS
   */
  async send(
    phoneNumber: string,
    message: string,
    type?: string,
    referenceId?: string | number
  ): Promise<SMSResult> {
    const response = await api.post('/sms/send', {
      phoneNumber,
      message,
      type,
      referenceId,
    });
    return response.data;
  },

  /**
   * Send bulk SMS to multiple recipients
   */
  async sendBulk(
    phoneNumbers: string[],
    message: string,
    type?: string
  ): Promise<BulkSMSResult> {
    const response = await api.post('/sms/bulk', {
      phoneNumbers,
      message,
      type,
    });
    return response.data;
  },

  /**
   * Send trip assignment notification
   */
  async sendTripAssignment(
    tripId: number,
    phoneNumber?: string,
    driverId?: number
  ): Promise<SMSResult> {
    const response = await api.post('/sms/trip-assignment', {
      tripId,
      phoneNumber,
      driverId,
    });
    return response.data;
  },

  /**
   * Send booking confirmation
   */
  async sendBookingConfirmation(
    bookingId: number,
    phoneNumber?: string
  ): Promise<SMSResult> {
    const response = await api.post('/sms/booking-confirmation', {
      bookingId,
      phoneNumber,
    });
    return response.data;
  },

  /**
   * Send delay notification
   */
  async sendDelayNotification(
    tripId: number,
    reason: string,
    phoneNumber?: string,
    newDepartureTime?: string
  ): Promise<SMSResult> {
    const response = await api.post('/sms/delay-notification', {
      tripId,
      reason,
      phoneNumber,
      newDepartureTime,
    });
    return response.data;
  },
};
