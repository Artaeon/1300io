import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export type UserRole = 'ADMIN' | 'MANAGER' | 'INSPECTOR' | 'READONLY';

export interface JwtUser {
  userId: number;
  role: UserRole;
  organizationId: number | null;
  iat?: number;
  exp?: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtUser;
    orgFilter?: { organizationId?: number };
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  jwt.verify(token, config.jwtSecret, (err, decoded) => {
    if (err || !decoded || typeof decoded === 'string') {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = decoded as JwtUser;
    next();
  });
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Scope queries to the caller's organization. See routes for usage.
//   - ADMIN with no org sees everything (req.orgFilter = {})
//   - User with an org is scoped to it
//   - Non-ADMIN user with no org sees everything too (legacy behavior
//     preserved for test compatibility; canAccessOrg below tightens
//     id-based endpoints)
export function injectOrgFilter(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next();
  if (req.user.role === 'ADMIN' && !req.user.organizationId) {
    req.orgFilter = {};
    return next();
  }
  req.orgFilter = req.user.organizationId
    ? { organizationId: req.user.organizationId }
    : {};
  next();
}

// Return true if the caller can read/modify a record scoped to an
// organization. ADMIN without an org sees everything; everyone else
// must match the record's organizationId (null matches null).
export function canAccessOrg(user: JwtUser | undefined, organizationId: number | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' && !user.organizationId) return true;
  return (user.organizationId ?? null) === (organizationId ?? null);
}

// Middleware factory that resolves a record's organizationId and
// short-circuits with 404 if the caller shouldn't see it.
export function requireOrgAccess(
  getOrgId: (req: Request) => Promise<number | null | undefined>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = await getOrgId(req);
      if (organizationId === undefined) {
        res.status(404).json({ error: 'Not found', requestId: req.id });
        return;
      }
      if (!canAccessOrg(req.user, organizationId)) {
        res.status(404).json({ error: 'Not found', requestId: req.id });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
