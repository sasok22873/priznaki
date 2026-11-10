import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  /** http://localhost:8080/realms/priznaki — именно этот issuer приходит в токене */
  KEYCLOAK_ISSUER: z.string().url(),
  /** Внутри Docker: http://keycloak:8080/realms/priznaki/protocol/openid-connect/certs */
  KEYCLOAK_JWKS_URL: z.string().url().optional(),
  KEYCLOAK_AUDIENCE: z.string().default('pb-api'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Некорректные переменные окружения: ${issues}`);
  }
  return parsed.data;
}
