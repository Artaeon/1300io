# End-to-end tests (Playwright)

These tests drive a real browser against a running server + client.

## Run locally

```bash
# Terminal 1: test DB + MailHog
./scripts/local-test-db.sh start
./scripts/local-mailhog.sh start      # opens SMTP 1026, UI 8026

# Terminal 2: server (port 3100)
cd server
eval $(../scripts/local-test-db.sh env)
export FRONTEND_URL=http://localhost:5173
export SMTP_HOST=localhost SMTP_PORT=1026 SMTP_SECURE=false
export PORT=3100
npx prisma migrate deploy
npm run dev

# Terminal 3: client (port 5173, proxies /api → :3100)
cd client
VITE_API_TARGET=http://localhost:3100 npm run dev

# Terminal 4: playwright
npx playwright install chromium   # first run only
npm run test:e2e
```

## What's tested

- **auth.spec.ts** — register, login, forgot-password confirmation,
  verify-email failure state, login entry points to self-service
- **inspection.spec.ts** — register → login → create property →
  verify the dashboard state that leads into an inspection

## Fixtures (`fixtures.ts`)

- `uniqueEmail` — random per-test email to avoid collisions
- `loginUI` — helper to log in through the UI

## Tips

- `npm run test:e2e:ui` launches Playwright's time-travel UI for
  debugging failures
- Traces + screenshots are captured on failure → `e2e-report/`
- Tests run serially (`workers: 1`) because they share the server's
  Postgres. A parallel run would race on fixture data.
