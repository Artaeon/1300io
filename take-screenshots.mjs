import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';
const OUT = 'docs/screenshots';

const MOBILE = { width: 393, height: 852 };
const DESKTOP = { width: 1280, height: 800 };

// Generate a fresh JWT + get refresh token directly from server
function getAuthData() {
    const result = execSync(
        `node -e "
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
    const u = await p.user.findFirst({ where: { role: 'ADMIN' } });
    const token = jwt.sign({ userId: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const rt = await p.refreshToken.findFirst({ where: { userId: u.id } });
    console.log(JSON.stringify({ token, refreshToken: rt?.token || '', user: { id: u.id, name: u.name, email: u.email, role: u.role } }));
    await p.\\$disconnect();
})();
"`,
        { cwd: 'server', encoding: 'utf-8' }
    ).trim().split('\n').pop();
    return JSON.parse(result);
}

async function injectAuth(page, auth, theme) {
    await page.addInitScript(({ token, refreshToken, user, theme }) => {
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        if (theme === 'dark') {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    }, { ...auth, theme });
}

async function run() {
    await mkdir(OUT, { recursive: true });

    const auth = getAuthData();
    console.log(`Authenticated as ${auth.user.name} (${auth.user.role})`);

    const browser = await chromium.launch({
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-gpu'],
    });

    // ── 1. Login (light) ─────────────────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/login`);
        await page.waitForSelector('form');
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/login.png` });
        console.log('✓ login.png');
        await ctx.close();
    }

    // ── 2. Dashboard (light) ─────────────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'light');
        await page.goto(`${BASE}/`);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });
        console.log('✓ dashboard.png');
        await ctx.close();
    }

    // ── 3. Property detail (light) ───────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'light');
        await page.goto(`${BASE}/properties/2`);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/property-detail.png`, fullPage: true });
        console.log('✓ property-detail.png');
        await ctx.close();
    }

    // ── 4. Inspection wizard (light) ─────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'light');
        await page.goto(`${BASE}/inspection/new/1`);
        await page.waitForTimeout(1500);
        // Dismiss resume dialog if present
        const newBtn = page.locator('button:has-text("Neue Prüfung")');
        if (await newBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await newBtn.click();
            await page.waitForTimeout(800);
        }
        await page.screenshot({ path: `${OUT}/inspection-wizard.png`, fullPage: true });
        console.log('✓ inspection-wizard.png');
        await ctx.close();
    }

    // ── 5. Inspection finish / PDF (light) ───────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'light' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'light');

        // Intercept the complete API to return success for already-completed inspection
        await page.route('**/api/inspections/2/complete', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 2, status: 'COMPLETED', property_id: 2,
                    inspector_name: 'Admin', date: '2026-03-02T11:15:32.282Z',
                    ended_at: '2026-03-02T11:16:37.316Z',
                    property: { address: 'Mozartgasse 5, 5020 Salzburg', owner_name: 'Privatstiftung Müller' }
                })
            });
        });

        await page.goto(`${BASE}/inspection/finish/2`);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${OUT}/pdf-report.png` });
        console.log('✓ pdf-report.png');
        await ctx.close();
    }

    // ── 6. Admin panel (light, desktop) ──────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: DESKTOP, colorScheme: 'light' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'light');
        await page.goto(`${BASE}/admin/users`);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${OUT}/admin-panel.png` });
        console.log('✓ admin-panel.png');
        await ctx.close();
    }

    // ── 7. Login (dark) ──────────────────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'dark' });
        const page = await ctx.newPage();
        await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); });
        await page.goto(`${BASE}/login`);
        await page.waitForSelector('form');
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/login-dark.png` });
        console.log('✓ login-dark.png');
        await ctx.close();
    }

    // ── 8. Dashboard (dark) ──────────────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'dark' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'dark');
        await page.goto(`${BASE}/`);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/dashboard-dark.png`, fullPage: true });
        console.log('✓ dashboard-dark.png');
        await ctx.close();
    }

    // ── 9. Inspection wizard (dark) ──────────────────────────────────
    {
        const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: 'dark' });
        const page = await ctx.newPage();
        await injectAuth(page, auth, 'dark');
        await page.goto(`${BASE}/inspection/new/1`);
        await page.waitForTimeout(1500);
        const newBtn = page.locator('button:has-text("Neue Prüfung")');
        if (await newBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await newBtn.click();
            await page.waitForTimeout(800);
        }
        await page.screenshot({ path: `${OUT}/inspection-wizard-dark.png`, fullPage: true });
        console.log('✓ inspection-wizard-dark.png');
        await ctx.close();
    }

    await browser.close();
    console.log('\nAll screenshots saved to docs/screenshots/');
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
