/**
 * SMS Configuration
 *
 * Supports multiple SMS providers:
 * - Twilio (recommended)
 * - AWS SNS
 *
 * Configure the provider and credentials via environment variables.
 */

export type SMSProvider = 'twilio' | 'sns' | 'none';

export interface SMSConfig {
  provider: SMSProvider;
  // Twilio settings
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  // AWS SNS settings
  snsRegion?: string;
  snsAccessKeyId?: string;
  snsSecretAccessKey?: string;
  // General settings
  enabled: boolean;
  testPhoneOverride?: string; // Override recipient for testing
  defaultCountryCode: string;
}

let smsConfig: SMSConfig | null = null;

/**
 * Check if SMS is configured and enabled
 */
export function isSMSConfigured(): boolean {
  const provider = process.env.SMS_PROVIDER?.toLowerCase() as SMSProvider;

  if (!provider || provider === 'none') {
    return false;
  }

  if (provider === 'twilio') {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
  }

  if (provider === 'sns') {
    return !!(
      process.env.AWS_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  return false;
}

/**
 * Check if SMS is enabled (configured and not disabled)
 */
export function isSMSEnabled(): boolean {
  if (process.env.SMS_ENABLED === 'false') {
    return false;
  }
  return isSMSConfigured();
}

/**
 * Get SMS configuration
 */
export function getSMSConfig(): SMSConfig {
  if (!smsConfig) {
    const provider = (process.env.SMS_PROVIDER?.toLowerCase() || 'none') as SMSProvider;

    smsConfig = {
      provider,
      enabled: process.env.SMS_ENABLED !== 'false' && isSMSConfigured(),
      // Twilio
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
      // AWS SNS
      snsRegion: process.env.AWS_REGION || 'us-east-1',
      snsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      snsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      // General
      testPhoneOverride: process.env.TEST_PHONE_OVERRIDE,
      defaultCountryCode: process.env.SMS_DEFAULT_COUNTRY_CODE || '+1',
    };
  }

  return smsConfig;
}

/**
 * Reset config (for testing)
 */
export function resetSMSConfig(): void {
  smsConfig = null;
}
