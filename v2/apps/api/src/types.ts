import type { RequestUser } from './shared/auth-types.js';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export type Role = 'owner' | 'member' | 'viewer';

export {};
