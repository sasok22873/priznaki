import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

type SessionState = {
  token: string | null;
  user: SessionUser | null;
  ready: boolean;
  setReady: (ready: boolean) => void;
  setToken: (token: string) => void;
  signOut: () => void;
};

function parseToken(token: string): SessionUser | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: string;
      email?: string;
      name?: string;
      preferred_username?: string;
      realm_access?: { roles?: string[] };
    };
    return {
      id: String(json.sub ?? ''),
      email: String(json.email ?? ''),
      name: String(json.name ?? json.preferred_username ?? ''),
      roles: json.realm_access?.roles ?? [],
    };
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      ready: false,
      setReady: (ready) => set({ ready }),
      setToken: (token) => set({ token, user: parseToken(token) }),
      signOut: () => set({ token: null, user: null }),
    }),
    { name: 'pb2-session' },
  ),
);
