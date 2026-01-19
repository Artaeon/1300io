# 1300.io 🏢✅

**The Open Source Standard for Austrian Property Safety Inspections (ÖNORM B 1300).**

1300.io is a mobile-first SaaS solution designed to help property managers ("Hausverwaltungen") perform legal safety checks efficiently, paperlessly, and securely.

---

## 🚀 Features

- **📱 Mobile First:** Designed for one-handed operation during inspections.
- **📸 Integrated Camera:** Capture defects directly within the app.
- **📄 Instant Reporting:** Generates legally compliant PDF reports with one click.
- **🛡️ Audit Trail:** Complete history of all inspections for liability protection.
- **🇦🇹 Austrian Standard:** Pre-configured checklists for ÖNORM B 1300 (Roof, Facade, Staircase, etc.).

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Node.js + Express |
| **Database** | SQLite + Prisma ORM |
| **Infrastructure** | Docker Compose |

---

## 📦 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Artaeon/1300io.git
cd 1300io

# 2. Configure Environment
cp .env.example .env

# 3. Start with Docker
docker-compose up -d --build

# 4. Access the App
# Frontend: http://localhost:5173
# Admin Login: admin@1300.io / admin123
```

---

## 📱 Screenshots

| Dashboard | Inspection Wizard | PDF Report |
|-----------|-------------------|------------|
| Status badges & history | Mobile-optimized checklist | Professional layout |

---

## 🔧 Development

```bash
# Start backend
cd server && npm run dev

# Start frontend (separate terminal)
cd client && npm run dev
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

**Built with ❤️ in Linz, Austria.**
