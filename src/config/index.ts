import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '',
  oauthCallbackBaseUrl: process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001/api/auth',
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
  cognitoDomain: process.env.COGNITO_DOMAIN || '',
  cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
  cognitoClientSecret: process.env.COGNITO_CLIENT_SECRET || '',
  cognitoRegion: process.env.COGNITO_REGION || 'eu-west-1',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'noreply@commuteng.com',
};
