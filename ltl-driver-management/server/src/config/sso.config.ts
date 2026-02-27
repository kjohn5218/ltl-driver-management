/**
 * SSO Configuration for Microsoft Entra ID (Azure AD)
 * Uses OIDC with Authorization Code Flow + PKCE
 */

import { Configuration, LogLevel } from '@azure/msal-node';
import { log } from '../utils/logger';

/**
 * MSAL configuration for Microsoft Entra ID
 */
export const getMsalConfig = (): Configuration => {
  const clientId = process.env.ENTRA_CLIENT_ID;
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error(
      'SSO configuration incomplete. Set ENTRA_CLIENT_ID, ENTRA_TENANT_ID, and ENTRA_CLIENT_SECRET'
    );
  }

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message) => {
          if (level === LogLevel.Error) {
            log.error('MSAL', message);
          } else if (level === LogLevel.Warning) {
            log.warn('MSAL', message);
          }
        },
        piiLoggingEnabled: false,
        logLevel: LogLevel.Warning,
      },
    },
  };
};

/**
 * SSO application settings
 */
export interface SSOConfig {
  enabled: boolean;
  autoCreateUsers: boolean;
  defaultRole: string;
  redirectUri: string;
  scopes: string[];
  postLoginRedirect: string;
}

export const getSSOConfig = (): SSOConfig => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const port = process.env.PORT || '3001';
  const baseUrl = process.env.SSO_CALLBACK_BASE_URL || `http://localhost:${port}`;

  return {
    enabled: process.env.SSO_ENABLED === 'true',
    autoCreateUsers: process.env.SSO_AUTO_CREATE_USERS !== 'false', // Default true
    defaultRole: process.env.SSO_DEFAULT_ROLE || 'DISPATCHER',
    redirectUri: process.env.ENTRA_REDIRECT_URI || `${baseUrl}/api/auth/sso/callback`,
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    postLoginRedirect: frontendUrl,
  };
};

/**
 * Check if SSO is properly configured
 */
export const isSSOConfigured = (): boolean => {
  return !!(
    process.env.ENTRA_CLIENT_ID &&
    process.env.ENTRA_TENANT_ID &&
    process.env.ENTRA_CLIENT_SECRET
  );
};
