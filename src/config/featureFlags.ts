export const featureFlags = {
  auth: {
    provider: process.env.AUTH_PROVIDER || 'firebase', // 'firebase' | 'supabase'
  },
  database: {
    provider: process.env.DATABASE_PROVIDER || 'firestore', // 'firestore' | 'postgres'
  },
};
