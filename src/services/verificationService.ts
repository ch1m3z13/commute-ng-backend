import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { getDb } from '../config/database.js';
import { config } from '../config/index.js';
import { VerificationTier } from '../models/types.js';

// ─── OTP ─────────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_HASH_ROUNDS = 10;

export async function generateAndStoreOtp(uid: string): Promise<string> {
  const rawOtp = randomBytes(4).readUInt32BE(0).toString().padStart(OTP_LENGTH, '0').slice(0, OTP_LENGTH);
  const hashed = await bcrypt.hash(rawOtp, OTP_HASH_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await getDb().prepare(
    'UPDATE users SET otpCode = @otpCode, otpExpiresAt = @otpExpiresAt WHERE uid = @uid'
  ).run({ otpCode: hashed, otpExpiresAt: expiresAt, uid });

  return rawOtp;
}

export async function verifyOtp(uid: string, rawOtp: string): Promise<boolean> {
  const row = await getDb().prepare(
    'SELECT otpCode, otpExpiresAt FROM users WHERE uid = @uid'
  ).get({ uid }) as { otpCode: string; otpExpiresAt: string } | undefined;

  if (!row || !row.otpCode || !row.otpExpiresAt) return false;
  if (new Date(row.otpExpiresAt) < new Date()) return false;

  const match = await bcrypt.compare(rawOtp, row.otpCode);
  if (!match) return false;

  // Mark email as verified and clear OTP
  await getDb().prepare(
    'UPDATE users SET emailVerified = 1, otpCode = NULL, otpExpiresAt = NULL WHERE uid = @uid'
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
  emailVerified: boolean;
  ninVerified: boolean;
  idCardVerified: boolean;
}): VerificationTier {
  if (flags.emailVerified && flags.ninVerified && flags.idCardVerified) return 'full';
  if (flags.emailVerified && flags.ninVerified) return 'standard';
  if (flags.emailVerified) return 'basic';
  return 'basic' as VerificationTier;
}

export function toIdCardStatus(idCardVerified: boolean, idCardUrl: string | null | undefined, verificationStatus: string): 'not_submitted' | 'pending_review' | 'approved' | 'rejected' {
  if (!idCardUrl) return 'not_submitted';
  if (idCardVerified) return 'approved';
  if (verificationStatus === 'rejected') return 'rejected';
  if (verificationStatus === 'pending') return 'pending_review';
  return 'not_submitted';
}

// ─── Email Delivery ───────────────────────────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

/**
 * Send a verification OTP email via SMTP (Mailtrap or any SMTP server).
 *
 * Environment variables:
 *   SMTP_HOST  — SMTP server hostname
 *   SMTP_PORT  — SMTP server port (default: 587)
 *   SMTP_USER  — SMTP username
 *   SMTP_PASS  — SMTP password
 *   SMTP_FROM  — sender email address
 *
 * Falls back to console logging in development when credentials are missing.
 */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const { smtpHost, smtpUser, smtpPass, smtpFrom } = config;

  if (smtpHost && smtpUser && smtpPass) {
    const mailer = getTransporter();
    await mailer.sendMail({
      from: smtpFrom,
      to,
      subject: 'CommuteNG Verification Code',
      text: `Your CommuteNG verification code is: ${otp}. It expires in 10 minutes.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #16a34a; margin: 0;">CommuteNG</h1>
          </div>
          <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #374151; margin: 0 0 16px;">Your verification code is:</p>
            <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #111827; margin: 0; font-family: monospace;">${otp}</p>
          </div>
          <p style="font-size: 13px; color: #6b7280; text-align: center; margin: 0;">
            This code expires in <strong>10 minutes</strong>. If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });
  } else {
    // Development fallback — log OTP to console
    console.warn('[Email] SMTP not configured. To: ' + to + ' | OTP: ' + otp);
  }
}
