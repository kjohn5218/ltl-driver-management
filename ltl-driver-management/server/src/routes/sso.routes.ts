/**
 * SSO Routes for Microsoft Entra ID (Azure AD)
 * Handles OIDC authentication flow endpoints
 */

import { Router, Request, Response } from 'express';
import { getSSOConfig, isSSOConfigured } from '../config/sso.config';
import { log } from '../utils/logger';

// Dynamic import to avoid circular dependency with prisma
const getSSOService = () => import('../services/sso.service');

const router = Router();

/**
 * PKCE verifier storage
 * In production with multiple servers, use Redis or another shared store
 */
interface PKCEEntry {
  verifier: string;
  expires: number;
}

const pkceStore = new Map<string, PKCEEntry>();

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pkceStore.entries()) {
    if (value.expires < now) {
      pkceStore.delete(key);
    }
  }
}, 60000);

/**
 * GET /api/auth/sso/status
 * Check if SSO is enabled and configured
 */
router.get('/status', (_req: Request, res: Response) => {
  const ssoConfig = getSSOConfig();
  const configured = isSSOConfigured();

  res.json({
    enabled: ssoConfig.enabled && configured,
    provider: ssoConfig.enabled && configured ? 'microsoft_entra' : null,
  });
});

/**
 * GET /api/auth/sso/login
 * Initiate SSO login - redirects to Entra ID
 */
router.get('/login', async (_req: Request, res: Response) => {
  try {
    const ssoConfig = getSSOConfig();

    if (!ssoConfig.enabled || !isSSOConfigured()) {
      log.warn('SSO', 'SSO login attempted but SSO is not enabled or configured');
      return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=sso_not_enabled`);
    }

    const { getAuthUrl } = await getSSOService();
    const { url, verifier, state } = await getAuthUrl();

    // Store PKCE verifier with 10 minute expiry
    pkceStore.set(state, {
      verifier,
      expires: Date.now() + 600000, // 10 minutes
    });

    log.debug('SSO', 'Initiating SSO login', { state });

    return res.redirect(url);
  } catch (error) {
    log.error('SSO', 'Failed to initiate SSO login', error);
    const ssoConfig = getSSOConfig();
    return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=sso_init_failed`);
  }
});

/**
 * GET /api/auth/sso/callback
 * Handle Entra ID callback after user authentication
 */
router.get('/callback', async (req: Request, res: Response) => {
  const ssoConfig = getSSOConfig();

  try {
    const { code, state, error, error_description } = req.query;

    // Handle Entra ID errors
    if (error) {
      log.warn('SSO', 'Entra ID returned error', {
        error,
        error_description,
      });
      return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=sso_denied`);
    }

    // Validate required parameters
    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      log.warn('SSO', 'Invalid callback parameters', {
        hasCode: !!code,
        hasState: !!state,
      });
      return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=invalid_callback`);
    }

    // Retrieve and validate PKCE verifier
    const pkceEntry = pkceStore.get(state);
    if (!pkceEntry) {
      log.warn('SSO', 'Invalid or expired state parameter', { state });
      return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=invalid_state`);
    }

    // Remove used entry
    pkceStore.delete(state);

    // Check if entry has expired
    if (pkceEntry.expires < Date.now()) {
      log.warn('SSO', 'PKCE verifier expired', { state });
      return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=session_expired`);
    }

    // Exchange code for tokens and get/create user
    const { handleCallback } = await getSSOService();
    const { user, token, isNewUser } = await handleCallback(code, pkceEntry.verifier);

    log.info('SSO', 'SSO callback successful', {
      userId: user.id,
      email: user.email,
      isNewUser,
    });

    // Redirect to frontend with token and user data
    const redirectUrl = new URL(`${ssoConfig.postLoginRedirect}/sso/callback`);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set(
      'user',
      encodeURIComponent(
        JSON.stringify({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          homeLocationId: user.homeLocationId,
          homeLocation: user.homeLocation,
        })
      )
    );

    return res.redirect(redirectUrl.toString());
  } catch (error: any) {
    log.error('SSO', 'SSO callback failed', error);

    // Determine appropriate error message
    let errorCode = 'sso_failed';
    if (error.message?.includes('not found') || error.message?.includes('No account')) {
      errorCode = 'user_not_found';
    } else if (error.message?.includes('No email')) {
      errorCode = 'no_email';
    }

    return res.redirect(`${ssoConfig.postLoginRedirect}/login?error=${errorCode}`);
  }
});

export default router;
