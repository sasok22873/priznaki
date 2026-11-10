import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const KEYCLOAK_URL = process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'priznaki';
const KEYCLOAK_CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'pb-mobile';

type SessionState = {
  token: string | null;
  setToken: (token: string | null) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      signOut: () => set({ token: null }),
    }),
    { name: 'pb2-mobile-session', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const mobileEnv = {
  API_URL,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  issuer: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
};
