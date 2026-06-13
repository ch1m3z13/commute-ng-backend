import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '',
  oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001/api/auth',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID || '',
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  tiktokClientId: process.env.TIKTOK_CLIENT_ID || '',
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
  smtpHost: process.env.SMTP_HOST || 'live.smtp.mailtrap.io',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || 'api',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'noreply@mailtrap.io',
};
