/**
 * SSO Service for Microsoft Entra ID (Azure AD)
 * Handles OIDC authentication flow with PKCE
 */

import {
  ConfidentialClientApplication,
  CryptoProvider,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';
import { getMsalConfig, getSSOConfig } from '../config/sso.config';
import { PrismaClient, UserRole } from '@prisma/client';

// Create a local prisma instance to avoid circular dependency with index.ts
const prisma = new PrismaClient();
import { generateAccessToken } from '../utils/jwt.utils';
import { log } from '../utils/logger';

// Lazy initialization of MSAL client
let msalClient: ConfidentialClientApplication | null = null;
const cryptoProvider = new CryptoProvider();

/**
 * Get or create MSAL client instance
 */
const getMsalClient = (): ConfidentialClientApplication => {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(getMsalConfig());
  }
  return msalClient;
};

/**
 * Claims from Entra ID token
 */
interface EntraUserClaims {
  oid: string; // Object ID - unique user identifier
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

/**
 * Result of SSO authentication
 */
export interface SSOAuthResult {
  user: {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    homeLocationId: number | null;
    homeLocation: {
      id: number;
      code: string;
      name: string | null;
    } | null;
  };
  token: string;
  isNewUser: boolean;
}

/**
 * Generate authorization URL with PKCE
 */
export async function getAuthUrl(): Promise<{
  url: string;
  verifier: string;
  state: string;
}> {
  const ssoConfig = getSSOConfig();
  const client = getMsalClient();

  // Generate PKCE codes
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const state = cryptoProvider.createNewGuid();

  const authUrlRequest: AuthorizationUrlRequest = {
    scopes: ssoConfig.scopes,
    redirectUri: ssoConfig.redirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
    state,
    prompt: 'select_account',
  };

  const url = await client.getAuthCodeUrl(authUrlRequest);

  log.debug('SSO', 'Generated auth URL', { state, redirectUri: ssoConfig.redirectUri });

  return { url, verifier, state };
}

/**
 * Handle OAuth callback - exchange code for tokens and create/link user
 */
export async function handleCallback(
  code: string,
  verifier: string
): Promise<SSOAuthResult> {
  const ssoConfig = getSSOConfig();
  const client = getMsalClient();

  // Exchange authorization code for tokens
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: ssoConfig.scopes,
    redirectUri: ssoConfig.redirectUri,
    codeVerifier: verifier,
  };

  const tokenResponse = await client.acquireTokenByCode(tokenRequest);

  if (!tokenResponse || !tokenResponse.idTokenClaims) {
    throw new Error('No token response from Entra ID');
  }

  const claims = tokenResponse.idTokenClaims as EntraUserClaims;
  const email = claims.email || claims.preferred_username;

  if (!email) {
    log.error('SSO', 'No email claim in Entra ID token', { claims: Object.keys(claims) });
    throw new Error('No email claim in Entra ID token. Please contact your administrator.');
  }

  const normalizedEmail = email.toLowerCase();

  // Try to find existing user by SSO provider ID
  let user = await prisma.user.findFirst({
    where: {
      ssoProvider: 'microsoft_entra',
      ssoProviderId: claims.oid,
    },
    include: {
      homeLocation: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  let isNewUser = false;

  if (!user) {
    // Try to link to existing user by email
    user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        homeLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (user) {
      // Link existing user to SSO
      log.info('SSO', 'Linking existing user to SSO', {
        userId: user.id,
        email: normalizedEmail,
      });

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ssoProvider: 'microsoft_entra',
          ssoProviderId: claims.oid,
          ssoEmail: email,
          ssoLastLogin: new Date(),
        },
        include: {
          homeLocation: {
            select: { id: true, code: true, name: true },
          },
        },
      });
    } else if (ssoConfig.autoCreateUsers) {
      // Create new user
      isNewUser = true;
      const userName =
        claims.name ||
        (claims.given_name && claims.family_name
          ? `${claims.given_name} ${claims.family_name}`
          : null) ||
        email.split('@')[0];

      log.info('SSO', 'Creating new user via SSO', {
        email: normalizedEmail,
        name: userName,
        role: ssoConfig.defaultRole,
      });

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          password: '', // Empty password - SSO only
          name: userName,
          role: ssoConfig.defaultRole as UserRole,
          ssoProvider: 'microsoft_entra',
          ssoProviderId: claims.oid,
          ssoEmail: email,
          ssoLastLogin: new Date(),
        },
        include: {
          homeLocation: {
            select: { id: true, code: true, name: true },
          },
        },
      });
    } else {
      log.warn('SSO', 'User not found and auto-creation is disabled', {
        email: normalizedEmail,
      });
      throw new Error(
        'No account found for this email. Please contact your administrator to create an account.'
      );
    }
  } else {
    // Update last login for existing SSO user
    user = await prisma.user.update({
      where: { id: user.id },
      data: { ssoLastLogin: new Date() },
      include: {
        homeLocation: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  // Generate application JWT
  const token = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  log.info('SSO', 'User authenticated via SSO', {
    userId: user.id,
    email: user.email,
    isNewUser,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      homeLocationId: user.homeLocationId,
      homeLocation: user.homeLocation,
    },
    token,
    isNewUser,
  };
}
