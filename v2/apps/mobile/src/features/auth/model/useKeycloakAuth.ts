import { useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import { useSession, mobileEnv } from '@/entities/session';

export type KeycloakAuthState = {
  ready: boolean;
  pending: boolean;
  error: string | null;
  signIn: () => void;
};

/**
 * OIDC Authorization Code + PKCE через Keycloak.
 * Клиент pb-mobile в realm priznaki с redirect priznaki24://auth.
 */
export function useKeycloakAuth(): KeycloakAuthState {
  const setToken = useSession((s) => s.setToken);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'priznaki24', path: 'auth' });
  const discovery = {
    authorizationEndpoint: `${mobileEnv.issuer}/protocol/openid-connect/auth`,
    tokenEndpoint: `${mobileEnv.issuer}/protocol/openid-connect/token`,
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: mobileEnv.KEYCLOAK_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setPending(false);
      setError(response.error?.message ?? 'Ошибка входа');
      return;
    }
    if (response.type !== 'success') {
      setPending(false);
      return;
    }
    const code = response.params.code;
    if (!code) {
      setPending(false);
      setError('Keycloak не вернул код авторизации');
      return;
    }
    void (async () => {
      try {
        const res = await fetch(discovery.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: mobileEnv.KEYCLOAK_CLIENT_ID,
            code,
            redirect_uri: redirectUri,
            code_verifier: request?.codeVerifier ?? '',
          }).toString(),
        });
        const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
        if (!res.ok || !data.access_token) throw new Error(data.error_description ?? 'Не удалось получить токен');
        setToken(data.access_token);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось войти');
      } finally {
        setPending(false);
      }
    })();
  }, [response, request, redirectUri, discovery.tokenEndpoint, setToken]);

  return {
    ready: Boolean(request),
    pending,
    error,
    signIn: () => {
      setError(null);
      setPending(true);
      void promptAsync();
    },
  };
}
