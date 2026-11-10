import Keycloak from 'keycloak-js';
import { env } from '@/shared/config/env';

/** Единственный экземпляр Keycloak на приложение (PKCE, публичный клиент pb-web) */
export const keycloak = new Keycloak({
  url: env.VITE_KEYCLOAK_URL,
  realm: env.VITE_KEYCLOAK_REALM,
  clientId: env.VITE_KEYCLOAK_CLIENT_ID,
});

export function keycloakLogin(): void {
  void keycloak.login({ redirectUri: window.location.origin });
}

export function keycloakLogout(): void {
  void keycloak.logout({ redirectUri: `${window.location.origin}/login` });
}
