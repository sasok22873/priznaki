import { createRemoteJWKSet, jwtVerify } from 'jose';
import { errors } from '../shared/errors.js';
import type { AuthVerifier } from '../shared/auth-types.js';

/**
 * Проверяем access-токен Supabase (GoTrue) по JWKS — пароли и сессии остаются
 * в Supabase Auth, а Node-бэкенд только валидирует подпись и берёт sub/email.
 */
export function createSupabaseVerifier(supabaseUrl: string, audience = 'authenticated'): AuthVerifier {
  const jwks = createRemoteJWKSet(new URL(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`));
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, jwks, { audience });
      if (!payload.sub) throw errors.unauthorized('В токене нет пользователя');
      return { id: payload.sub, email: String(payload.email ?? '') };
    } catch (e) {
      if (e instanceof Error && e.message.includes('В токене')) throw e;
      throw errors.unauthorized('Сессия истекла — войдите снова');
    }
  };
}
