# MathCode Learning Platform

An integrated K-12 math + computer science learning platform built by **TAS&BA LLC** (Katy, Texas).

The platform delivers the **MathCode methodology** through 12 interactive, browser-based projects organized into three tiers (K-3, 4-7, 8-12), with student accounts, progress tracking, and a teacher dashboard.

---

## What's inside

- **Express + SQLite full-stack web app** (no cloud dependencies — runs anywhere Node runs)
- **Student accounts** with secure password hashing (bcrypt) and session cookies
- **12 integrated interactive projects** covering math from counting through calculus
- **Per-student progress tracking** (in_progress / completed / score)
- **Teacher dashboard** showing cohort progress, completion rates, average scores
- **Activity log** capturing every login, project open, and completion event

## Quick start

Requires Node.js 18 or later.

```bash
# 1. Install dependencies
npm install

# 2. Initialize the database (creates db/mathcode.db, seeds 12 projects + 2 demo users)
npm run init-db

# 3. Start the server
npm start

# 4. Open in browser
#    http://localhost:3000
```

### Demo accounts (created by `init-db`)

| Role    | Email                      | Password    |
|---------|----------------------------|-------------|
| Student | student@mathcode.local     | student123  |
| Teacher | teacher@mathcode.local     | teacher123  |

You can also sign up for a fresh student account at `/register.html`.

---

## Architecture

```
mathcode-platform/
├── package.json              Node dependencies + npm scripts
├── server.js                 Express server, REST API, learn-shell route
├── db/
│   ├── init.js               Schema + seed (projects, demo users)
│   └── mathcode.db           SQLite database (created on first run)
├── public/
│   ├── index.html            Marketing homepage
│   ├── login.html            Sign-in
│   ├── register.html         New-student account creation
│   ├── dashboard.html        Student dashboard (stats, recent, continue)
│   ├── tier.html             Tier browser (?tier=1|2|3)
│   ├── teacher.html          Teacher cohort view + per-student detail
│   ├── about.html            Methodology / about page
│   ├── css/styles.css        Dark, modern design system
│   ├── js/app.js             Shared client helpers (api, auth, top bar)
│   └── projects/             The 12 self-contained interactive HTML projects
└── README.md                 This file
```

### Database schema

- **users** — accounts (student / teacher / admin), bcrypt password, grade level
- **projects** — the 12 seeded projects with metadata (tier, ordinal, standards, etc.)
- **progress** — per-student per-project status & score
- **sessions_log** — append-only event log (login, project_opened, project_completed)

### REST API

| Method | Path                          | Auth         | Purpose                             |
|--------|-------------------------------|--------------|-------------------------------------|
| POST   | /api/register                 | —            | Create student account              |
| POST   | /api/login                    | —            | Sign in                             |
| POST   | /api/logout                   | —            | Sign out                            |
| GET    | /api/me                       | session      | Current user info                   |
| GET    | /api/projects?tier=N          | session      | List projects (optionally by tier)  |
| GET    | /api/projects/:id             | session      | One project + my progress           |
| POST   | /api/progress                 | session      | Mark in_progress / completed (+score) |
| GET    | /api/dashboard                | session      | Student dashboard aggregates        |
| GET    | /api/teacher/students         | teacher/admin| Cohort summary                      |
| GET    | /api/teacher/student/:id      | teacher/admin| Detailed student progress + log     |
| GET    | /learn/:id                    | session      | Render project in learn-shell frame |
| GET    | /api/health                   | —            | Health check                        |

---

## Deployment

The app is a single Node process plus a SQLite file. Recommended deployment paths:

### A. Local / classroom (simplest)
Run `npm start` on a teacher's laptop or a school PC. Open `http://localhost:3000`. Students on the same network can reach it via the host's IP.

### B. Free cloud hosting
Deploys cleanly on:
- **Railway** — connects to GitHub, sets `PORT` automatically, persistent disk for SQLite
- **Fly.io** — `fly launch` then attach a 1GB volume mounted at `db/`
- **Render** — Node web service with a persistent disk for the `db/` folder

For all three, set the env var `SESSION_SECRET` to a long random string in production.

### C. Custom domain (mathcode.tasba.com)
Point a CNAME at the host (Railway/Fly/Render). Add HTTPS via the host's built-in cert manager. The app trusts standard `X-Forwarded-Proto`/`X-Forwarded-For` headers for free under those providers.

---

## Notes for EB2 NIW exhibit

This codebase is intended to serve as **Exhibit M** (or as designated in the petition's Evidence Index) demonstrating that the MathCode methodology is implemented as a working, deployable platform — not merely a documented concept. Specifically, the platform demonstrates:

1. **Dissemination infrastructure.** A real, multi-tenant student platform (not a slide deck) that any school can adopt without licensing or installation costs.
2. **Pedagogical scope.** All 12 flagship projects are integrated end-to-end, with the methodology's CRA progression and standards alignments visible in the curriculum browser.
3. **Outcome tracking.** Per-student progress, completion status, and self-assessed scores are persisted in a normalized schema — providing the data infrastructure for the Student Outcome Tracking Plan referenced in the petition.
4. **Teacher tooling.** A working teacher dashboard supports the petition's claim that the methodology is institutionally adoptable, not just self-paced.

For the exhibit, screenshots of the homepage, dashboard, a Tier 3 project in-session, and the teacher cohort view are recommended, plus a printout of this README and a link to the deployed instance.

---

© 2026 TAS&BA LLC · Katy, Texas. All rights reserved.
