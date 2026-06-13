import { describe, it, expect, vi } from 'vitest';
import {
  createOAuthState,
  validateOAuthState,
  buildOAuthRedirectUrl,
} from '../../../services/oauthService.js';

vi.mock('../../../config/index.js', () => ({
  config: {
    googleClientId: 'test-google-id',
    googleClientSecret: 'test-secret',
    oauthCallbackBaseUrl: 'http://localhost:3001/api/auth',
  },
}));

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
    const url = buildOAuthRedirectUrl('google');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=test-google-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=openid');
  });

  it('throws for unsupported provider', () => {
    expect(() => buildOAuthRedirectUrl('facebook' as any)).toThrow('Unsupported OAuth provider');
  });
});
