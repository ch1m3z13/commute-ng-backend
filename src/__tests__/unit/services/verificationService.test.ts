import { describe, it, expect } from 'vitest';
import { validateNinFormat, computeTier, toIdCardStatus } from '../../../services/verificationService.js';

describe('validateNinFormat', () => {
  it('returns valid for 11-digit string starting with non-zero', () => {
    expect(validateNinFormat('12345678901')).toEqual({ valid: true });
  });

  it('returns invalid for empty string', () => {
    expect(validateNinFormat('')).toEqual({ valid: false, error: 'NIN is required' });
  });

  it('returns invalid for non-11-digit string', () => {
    expect(validateNinFormat('12345')).toEqual({ valid: false, error: 'NIN must be exactly 11 digits' });
  });

  it('returns invalid for string starting with 0', () => {
    expect(validateNinFormat('01234567890')).toEqual({ valid: false, error: 'NIN format is invalid' });
  });

  it('returns invalid for non-numeric string', () => {
    expect(validateNinFormat('abcdefghijk')).toEqual({ valid: false, error: 'NIN must be exactly 11 digits' });
  });

  it('trims whitespace before validation', () => {
    expect(validateNinFormat('  12345678901  ')).toEqual({ valid: true });
  });
});

describe('computeTier', () => {
  it('returns basic when no flags set', () => {
    expect(computeTier({ emailVerified: false, ninVerified: false, idCardVerified: false })).toBe('basic');
  });

  it('returns basic when only emailVerified', () => {
    expect(computeTier({ emailVerified: true, ninVerified: false, idCardVerified: false })).toBe('basic');
  });

  it('returns standard when emailVerified + ninVerified', () => {
    expect(computeTier({ emailVerified: true, ninVerified: true, idCardVerified: false })).toBe('standard');
  });

  it('returns full when all three flags set', () => {
    expect(computeTier({ emailVerified: true, ninVerified: true, idCardVerified: true })).toBe('full');
  });
});

describe('toIdCardStatus', () => {
  it('returns not_submitted when no idCardUrl', () => {
    expect(toIdCardStatus(false, null, 'unverified')).toBe('not_submitted');
    expect(toIdCardStatus(false, undefined, 'unverified')).toBe('not_submitted');
  });

  it('returns approved when idCardVerified is true', () => {
    expect(toIdCardStatus(true, 'http://example.com/id.jpg', 'verified')).toBe('approved');
  });

  it('returns rejected when verificationStatus is rejected', () => {
    expect(toIdCardStatus(false, 'http://example.com/id.jpg', 'rejected')).toBe('rejected');
  });

  it('returns pending_review when verificationStatus is pending', () => {
    expect(toIdCardStatus(false, 'http://example.com/id.jpg', 'pending')).toBe('pending_review');
  });
});
