import helmet from 'helmet';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isProduction } from '../config';

// In production, redirect any plain-HTTP request to HTTPS based on
// X-Forwarded-Proto (set by the reverse proxy). If the header says
// 'https' we trust it; otherwise 301 to the same URL on https://.
// Requires app.set('trust proxy', ...) so Express reads the header.
export function enforceHttps(req: Request, res: Response, next: NextFunction): void {
  if (!isProduction) return next();
  if (req.secure) return next();
  const forwarded = req.get('x-forwarded-proto');
  if (forwarded && forwarded.split(',')[0]?.trim() === 'https') return next();
  // Only redirect GET/HEAD; for other verbs, reject to avoid silently
  // losing request bodies on redirect.
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    return;
  }
  res.status(403).json({ error: 'HTTPS required' });
}

// Helmet with an explicit Content Security Policy. The frontend is
// served from a separate origin (nginx container), so the API itself
// is mostly JSON — keep directives tight.
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
  });
}
