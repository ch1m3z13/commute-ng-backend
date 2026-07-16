import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export type OAuthProvider = 'google';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface CognitoTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
}

interface CognitoIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

const stateStore = new Map<string, number>();
const STATE_TTL_MS = 1000 * 60 * 5;

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

function getRedirectUri(): string {
  return `${config.oauthCallbackBaseUrl}/google/callback`;
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
  const redirectUri = getRedirectUri();

  const params: Record<string, string> = {
    response_type: 'code',
    client_id: config.cognitoClientId,
    redirect_uri: redirectUri,
    identity_provider: 'Google',
    scope: 'openid email profile',
    state,
  };

  return `https://${config.cognitoDomain}/oauth2/authorize?${buildQuery(params)}`;
}

async function fetchJson<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OAuth fetch failed (${response.status}): ${body}`);
  }
  return response.json() as T;
}

function decodeCognitoIdToken(idToken: string): CognitoIdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid ID token format');
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
  return payload as CognitoIdTokenClaims;
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
  if (provider !== 'google') {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const tokenUrl = `https://${config.cognitoDomain}/oauth2/token`;
  const redirectUri = getRedirectUri();

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.cognitoClientId,
    client_secret: config.cognitoClientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetchJson<CognitoTokenResponse>(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  const claims = decodeCognitoIdToken(tokenResponse.id_token);

  if (!claims.email) {
    throw new Error('No email in Cognito ID token');
  }

  return {
    provider: 'google',
    providerId: claims.sub,
    email: claims.email.toLowerCase(),
    displayName: claims.name || claims.email || 'Google User',
    photoURL: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}
