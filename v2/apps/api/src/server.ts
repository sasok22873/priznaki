import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { getDb } from './shared/db.js';
import { createSupabaseVerifier } from './middleware/supabase-auth.js';

const env = loadEnv();
const app = createApp({
  db: getDb(),
  verifyToken: createSupabaseVerifier(env.SUPABASE_URL, env.SUPABASE_JWT_AUD),
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
