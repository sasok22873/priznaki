import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env } from '@/shared/config/env';

type SessionState = {
  token: string | null;
  refreshToken: string | null;
  email: string | null;
  userId: string | null;
  expiresAt: number | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

type SupabaseTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string };
  error_description?: string;
  msg?: string;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      email: null,
      userId: null,
      expiresAt: null,
      signIn: async (email, password) => {
        const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password }),
        });
        const payload = (await res.json().catch(() => ({}))) as SupabaseTokenResponse;
        if (!res.ok || !payload.access_token) {
          throw new Error(payload.error_description ?? payload.msg ?? 'Неверная почта или пароль');
        }
        set({
          token: payload.access_token,
          refreshToken: payload.refresh_token ?? null,
          email: payload.user?.email ?? email,
          userId: payload.user?.id ?? null,
          expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null,
        });
      },
      signOut: () =>
        set({ token: null, refreshToken: null, email: null, userId: null, expiresAt: null }),
    }),
    { name: 'pb2-session' },
  ),
);
