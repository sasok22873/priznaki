import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/entities/session';
import { keycloak } from '@/shared/keycloak';

/**
 * Инициализация Keycloak: check-sso (без принудительного редиректа),
 * PKCE, автообновление токена каждые 30 секунд.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setToken = useSession((s) => s.setToken);
  const setReady = useSession((s) => s.setReady);
  const signOut = useSession((s) => s.signOut);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    keycloak
      .init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false })
      .then((authenticated) => {
        if (authenticated && keycloak.token) setToken(keycloak.token);
        setReady(true);
        timer = setInterval(async () => {
          try {
            const refreshed = await keycloak.updateToken(60);
            if (refreshed && keycloak.token) setToken(keycloak.token);
          } catch {
            signOut();
          }
        }, 30_000);
      })
      .catch(() => setReady(true));

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [setToken, setReady, signOut]);

  return <>{children}</>;
}
