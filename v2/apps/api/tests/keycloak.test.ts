import { SignJWT, exportJWK, generateKeyPair, type JSONWebKeySet, type KeyLike } from 'jose';
import { describe, expect, it } from 'vitest';
import { createKeycloakVerifier } from '../src/middleware/keycloak-auth.js';

const ISSUER = 'http://localhost:8080/realms/priznaki';
const AUDIENCE = 'pb-api';

async function makeKeys(): Promise<{ jwks: JSONWebKeySet; privateKey: KeyLike }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  return { jwks: { keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] }, privateKey };
}

async function sign(
  privateKey: KeyLike,
  claims: Record<string, unknown>,
  opts: { issuer?: string; audience?: string | string[]; expiresIn?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '5m')
    .setSubject('user-1')
    .sign(privateKey);
}

describe('Keycloak verifier', () => {
  it('принимает токен с ролью member', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(privateKey, {
      email: 'member@priznaki.local',
      name: 'Участник',
      realm_access: { roles: ['member', 'offline_access'] },
    });

    await expect(verifier(token)).resolves.toMatchObject({
      id: 'user-1',
      email: 'member@priznaki.local',
      role: 'member',
      name: 'Участник',
    });
  });

  it('owner приоритетнее member', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(privateKey, { realm_access: { roles: ['member', 'owner'] } });
    await expect(verifier(token)).resolves.toMatchObject({ role: 'owner' });
  });

  it('отклоняет токен без роли', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(privateKey, { realm_access: { roles: ['offline_access'] } });
    await expect(verifier(token)).rejects.toMatchObject({ status: 403 });
  });

  it('отклоняет токен с чужим issuer', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(
      privateKey,
      { realm_access: { roles: ['member'] } },
      { issuer: 'http://evil.local/realms/priznaki' },
    );
    await expect(verifier(token)).rejects.toMatchObject({ status: 401 });
  });

  it('отклоняет токен с чужой аудиторией', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(privateKey, { realm_access: { roles: ['member'] } }, { audience: 'account' });
    await expect(verifier(token)).rejects.toMatchObject({ status: 401 });
  });

  it('отклоняет истёкший токен', async () => {
    const { jwks, privateKey } = await makeKeys();
    const verifier = createKeycloakVerifier({ issuer: ISSUER, localJwks: jwks, audience: AUDIENCE });
    const token = await sign(privateKey, { realm_access: { roles: ['member'] } }, { expiresIn: '-1s' });
    await expect(verifier(token)).rejects.toMatchObject({ status: 401 });
  });
});
