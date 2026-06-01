import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { getDb } from '../config/database.js';
import { config } from '../config/index.js';
import { VerificationTier } from '../models/types.js';

// ─── OTP ─────────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_HASH_ROUNDS = 10;

export async function generateAndStoreOtp(uid: string): Promise<string> {
  const rawOtp = randomBytes(3).readUInt32BE(0).toString().padStart(OTP_LENGTH, '0').slice(0, OTP_LENGTH);
  const hashed = await bcrypt.hash(rawOtp, OTP_HASH_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await getDb().prepare(
    'UPDATE users SET otpCode = @otpCode, otpExpiresAt = @otpExpiresAt WHERE uid = @uid'
  ).run({ otpCode: hashed, otpExpiresAt: expiresAt, uid });

  return rawOtp; // Return plain OTP — caller must deliver it securely
}

export async function verifyOtp(uid: string, rawOtp: string): Promise<boolean> {
  const row = await getDb().prepare(
    'SELECT otpCode, otpExpiresAt FROM users WHERE uid = @uid'
  ).get({ uid }) as { otpCode: string; otpExpiresAt: string } | undefined;

  if (!row || !row.otpCode || !row.otpExpiresAt) return false;
  if (new Date(row.otpExpiresAt) < new Date()) return false;

  const match = await bcrypt.compare(rawOtp, row.otpCode);
  if (!match) return false;

  // Mark phone as verified and clear OTP
  await getDb().prepare(
    'UPDATE users SET phoneVerified = 1, otpCode = NULL, otpExpiresAt = NULL WHERE uid = @uid'
  ).run({ uid });

  return true;
}

export async function clearOtp(uid: string): Promise<void> {
  await getDb().prepare(
    'UPDATE users SET otpCode = NULL, otpExpiresAt = NULL WHERE uid = @uid'
  ).run({ uid });
}

// ─── NIN Validation ────────────────────────────────────────────────────────────

/**
 * Nigerian NIN format validation.
 * NIN is an 11-digit number. While there's no publicly documented check digit
 * for external use, we validate:
 *   - Exactly 11 characters
 *   - All characters are digits
 *   - First digit is non-zero (structural convention)
 *
 * For full government verification, an async call to a NIN lookup API would be
 * needed — this function handles the format gate. Real NIN verification
 * (birth date, photo, biometrics) requires an authorized NIMC API integration.
 */
export function validateNinFormat(nin: string): { valid: boolean; error?: string } {
  if (!nin || typeof nin !== 'string') {
    return { valid: false, error: 'NIN is required' };
  }

  const trimmed = nin.trim();

  if (!/^\d{11}$/.test(trimmed)) {
    return { valid: false, error: 'NIN must be exactly 11 digits' };
  }

  if (trimmed[0] === '0') {
    return { valid: false, error: 'NIN format is invalid' };
  }

  return { valid: true };
}

// ─── Tier Computation ─────────────────────────────────────────────────────────

export function computeTier(flags: {
  phoneVerified: boolean;
  ninVerified: boolean;
  idCardVerified: boolean;
}): VerificationTier {
  if (flags.phoneVerified && flags.ninVerified && flags.idCardVerified) return 'full';
  if (flags.phoneVerified && flags.ninVerified) return 'standard';
  if (flags.phoneVerified) return 'basic';
  return 'basic' as VerificationTier;
}

export function toIdCardStatus(idCardVerified: boolean, idCardUrl: string | null | undefined, verificationStatus: string): 'not_submitted' | 'pending_review' | 'approved' | 'rejected' {
  if (!idCardUrl) return 'not_submitted';
  if (idCardVerified) return 'approved';
  if (verificationStatus === 'rejected') return 'rejected';
  if (verificationStatus === 'pending') return 'pending_review';
  return 'not_submitted';
}

// ─── SMS Delivery ─────────────────────────────────────────────────────────────

/**
 * Send an SMS message.
 *
 * In production, configure the following environment variables for Twilio:
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_PHONE_NUMBER=+234xxxxxxxxxx
 *
 * If Twilio is not configured, the OTP is logged to the console in development.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio') as { default: (sid: string, token: string) => { messages: { create: (opts: Record<string, string>) => Promise<unknown> } } };
    const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const e164 = toE164(to);
    await client.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to: e164,
    });
  } else {
    // Development fallback — log OTP to console
    console.warn('[SMS] Twilio not configured. To: ' + to + ' | Body: ' + body);
  }
}

/**
 * Normalize a Nigerian mobile number to E.164 format.
 * Accepts: 0805..., +234805..., 234805...
 * Returns: +234805...
 */
function toE164(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 14) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  // Already digits, assume it's an 810... number without country code
  if (digits.length === 10) {
    return `+234${digits}`;
  }
  return `+${digits}`;
}
