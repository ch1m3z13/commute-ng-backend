import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOAuthState,
  validateOAuthState,
  buildOAuthRedirectUrl,
} from '../../../services/oauthService.js';

describe('createOAuthState', () => {
  it('returns a UUID string', () => {
    const state = createOAuthState();
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThan(0);
  });

  it('returns unique values on successive calls', () => {
    const s1 = createOAuthState();
    const s2 = createOAuthState();
    expect(s1).not.toBe(s2);
  });
});

describe('validateOAuthState', () => {
  it('returns true for valid state', () => {
    const state = createOAuthState();
    expect(validateOAuthState(state)).toBe(true);
  });

  it('returns false for unknown state', () => {
    expect(validateOAuthState('nonexistent-state')).toBe(false);
  });

  it('returns false after state is consumed (single use)', () => {
    const state = createOAuthState();
    expect(validateOAuthState(state)).toBe(true);
    expect(validateOAuthState(state)).toBe(false);
  });
});

describe('buildOAuthRedirectUrl', () => {
  it('builds Google URL with correct client_id', () => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';
    const url = buildOAuthRedirectUrl('google');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-google-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid');
  });

  it('builds LinkedIn URL with correct client_id', () => {
    process.env.LINKEDIN_CLIENT_ID = 'test-linkedin-id';
    const url = buildOAuthRedirectUrl('linkedin');
    expect(url).toContain('linkedin.com');
    expect(url).toContain('client_id=test-linkedin-id');
  });

  it('builds TikTok URL with correct client_key', () => {
    process.env.TIKTOK_CLIENT_ID = 'test-tiktok-id';
    const url = buildOAuthRedirectUrl('tiktok');
    expect(url).toContain('tiktok.com');
    expect(url).toContain('client_key=test-tiktok-id');
  });

  it('throws for unsupported provider', () => {
    expect(() => buildOAuthRedirectUrl('facebook' as any)).toThrow('Unsupported OAuth provider');
  });
});
