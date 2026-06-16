import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '',
  oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001/api/auth',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'noreply@commuteng.com',
};
