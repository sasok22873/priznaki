import type { NextFunction, Request, Response } from 'express';
import type { Db } from '../shared/db.js';
import type { AuthVerifier, RequestUser } from '../shared/auth-types.js';
import type { Role } from '../types.js';
import { errors } from '../shared/errors.js';
import { asyncHandler } from '../shared/http.js';

const ALLOWED_ROLES: Role[] = ['owner', 'member', 'viewer'];

export function createAuthMiddleware(db: Db, verifyToken: AuthVerifier) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw errors.unauthorized();

    const user = await verifyToken(token);
    const profile = await db.profile.findUnique({ where: { id: user.id } });
    if (!profile || profile.accessStatus !== 'active' || !ALLOWED_ROLES.includes(profile.role as Role)) {
      throw errors.forbidden('Нет активного доступа к штабу');
    }

    const requestUser: RequestUser = { id: user.id, email: user.email, role: profile.role as Role };
    req.user = requestUser;
    next();
  });
}

export function requireWriter(req: Request): RequestUser {
  const user = req.user;
  if (!user) throw errors.unauthorized();
  if (user.role === 'viewer') throw errors.forbidden('Наблюдатель не может менять данные');
  return user;
}
