// globals: true in vitest config provides describe, it, expect

describe('Config', () => {
  it('should load config from environment variables', () => {
    const { config } = require('../config');

    expect(config.jwtSecret).toBeDefined();
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(16);
    expect(config.databaseUrl).toBeDefined();
  });

  it('should detect non-production environment', () => {
    const { isProduction } = require('../config');
    expect(isProduction).toBe(false);
  });
});
