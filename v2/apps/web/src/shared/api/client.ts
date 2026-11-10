import { useMemo } from 'react';
import { useSession } from '@/entities/session';
import { env } from '@/shared/config/env';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  token?: string | null;
};

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const token = options.token ?? useSession.getState().token;
  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = payload as { error?: { code?: string; message?: string } } | null;
    const message = parsed?.error?.message ?? `Ошибка запроса (${res.status})`;
    const code = parsed?.error?.code ?? 'HTTP_ERROR';
    if (res.status === 401) useSession.getState().signOut();
    throw new HttpError(res.status, code, message);
  }
  return payload as T;
}

export function useApiToken(): string | null {
  const token = useSession((s) => s.token);
  return useMemo(() => token, [token]);
}
