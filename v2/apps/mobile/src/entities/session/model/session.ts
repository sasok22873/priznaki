import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://mbbetmtxawduvcsttiis.supabase.co';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

type SessionState = {
  token: string | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      signIn: async (email, password) => {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
          body: JSON.stringify({ email, password }),
        });
        const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
        if (!res.ok || !data.access_token) throw new Error(data.error_description ?? 'Неверная почта или пароль');
        set({ token: data.access_token, email });
      },
      signOut: () => set({ token: null, email: null }),
    }),
    { name: 'pb2-mobile-session', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const mobileEnv = { API_URL, SUPABASE_URL, ANON_KEY };
