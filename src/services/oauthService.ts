import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';

export type OAuthProvider = 'google';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

// Typed responses for Google OAuth
interface GoogleTokenResponse { access_token: string }
interface GoogleUserInfo { sub: string; email?: string; name?: string; picture?: string }

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
  if (provider !== 'google') {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
  const state = createOAuthState();
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

async function fetchJson<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OAuth fetch failed (${response.status}): ${body}`);
  }
  return response.json() as T;
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
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
