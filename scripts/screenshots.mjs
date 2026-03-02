import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = join(__dirname, '..', 'docs', 'screenshots');
const CLIENT = 'http://localhost:5173';
const API = 'http://localhost:3000';

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  // 1. Login page screenshot
  console.log('Capturing login page...');
  await page.goto(`${CLIENT}/login`, { waitUntil: 'networkidle0', timeout: 10000 });
  await page.screenshot({ path: join(screenshotDir, 'login.png'), fullPage: false });
  console.log('  Saved login.png');

  // 2. Get auth token via direct API call
  console.log('Getting auth token...');
  const loginResponse = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.local', password: 'demo-password-123' }),
  });
  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('  Token received');

  // Set token in localStorage so the app recognizes us as logged in
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);

  // 3. Dashboard screenshot
  console.log('Capturing dashboard...');
  await page.goto(`${CLIENT}/`, { waitUntil: 'networkidle0', timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(screenshotDir, 'dashboard.png'), fullPage: true });
  console.log('  Saved dashboard.png');

  // 4. Inspection wizard
  console.log('Capturing inspection wizard...');
  // Navigate to inspection for property 1
  await page.goto(`${CLIENT}/inspection/new/1`, { waitUntil: 'networkidle0', timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(screenshotDir, 'inspection-wizard.png'), fullPage: false });
  console.log('  Saved inspection-wizard.png');

  // 5. Inspection finish page
  console.log('Capturing inspection finish...');
  await page.goto(`${CLIENT}/inspection/finish/1`, { waitUntil: 'networkidle0', timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: join(screenshotDir, 'inspection-finish.png'), fullPage: false });
  console.log('  Saved inspection-finish.png');

  // 6. PDF report preview card
  console.log('Generating PDF report preview...');
  await page.setContent(`
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px; margin: 0; }
          .card { background: white; border-radius: 12px; overflow: hidden; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: #1e3a5f; color: white; padding: 24px 30px; }
          .header h2 { margin: 0; font-size: 20px; }
          .header p { color: #a0b8d0; margin: 5px 0 0; font-size: 13px; }
          .body { padding: 24px 30px; }
          .info { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
          .label { color: #888; font-size: 13px; }
          .value { font-weight: 600; font-size: 13px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
          .badge-ok { background: #d4edda; color: #155724; }
          .stats { display: flex; gap: 10px; margin-top: 20px; }
          .stat { flex: 1; text-align: center; padding: 16px 8px; border-radius: 10px; }
          .stat-ok { background: #d4edda; color: #155724; }
          .stat-defect { background: #f8d7da; color: #721c24; }
          .stat-na { background: #e2e3e5; color: #383d41; }
          .stat-number { font-size: 32px; font-weight: bold; }
          .stat-label { font-size: 11px; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          .footer { padding: 16px 30px; background: #fafafa; text-align: center; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>SICHERHEITSBEGEHUNG</h2>
            <p>nach ONORM B 1300 — Pruefbericht #1</p>
          </div>
          <div class="body">
            <div class="info"><span class="label">Adresse</span><span class="value">Musterstrasse 1, 1010 Wien</span></div>
            <div class="info"><span class="label">Eigentuemer</span><span class="value">ImmoTrust GmbH</span></div>
            <div class="info"><span class="label">Pruefer</span><span class="value">Max Mustermann</span></div>
            <div class="info"><span class="label">Datum</span><span class="value">28.02.2026</span></div>
            <div class="info"><span class="label">Status</span><span class="badge badge-ok">Abgeschlossen</span></div>
            <div class="stats">
              <div class="stat stat-ok"><div class="stat-number">10</div><div class="stat-label">OK</div></div>
              <div class="stat stat-defect"><div class="stat-number">3</div><div class="stat-label">Maengel</div></div>
              <div class="stat stat-na"><div class="stat-number">2</div><div class="stat-label">N/A</div></div>
            </div>
          </div>
          <div class="footer">Generiert am 02.03.2026 | 1300.io v1.0</div>
        </div>
      </body>
    </html>
  `, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: join(screenshotDir, 'pdf-report.png'), fullPage: false });
  console.log('  Saved pdf-report.png');

  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
}

main().catch(err => {
  console.error('Screenshot error:', err.message);
  process.exit(1);
});
