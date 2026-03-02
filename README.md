# 1300.io

Open-source SaaS platform for Austrian property safety inspections following ONORM B 1300. Designed for property managers (Hausverwaltungen) to perform legally compliant safety checks efficiently, paperlessly, and with full audit traceability.

1300.io provides a mobile-first inspection workflow: walk through a building with your phone, answer checklist items derived from ONORM B 1300, photograph defects on the spot, and generate a professional PDF report immediately upon completion.

## Key Capabilities

- Mobile-first interface designed for one-handed operation during on-site inspections
- Integrated camera capture for documenting defects directly within the inspection flow
- Instant PDF report generation with embedded photos, compliant with Austrian legal standards
- Complete audit trail of all inspections for liability protection and regulatory compliance
- Pre-configured checklists covering ONORM B 1300 categories (roof, facade, staircase, technical systems, exterior)
- Role-based access control (Admin, Manager, Inspector, Read-only)

## Architecture

```
┌─────────────┐       ┌─────────────┐       ┌──────────────┐
│   Client     │       │   Server     │       │   Database    │
│              │       │              │       │               │
│  React 19    │◄─────►│  Express 5   │◄─────►│  SQLite (dev) │
│  Vite        │  API  │  Prisma ORM  │       │  PostgreSQL   │
│  Tailwind    │       │  JWT Auth    │       │  (production) │
└─────────────┘       └─────────────┘       └──────────────┘
      :5173                 :3000
```

The application is a monorepo with two packages:

- **client/** -- React single-page application with Tailwind CSS, served by Vite in development
- **server/** -- Express REST API with Prisma ORM, JWT authentication, and PDF generation via PDFKit

## Requirements

- Docker and Docker Compose (recommended)
- Node.js 22+ (for local development without Docker)
- npm 10+
- Linux, macOS, or Windows (WSL recommended on Windows)

## Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/Artaeon/1300io.git
cd 1300io

# Configure environment
cp .env.example .env
# Edit .env and set a strong JWT_SECRET (required)

# Start with Docker
docker-compose up -d --build

# Seed the database (first run only)
docker-compose exec server npx prisma db push
docker-compose exec server node prisma/seed.js
docker-compose exec server node seed_user.js

# Access the application
# Frontend: http://localhost:5173
# API:      http://localhost:3000
```

The seed user script reads credentials from environment variables. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` in your `.env` file before running the seed command. See the Configuration section below.

## Production Deployment

```bash
# Use the production compose file
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec server npx prisma db push

# Seed initial data (first deployment only)
docker-compose -f docker-compose.prod.yml exec server node prisma/seed.js
docker-compose -f docker-compose.prod.yml exec server node seed_user.js
```

For production, ensure:
- `JWT_SECRET` is a cryptographically random string (generate with `openssl rand -base64 32`)
- `NODE_ENV` is set to `production`
- `FRONTEND_URL` is set to your actual frontend domain (for CORS)
- `DATABASE_URL` points to a PostgreSQL instance (not SQLite)
- HTTPS is terminated at your reverse proxy (nginx, Caddy, etc.)

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | -- | Secret key for signing JWT tokens. Must be set; server will not start without it. |
| `DATABASE_URL` | Yes | `file:./dev.db` | Database connection string. SQLite for dev, PostgreSQL for production. |
| `PORT` | No | `3000` | Express server listen port. |
| `NODE_ENV` | No | `development` | Set to `production` to enable secure defaults. |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin. Set to your frontend domain in production. |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded inspection photos. |
| `LOG_LEVEL` | No | `info` | Logging verbosity: `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `ADMIN_EMAIL` | No | -- | Email for the seed admin user (development bootstrap only). |
| `ADMIN_PASSWORD` | No | -- | Password for the seed admin user (development bootstrap only). |
| `ADMIN_NAME` | No | `Admin` | Display name for the seed admin user. |

Security notes:
- Never commit `.env` files to version control.
- `JWT_SECRET` should be at least 32 characters of random data.
- In production, restrict `FRONTEND_URL` to your exact domain (no wildcards).
- Rotate `JWT_SECRET` periodically; all active sessions will be invalidated on rotation.

## Authentication and Authorization

The API uses JWT bearer tokens for authentication. Tokens are issued on login and expire after 1 hour.

**Roles:**

| Role | Permissions |
|------|-------------|
| `ADMIN` | Full access. Manage users, properties, and all inspections. |
| `MANAGER` | Create and manage properties. View all inspections. |
| `INSPECTOR` | Create and complete inspections. Upload photos. |
| `READONLY` | View properties and inspection reports only. |

The seed user script creates an initial admin account. Additional users can be registered via the API (admin-only in production).

## Data and Compliance

- **Audit trail**: All mutations (create, update, delete) are logged with actor, timestamp, IP address, and previous state.
- **Data retention**: Inspection records are retained indefinitely by default. Configure retention policies at the application level as needed.
- **DSGVO/GDPR**: The application stores personal data (inspector names, email addresses). A privacy policy page is included at `/datenschutz`. Data export and deletion requests should be handled through the admin interface.
- **Legal notice**: An impressum page is included at `/impressum` as required by Austrian law.
- **Inspection protocols**: PDF reports are generated on-demand and not stored server-side. Re-generation from the same inspection data produces identical reports.

## Development

```bash
# Start backend (from project root)
cd server && npm install && npm run dev

# Start frontend (separate terminal)
cd client && npm install && npm run dev
```

The Vite dev server proxies `/api` and `/uploads` requests to the backend at `http://server:3000` (Docker) or `http://localhost:3000` (local).

## Testing

```bash
# Run backend tests
cd server && npm test

# Run frontend tests
cd client && npm test

# Run all tests from project root
npm test
```

## Screenshots

| Login | Dashboard |
|-------|-----------|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Inspection Wizard | PDF Report |
|-------------------|------------|
| ![Inspection Wizard](docs/screenshots/inspection-wizard.png) | ![PDF Report](docs/screenshots/pdf-report.png) |

### How It Works

1. **Login** -- Authenticate with your credentials. Role-based access controls what you can do.
2. **Dashboard** -- View all managed properties, their last inspection dates, and recent inspection history. Start new inspections or download existing PDF reports.
3. **Inspection Wizard** -- Walk through the building with the mobile-optimized checklist. Each ONORM B 1300 category (roof, facade, staircase, technical systems, exterior) presents its checklist items. Mark each as OK, Mangel (defect), or N/A. Document defects with photos and comments.
4. **PDF Report** -- Upon completion, generate a professional PDF report with property details, summary statistics, all checklist results grouped by category, and a dedicated defect report section with embedded photos and signature fields.

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, branching model, and commit conventions.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for the full text.

Copyright (c) 2026 Stoicera GesbR
