import type { Role } from '../types.js';

export type AuthedUser = { id: string; email: string };
export type AuthVerifier = (token: string) => Promise<AuthedUser>;
export type RequestUser = AuthedUser & { role: Role };
