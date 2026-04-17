// Populate test-environment defaults before any module loads.
// Values are set only if the caller hasn't already provided one,
// so CI (which exports DATABASE_URL = postgres://…) is not clobbered.
function setDefault(key: string, value: string): void {
  if (!process.env[key]) process.env[key] = value;
}

setDefault('NODE_ENV', 'test');
setDefault('JWT_SECRET', 'test-secret-key-at-least-16-characters-long');
setDefault('PORT', '0');
setDefault('FRONTEND_URL', 'http://localhost:5173');
setDefault('UPLOAD_DIR', './test-uploads');

// DATABASE_URL intentionally has no fallback: tests need a real
// running database (postgres in CI, docker-compose locally). Failing
// fast on a missing DATABASE_URL is better than silently hitting an
// unexpected database.
