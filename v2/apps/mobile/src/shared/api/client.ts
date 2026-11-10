import { mobileEnv, useSession } from '@/entities/session';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token;
  const res = await fetch(`${mobileEnv.API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Ошибка ${res.status}`);
  }
  return (await res.json()) as T;
}
