import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, loadAuthUser, AuthUser } from '../services/auth.service';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await loadAuthUser(payload.sub);
    if (!user) throw new UnauthorizedError('User not found or inactive');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermissions(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw new UnauthorizedError();
      if (req.user.roleCode === 'SUPER_ADMIN') {
        next();
        return;
      }
      const missing = required.filter((p) => !req.user!.permissions.includes(p));
      if (missing.length) {
        throw new ForbiddenError(`Missing permissions: ${missing.join(', ')}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw new UnauthorizedError();
      if (!roles.includes(req.user.roleCode)) {
        throw new ForbiddenError('Insufficient role');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Ensures the user may access the given resort ID (HO roles with all locations pass). */
export function assertLocationAccess(user: AuthUser, resortId: string): void {
  if (user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'HO_HR_ADMIN') {
    return;
  }
  if (!user.locationIds.includes(resortId)) {
    throw new ForbiddenError('No access to this location');
  }
}

export function resolveAccessibleResortIds(
  user: AuthUser,
  requestedResortId?: string | null
): string[] | null {
  // null = all resorts (super/HO)
  if (user.roleCode === 'SUPER_ADMIN' || user.roleCode === 'HO_HR_ADMIN' || user.roleCode === 'AUDITOR') {
    if (requestedResortId) return [requestedResortId];
    return null;
  }
  if (requestedResortId) {
    assertLocationAccess(user, requestedResortId);
    return [requestedResortId];
  }
  return user.locationIds;
}
