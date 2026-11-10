import { z } from 'zod';

const envSchema = z.object({
  VITE_API_URL: z.string().default('/api'),
  VITE_KEYCLOAK_URL: z.string().url(),
  VITE_KEYCLOAK_REALM: z.string().min(1),
  VITE_KEYCLOAK_CLIENT_ID: z.string().min(1),
});

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL,
  VITE_KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM,
  VITE_KEYCLOAK_CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});
