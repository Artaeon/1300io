const { config, isProduction } = require('../config');

// Defense-in-depth origin check on state-changing verbs.
//
// The app uses Authorization: Bearer <JWT> for auth — browsers don't
// auto-send that header cross-origin, so classical CSRF (cookie-auth +
// form submit) doesn't apply here. But if a future change ever moves
// tokens to cookies, the most dangerous mistake would be to forget
// this check. Doing it now makes that class of mistake safe by default.
//
// In production, reject state-changing requests whose Origin (or
// Referer, as fallback) doesn't match the configured FRONTEND_URL.
// Non-browser clients (curl, server-to-server) typically omit Origin,
// so we only reject when Origin is present and wrong.
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originCheck(req, res, next) {
  if (!isProduction) return next();
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  const allowed = config.frontendUrl;
  if (!allowed) return next();

  const allowedOrigin = new URL(allowed).origin;

  if (origin) {
    if (origin === allowedOrigin) return next();
    return res.status(403).json({ error: 'Cross-origin request blocked', requestId: req.id });
  }

  if (referer) {
    try {
      if (new URL(referer).origin === allowedOrigin) return next();
    } catch {
      // invalid referer — fall through to reject
    }
    return res.status(403).json({ error: 'Cross-origin request blocked', requestId: req.id });
  }

  // No Origin and no Referer → likely a non-browser client (curl, mobile).
  // Auth still requires a valid JWT, so allow through.
  return next();
}

module.exports = { originCheck };
