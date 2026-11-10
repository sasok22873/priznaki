import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { getDb } from './shared/db.js';
import { createKeycloakVerifier } from './middleware/keycloak-auth.js';

const env = loadEnv();
const app = createApp({
  db: getDb(),
  verifyToken: createKeycloakVerifier({
    issuer: env.KEYCLOAK_ISSUER,
    jwksUrl: env.KEYCLOAK_JWKS_URL,
    audience: env.KEYCLOAK_AUDIENCE,
  }),
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
