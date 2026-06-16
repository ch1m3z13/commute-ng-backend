import { Router } from 'express';
import { userService } from '../services/userService.js';
import { buildOAuthRedirectUrl, exchangeOAuthCode, validateOAuthState, OAuthProvider } from '../services/oauthService.js';
import { signJwt } from '../config/auth.js';
import { config } from '../config/index.js';
import { createRefreshToken } from '../services/refreshTokenService.js';

const router = Router();

function resolveProvider(value: string): OAuthProvider {
  const provider = value.toLowerCase();
  if (provider === 'google') {
    return provider;
  }
  throw new Error('Unsupported OAuth provider');
}

router.get('/:provider', async (req, res) => {
  try {
    const provider = resolveProvider(req.params.provider);
    const redirectUrl = buildOAuthRedirectUrl(provider);
    res.redirect(redirectUrl);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid OAuth provider' });
  }
});

router.get('/:provider/callback', async (req, res) => {
  try {
    const provider = resolveProvider(req.params.provider);
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }
    if (!state || typeof state !== 'string' || !validateOAuthState(state)) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' });
    }

    const profile = await exchangeOAuthCode(provider, code);
    let user = await userService.getUserByProvider(profile.provider, profile.providerId);

    if (!user) {
      user = await userService.getUserByEmail(profile.email);
    }

    if (!user) {
      user = await userService.createUser(profile.providerId, {
        email: profile.email,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        provider: profile.provider,
        providerId: profile.providerId,
      });
      await userService.setEmailVerified(user.uid, true);
    } else if (!user.provider || !user.providerId) {
      await userService.updateUser(user.uid, {
        provider: profile.provider,
        providerId: profile.providerId,
        photoURL: profile.photoURL || user.photoURL,
      });
      if (!user.emailVerified) {
        await userService.setEmailVerified(user.uid, true);
      }
    }

    const token = signJwt({ uid: user.uid, email: user.email });
    const refreshToken = await createRefreshToken(user.uid);
    const redirectUrl = `${config.frontendBaseUrl}/auth/callback#token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    res.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    res.status(500).json({ error: message });
  }
});

export default router;
