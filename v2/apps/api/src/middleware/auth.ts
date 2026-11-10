import type { NextFunction, Request, Response } from 'express';
import type { AuthVerifier, RequestUser } from '../shared/auth-types.js';
import { errors } from '../shared/errors.js';
import { asyncHandler } from '../shared/http.js';

export function createAuthMiddleware(verifyToken: AuthVerifier) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (!token) throw errors.unauthorized();

    const user = await verifyToken(token);
    req.user = user;
    next();
  });
}

export function requireWriter(req: Request): RequestUser {
  const user = req.user;
  if (!user) throw errors.unauthorized();
  if (user.role === 'viewer') throw errors.forbidden('Наблюдатель не может менять данные');
  return user;
}
