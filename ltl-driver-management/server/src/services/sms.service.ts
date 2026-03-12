/**
 * SMS Service
 *
 * Provides SMS messaging capabilities for:
 * - Driver notifications (trip assignments, ETA updates)
 * - Booking confirmations
 * - Delay alerts
 * - General notifications
 *
 * Supports Twilio and AWS SNS providers.
 */

import { getSMSConfig, isSMSEnabled, SMSConfig } from '../config/sms.config';
import { log } from '../utils/logger';

// Lazy load Twilio to avoid errors when not installed
let twilioClient: any = null;

export interface SMSResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  recipient?: string;
}

export interface SMSOptions {
  to: string;
  message: string;
  // Optional metadata for logging
  context?: {
    type?: string; // 'trip_assignment', 'booking_confirmation', 'delay_alert', etc.
    referenceId?: string | number;
  };
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string, defaultCountryCode: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with country code (1 for US/CA), add +
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }

  // If 10 digits, assume US/CA and add country code
  if (cleaned.length === 10) {
    return `${defaultCountryCode}${cleaned}`;
  }

  // If already has + prefix in original, keep as is
  if (phone.startsWith('+')) {
    return `+${cleaned}`;
  }

  // Default: add country code prefix
  return `${defaultCountryCode}${cleaned}`;
}

/**
 * Get or initialize Twilio client
 */
