import { createRemoteJWKSet, createLocalJWKSet, jwtVerify, type JSONWebKeySet, type JWTVerifyGetKey } from 'jose';
import { errors } from '../shared/errors.js';
import { roleFromRoles, type AuthedUser, type AuthVerifier } from '../shared/auth-types.js';

export type KeycloakVerifierOptions = {
  /** Например http://localhost:8080/realms/priznaki */
  issuer: string;
  /** Внутри Docker JWKS доступен по внутреннему адресу keycloak:8080 */
  jwksUrl?: string;
  /** Для тестов: локальный набор ключей вместо сетевого запроса */
  localJwks?: JSONWebKeySet;
  /** Ожидаемая аудитория access-токена (маппер pb-api) */
  audience?: string;
};

/**
 * Проверяет access-токен Keycloak: подпись по JWKS, issuer, аудиторию,
 * вытаскивает роли realm_access.roles → owner/member/viewer.
 */
export function createKeycloakVerifier(options: KeycloakVerifierOptions): AuthVerifier {
  const getKey: JWTVerifyGetKey = options.localJwks
    ? createLocalJWKSet(options.localJwks)
    : createRemoteJWKSet(new URL(options.jwksUrl ?? `${options.issuer}/protocol/openid-connect/certs`));

  return async (token: string): Promise<AuthedUser> => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, getKey, {
        issuer: options.issuer,
        ...(options.audience ? { audience: options.audience } : {}),
      }));
    } catch {
      throw errors.unauthorized('Сессия истекла — войдите снова');
    }

    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
    const role = roleFromRoles(realmAccess?.roles ?? []);
    if (!role) throw errors.forbidden('У пользователя нет роли в штабе');

    return {
      id: String(payload.sub),
      email: String(payload.email ?? ''),
      role,
      name: String(payload.name ?? payload.preferred_username ?? ''),
    };
  };
}
