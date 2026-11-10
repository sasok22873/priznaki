import type { RequestUser, Role } from './shared/auth-types.js';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export type { Role };

export {};