async function getTwilioClient(config: SMSConfig): Promise<any> {
  if (!twilioClient) {
    try {
      const twilio = await import('twilio');
      twilioClient = twilio.default(config.twilioAccountSid, config.twilioAuthToken);
    } catch (error) {
      throw new Error('Twilio package not installed. Run: npm install twilio');
    }
  }
  return twilioClient;
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(
  config: SMSConfig,
  to: string,
  message: string
): Promise<SMSResult> {
  try {
    const client = await getTwilioClient(config);

    const result = await client.messages.create({
      body: message,
      from: config.twilioFromNumber,
      to: to,
    });

    return {
      success: true,
      messageId: result.sid,
      provider: 'twilio',
      recipient: to,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'twilio',
      recipient: to,
    };
  }
}

/**
 * Send SMS via AWS SNS
 */
async function sendViaSNS(
  config: SMSConfig,
  to: string,
  message: string
): Promise<SMSResult> {
  try {
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');

    const snsClient = new SNSClient({
      region: config.snsRegion,
      credentials: {
        accessKeyId: config.snsAccessKeyId || '',
        secretAccessKey: config.snsSecretAccessKey || '',
      },
    });

    const command = new PublishCommand({
      Message: message,
      PhoneNumber: to,
    });

    const result = await snsClient.send(command);

    return {
      success: true,
      messageId: result.MessageId,
      provider: 'sns',
      recipient: to,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      provider: 'sns',
      recipient: to,
    };
  }
}

/**
 * SMS Service singleton
 */
class SMSService {
  /**
   * Send an SMS message
   */
  async send(options: SMSOptions): Promise<SMSResult> {
    const config = getSMSConfig();

    // Check if SMS is enabled
    if (!isSMSEnabled()) {
      log.debug('SMS', 'SMS is not enabled, skipping send');
      return {
        success: false,
        error: 'SMS is not configured or enabled',
      };
    }

    // Format phone number
    const formattedTo = formatPhoneNumber(options.to, config.defaultCountryCode);

    // Use test override if configured
    const actualRecipient = config.testPhoneOverride || formattedTo;

    if (config.testPhoneOverride && config.testPhoneOverride !== formattedTo) {
      log.info('SMS', `Test override: Routing SMS from ${formattedTo} to ${config.testPhoneOverride}`);
    }

    // Log the send attempt
    log.info('SMS', `Sending SMS to ${actualRecipient}`, {
      context: options.context,
      provider: config.provider,
    });

    // Send via appropriate provider
    let result: SMSResult;

    switch (config.provider) {
      case 'twilio':
        result = await sendViaTwilio(config, actualRecipient, options.message);
        break;

      case 'sns':
        result = await sendViaSNS(config, actualRecipient, options.message);
        break;

      default:
        result = {
          success: false,
          error: `Unknown SMS provider: ${config.provider}`,
        };
    }

    // Log result
    if (result.success) {
      log.info('SMS', `SMS sent successfully`, {
        messageId: result.messageId,
        recipient: actualRecipient,
        context: options.context,
      });
    } else {
      log.error('SMS', `SMS send failed: ${result.error}`, {
        recipient: actualRecipient,
        context: options.context,
      });
    }

    return result;
  }

  /**
   * Send SMS to multiple recipients
   */
  async sendBulk(
    recipients: string[],
    message: string,
    context?: SMSOptions['context']
  ): Promise<{ sent: number; failed: number; results: SMSResult[] }> {
    const results: SMSResult[] = [];
    let sent = 0;
    let failed = 0;

    for (const to of recipients) {
      const result = await this.send({ to, message, context });
      results.push(result);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { sent, failed, results };
  }

  /**
   * Check SMS service status
   */
  getStatus(): {
    enabled: boolean;
    provider: string;
    configured: boolean;
  } {
    const config = getSMSConfig();
    return {
      enabled: config.enabled,
      provider: config.provider,
      configured: isSMSEnabled(),
    };
  }

  // ============================================
  // High-level notification methods
  // ============================================

  /**
   * Send trip assignment notification to driver
   */
  async sendTripAssignment(
    driverPhone: string,
    tripNumber: string,
    origin: string,
    destination: string,
    departureDate: string,
    departureTime?: string
  ): Promise<SMSResult> {
    const message =
      `CCFS Trip Assignment: ${tripNumber}\n` +
      `Route: ${origin} to ${destination}\n` +
      `Date: ${departureDate}${departureTime ? ` at ${departureTime}` : ''}\n` +
      `Check driver.ccfs.com for details.`;

    return this.send({
      to: driverPhone,
      message,
      context: { type: 'trip_assignment', referenceId: tripNumber },
    });
  }

  /**
   * Send booking confirmation to carrier
   */
  async sendBookingConfirmation(
    phone: string,
    bookingId: number,
    route: string,
    bookingDate: string,
    rate: number
  ): Promise<SMSResult> {
    const shipmentNumber = `CCFS${bookingId.toString().padStart(5, '0')}`;
    const message =
      `CCFS Booking Confirmed: ${shipmentNumber}\n` +
      `Route: ${route}\n` +
      `Date: ${bookingDate}\n` +
      `Rate: $${rate.toFixed(2)}\n` +
      `Sign rate confirmation in your email.`;

    return this.send({
      to: phone,
      message,
      context: { type: 'booking_confirmation', referenceId: bookingId },
    });
  }

  /**
   * Send delay notification
   */
  async sendDelayNotification(
    phone: string,
    tripNumber: string,
    reason: string,
    newDepartureTime?: string
  ): Promise<SMSResult> {
    let message = `CCFS Delay Alert: Trip ${tripNumber}\n`;
    message += `Reason: ${reason}\n`;
    if (newDepartureTime) {
      message += `New departure: ${newDepartureTime}\n`;
    }
    message += `Contact dispatch for updates.`;

    return this.send({
      to: phone,
      message,
      context: { type: 'delay_alert', referenceId: tripNumber },
    });
  }

  /**
   * Send ETA update notification
   */
  async sendETAUpdate(
    phone: string,
    tripNumber: string,
    destination: string,
    newETA: string
  ): Promise<SMSResult> {
    const message =
      `CCFS ETA Update: Trip ${tripNumber}\n` +
      `Destination: ${destination}\n` +
      `New ETA: ${newETA}`;

    return this.send({
      to: phone,
      message,
      context: { type: 'eta_update', referenceId: tripNumber },
    });
  }

  /**
   * Send arrival notification
   */
  async sendArrivalNotification(
    phone: string,
    tripNumber: string,
    terminal: string
  ): Promise<SMSResult> {
    const message =
      `CCFS Arrival: Trip ${tripNumber}\n` +
      `Vehicle has arrived at ${terminal}.\n` +
      `Record arrival at driver.ccfs.com`;

    return this.send({
      to: phone,
      message,
      context: { type: 'arrival', referenceId: tripNumber },
    });
  }

  /**
   * Send document reminder
   */
  async sendDocumentReminder(
    phone: string,
    bookingId: number,
    uploadUrl: string
  ): Promise<SMSResult> {
    const shipmentNumber = `CCFS${bookingId.toString().padStart(5, '0')}`;
    const message =
      `CCFS Reminder: ${shipmentNumber}\n` +
      `Please upload trip documents.\n` +
      `Link: ${uploadUrl}`;

    return this.send({
      to: phone,
      message,
      context: { type: 'document_reminder', referenceId: bookingId },
    });
  }

  /**
   * Send custom notification
   */
  async sendCustom(
    phone: string,
    message: string,
    type: string = 'custom',
    referenceId?: string | number
  ): Promise<SMSResult> {
    return this.send({
      to: phone,
      message,
      context: { type, referenceId: referenceId?.toString() },
    });
  }
}

// Export singleton instance
export const smsService = new SMSService();
