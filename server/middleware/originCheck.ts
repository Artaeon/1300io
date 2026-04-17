import type { Request, Response, NextFunction } from 'express';
import { config, isProduction } from '../config';

// Defense-in-depth origin check on state-changing verbs. See the JS
// version for the full rationale: bearer JWT auth means classical
// CSRF doesn't apply today, but this keeps the invariant safe if
// token storage ever moves to cookies.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (!isProduction) return next();
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const allowed = config.frontendUrl;
  if (!allowed) return next();

  const allowedOrigin = new URL(allowed).origin;

  if (origin) {
    if (origin === allowedOrigin) return next();
    res.status(403).json({ error: 'Cross-origin request blocked', requestId: req.id });
    return;
  }

  if (referer) {
    try {
      if (new URL(referer).origin === allowedOrigin) return next();
    } catch {
      /* invalid referer — fall through to reject */
    }
    res.status(403).json({ error: 'Cross-origin request blocked', requestId: req.id });
    return;
  }

  // No Origin and no Referer → likely a non-browser client. JWT still
  // guards the endpoint, so allow through.
  next();
}
