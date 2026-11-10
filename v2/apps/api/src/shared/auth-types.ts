export type Role = 'owner' | 'member' | 'viewer';

export type AuthedUser = {
  id: string;
  email: string;
  role: Role;
  name?: string;
};

export type AuthVerifier = (token: string) => Promise<AuthedUser>;

export type RequestUser = AuthedUser;

export const ROLE_ORDER: Role[] = ['owner', 'member', 'viewer'];

export function roleFromRoles(roles: readonly string[]): Role | null {
  return ROLE_ORDER.find((role) => roles.includes(role)) ?? null;
}
