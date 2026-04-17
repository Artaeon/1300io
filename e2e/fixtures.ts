import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared Playwright fixtures.
 *
 * uniqueEmail: a random email per test so parallel / repeated runs
 *   don't collide on the User.email unique constraint
 * seedUser: creates a verified ADMIN user directly via the API +
 *   emailVerified flip (in real deployments this would use a seed
 *   script). For e2e coverage of the self-register path, tests go
 *   through /api/auth/register directly.
 */

export const test = base.extend<{
  uniqueEmail: string;
}>({
  uniqueEmail: async ({}, use) => {
    const id = Math.random().toString(36).slice(2, 10);
    await use(`e2e-${id}@test.local`);
  },
});

export { expect };

/**
 * Helper: log in through the UI. Used by tests that want a fresh
 * browser session vs. one already logged-in from setup.
 */
export async function loginUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(page).toHaveURL('/');
}
