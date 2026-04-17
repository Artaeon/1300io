import { describe, it, expect } from 'vitest';
import { config, isProduction } from '../config';

describe('Config', () => {
  it('loads config from environment variables', () => {
    expect(config.jwtSecret).toBeDefined();
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(16);
    expect(config.databaseUrl).toBeDefined();
  });

  it('detects non-production environment in tests', () => {
    expect(isProduction).toBe(false);
  });
});
