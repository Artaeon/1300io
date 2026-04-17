const jwt = require('jsonwebtoken');
const { config } = require('../config');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Scope queries to the caller's organization.
//   - ADMIN with no org → sees everything (req.orgFilter = {})
//   - User with an org → scoped to that org
//   - Non-ADMIN user with no org → also scoped ({}), which is the
//     behavior today. See audit follow-up for tightening this path.
function injectOrgFilter(req, res, next) {
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
// must match the record's organizationId (null matches null, so
// users without an org can still access legacy unscoped records).
function canAccessOrg(user, organizationId) {
  if (!user) return false;
  if (user.role === 'ADMIN' && !user.organizationId) return true;
  return (user.organizationId ?? null) === (organizationId ?? null);
}

// Short-circuit middleware producing 404 (not 403) for records
// outside the caller's org. 404 avoids leaking existence of records
// the caller shouldn't know about.
function requireOrgAccess(getOrgId) {
  return async (req, res, next) => {
    try {
      const organizationId = await getOrgId(req);
      if (organizationId === undefined) {
        return res.status(404).json({ error: 'Not found', requestId: req.id });
      }
      if (!canAccessOrg(req.user, organizationId)) {
        return res.status(404).json({ error: 'Not found', requestId: req.id });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  injectOrgFilter,
  canAccessOrg,
  requireOrgAccess,
};
