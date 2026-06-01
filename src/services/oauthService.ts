import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';

export type OAuthProvider = 'google' | 'linkedin' | 'tiktok';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

// Typed responses for OAuth providers
interface GoogleTokenResponse { access_token: string }
interface GoogleUserInfo { sub: string; email?: string; name?: string; picture?: string }
interface LinkedInTokenResponse { access_token: string }
interface LinkedInProfile { id: string; localizedFirstName?: string; localizedLastName?: string }
interface LinkedInEmailData { elements?: Array<{ 'handle~'?: { emailAddress?: string } }> }
interface TikTokTokenResponse {
  data?: { open_id?: string; access_token?: string };
  open_id?: string;
  access_token?: string;
}
interface TikTokUserInfo {
  data?: { name?: string; display_name?: string; avatar_url?: string; email?: string };
  name?: string;
  display_name?: string;
  avatar_url?: string;
  email?: string;
}

const stateStore = new Map<string, number>();
const STATE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export function createOAuthState(): string {
  const state = randomUUID();
  stateStore.set(state, Date.now());
  return state;
}

export function validateOAuthState(state: string): boolean {
  const createdAt = stateStore.get(state);
  if (!createdAt) return false;
  if (Date.now() - createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    return false;
  }
  stateStore.delete(state);
  return true;
}

function getRedirectUri(provider: OAuthProvider): string {
  return `${config.oauthCallbackBaseUrl}/${provider}/callback`;
}

function normalizeEmail(email: string | null, provider: OAuthProvider, providerId: string): string {
  if (email && email.trim().length > 0) {
    return email.toLowerCase();
  }
  return `${provider}.${providerId}@social-login.local`;
}

function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function buildOAuthRedirectUrl(provider: OAuthProvider): string {
  const state = createOAuthState();
  switch (provider) {
    case 'google': {
      const params = {
        client_id: config.googleClientId,
        redirect_uri: getRedirectUri('google'),
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        state,
      };
      return `https://accounts.google.com/o/oauth2/v2/auth?${buildQuery(params)}`;
    }
    case 'linkedin': {
      const params = {
        response_type: 'code',
        client_id: config.linkedinClientId,
        redirect_uri: getRedirectUri('linkedin'),
        scope: 'r_liteprofile r_emailaddress',
        state,
      };
      return `https://www.linkedin.com/oauth/v2/authorization?${buildQuery(params)}`;
    }
    case 'tiktok': {
      const params = {
        client_key: config.tiktokClientId,
        redirect_uri: getRedirectUri('tiktok'),
        response_type: 'code',
        scope: 'user.info.basic',
        state,
      };
      return `https://open-api.tiktok.com/platform/oauth/connect/?${buildQuery(params)}`;
    }
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}

async function fetchJson<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OAuth fetch failed (${response.status}): ${body}`);
  }
  return response.json() as T;
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
  switch (provider) {
    case 'google': {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const tokenBody = new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri('google'),
      });

      const tokenResponse = await fetchJson<GoogleTokenResponse>(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      const userInfo = await fetchJson<GoogleUserInfo>('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + tokenResponse.access_token },
      });

      return {
        provider: 'google',
        providerId: String(userInfo.sub),
        email: normalizeEmail(userInfo.email ?? null, 'google', String(userInfo.sub)),
        displayName: String(userInfo.name || userInfo.email || 'Google User'),
        photoURL: typeof userInfo.picture === 'string' ? userInfo.picture : undefined,
      };
    }
    case 'linkedin': {
      const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri('linkedin'),
        client_id: config.linkedinClientId,
        client_secret: config.linkedinClientSecret,
      });

      const tokenResponse = await fetchJson<LinkedInTokenResponse>(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      const profile = await fetchJson<LinkedInProfile>('https://api.linkedin.com/v2/me', {
        headers: { Authorization: 'Bearer ' + tokenResponse.access_token },
      });
      const emailData = await fetchJson<LinkedInEmailData>('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: { Authorization: 'Bearer ' + tokenResponse.access_token },
      });

      const providerId = String(profile.id);
      const email = emailData?.elements?.[0]?.['handle~']?.emailAddress ?? null;
      const firstName = profile.localizedFirstName ?? '';
      const lastName = profile.localizedLastName ?? '';

      return {
        provider: 'linkedin',
        providerId,
        email: normalizeEmail(email, 'linkedin', providerId),
        displayName: `${firstName} ${lastName}`.trim() || `LinkedIn User`,
      };
    }
    case 'tiktok': {
      const tokenUrl = 'https://open-api.tiktok.com/oauth/access_token/';
      const tokenBody = new URLSearchParams({
        client_key: config.tiktokClientId,
        client_secret: config.tiktokClientSecret,
        code,
        grant_type: 'authorization_code',
      });

      const tokenResponse = await fetchJson<TikTokTokenResponse>(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      const openId = String(tokenResponse.data?.open_id || tokenResponse.open_id || '');
      const accessToken = String(tokenResponse.data?.access_token || tokenResponse.access_token || '');
      if (!openId || !accessToken) {
        throw new Error('TikTok OAuth token exchange returned invalid data');
      }

      const userInfoUrl = new URL('https://open-api.tiktok.com/oauth/userinfo/');
      userInfoUrl.searchParams.set('access_token', accessToken);
      userInfoUrl.searchParams.set('open_id', openId);

      const userInfo = await fetchJson<TikTokUserInfo>(userInfoUrl.toString());
      const userData = userInfo.data || userInfo;
      const displayName = String(userData.name || userData.display_name || `TikTok User`);
      const email = normalizeEmail(userData.email ?? null, 'tiktok', openId);
      const photoURL = typeof userData.avatar_url === 'string' ? userData.avatar_url : undefined;

      return {
        provider: 'tiktok',
        providerId: openId,
        email,
        displayName,
        photoURL,
      };
    }
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
