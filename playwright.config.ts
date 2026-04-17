import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config.
 *
 * Expects the app to be running at:
 *   server:  http://localhost:3100
 *   client:  http://localhost:5173  (vite dev proxies /api → :3100)
 *
 * Use scripts/local-e2e.sh to start both. The Vite dev proxy + Playwright
 * browser-level network stack avoids any server-side port clashes with
 * other projects on your machine.
 */

const PORT = process.env.E2E_CLIENT_PORT ?? '5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // tests share a DB; sequential avoids races
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
