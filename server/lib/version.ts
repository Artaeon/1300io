import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve the current release's version + git SHA at startup.
 *
 * At release time the build pipeline is expected to write
 * `VERSION` and `GIT_SHA` env vars; if absent we fall back to
 * reading package.json (version) and a VERSION file next to the
 * compiled output (sha). Both are captured ONCE at module load so
 * subsequent /health calls don't re-read from disk.
 */

const startedAt = new Date().toISOString();

function readPackageVersion(): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'package.json'),
    path.resolve(__dirname, '..', 'package.json'),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const pkg = JSON.parse(raw) as { version?: unknown };
      if (typeof pkg.version === 'string') return pkg.version;
    } catch {
      /* continue */
    }
  }
  return null;
}

const version =
  process.env.APP_VERSION ||
  process.env.VERSION ||
  readPackageVersion() ||
  'unknown';

const sha = (process.env.GIT_SHA || process.env.SOURCE_COMMIT || 'unknown').slice(0, 12);

export const release = {
  version,
  sha,
  startedAt,
  nodeEnv: process.env.NODE_ENV ?? 'unknown',
};
