```markdown
# FlyRank Unified Platform: Core Task API & AI Decision Flow

A full-stack platform integrating an Express.js REST API with SQLite persistence, Supabase authentication, LLM-driven triage, a polite web scraper with automated Playwright PDF reporting, and an interactive Next.js React Flow decision canvas orchestrated by Inngest.

---

## Architecture Overview

```text
Browser / Client
  │
  ├──► Next.js Control Room (:3002)
  │      ├── Tasks & Auth Management
  │      ├── Polite Scraper & Data Viewer
  │      ├── AI Support Triage Console
  │      ├── React Flow Decision Canvas
  │      └── Inngest Event Stream ────┐
  │                                   │
  ├──► Express Core API (:3000)       │
  │      ├── Supabase JWT Auth        │
  │      ├── SQLite Persistent CRUD   │
  │      ├── LLM Support Triage       │
  │      ├── Scraper Trigger Engine   │
  │      └── Playwright PDF Generator │
  │                                   ▼
  └──► Inngest Dev Server (:8288) ◄───┘
         └── Executes background node evaluation & workflows

```

### Container Network & Storage

```text
Host Machine
  │
  ▼ docker compose up -d --build
┌───────────────────────────────────────────────────────────────┐
│ Docker Compose Network                                        │
│                                                               │
│  ┌────────────────────────┐        ┌────────────────────────┐ │
│  │ frontend (:3002)       │        │ api (:3000)            │ │
│  │ - Next.js App Router   │◄──────►│ - Express REST API     │ │
│  │ - React Flow Canvas    │        │ - Playwright (Chromium)│ │
│  │ - Inngest Client SDK   │        │ - better-sqlite3       │ │
│  └───────────┬────────────┘        └───────────┬────────────┘ │
│              │                                 │              │
│              │                                 ▼              │
│              │                     ┌────────────────────────┐ │
│              │                     │ Volume: sqlite_data    │ │
│              │                     │ mounted at /app/data   │ │
│              │                     └────────────────────────┘ │
│              ▼                                                │
│  ┌────────────────────────┐                                   │
│  │ inngest (:8288)        │                                   │
│  │ - Local Event Queue    │                                   │
│  │ - Workflow Engine      │                                   │
│  └────────────────────────┘                                   │
└───────────────────────────────────────────────────────────────┘

```

### Service Map

| Service | Host Port | Container Port | Responsibility |
| --- | --- | --- | --- |
| **Core API** | `3000` | `3000` | Task CRUD, Supabase auth verification, AI triage, scraping, and PDF reporting |
| **Showcase Web App** | `3002` | `3002` | Next.js dashboard, visual workflow canvas, scraper monitor, and report viewer |
| **Inngest Server** | `8288` | `8288` | Background execution queue, step orchestration, and retry management |

---

## Core Capabilities

### 1. Persistent Task API & Authentication

* **Single-Command Stack**: Docker Compose orchestrates the API, Next.js web application, and Inngest background engine.
* **Persistent SQLite Storage**: SQLite database files persist across container restarts, stops, and rebuilds via named Docker volumes.
* **Supabase Authentication**: Secure token verification using bearer tokens delegated to Supabase Auth.
* **Parameterized SQL Queries**: All queries execute through prepared statements in `better-sqlite3` to prevent injection vulnerabilities.
* **Interactive API Documentation**: Built-in Swagger UI explorer available directly at `/docs`.

### 2. AI Support Triage (Assignment A17)

* **Prompt Engineering**: Versioned system prompt (`prompts/triage-v1.md`) categorizing tickets into `billing`, `bug`, `feature`, and `other`.
* **Validation & Self-Repair**: Strict Zod schema enforcement with an automated repair prompt loop on malformed outputs.
* **Quarantine Pipeline**: Unrecoverable responses are quarantined under `logs/quarantine.jsonl` with request and error context.
* **Operational Guardrails**: Configurable kill switch (`LLM_KILL_SWITCH=1`), deterministic stubs, and strict request timeouts.

### 3. Polite Scraper & PDF Reporting

* **Headless Scraping Pipeline**: Crawls structured datasets (Books, Quotes) with caching, rate limiting, and SQLite data synchronization.
* **Automated PDF Engine**: Uses Playwright to render multi-page operational reports featuring dynamic KPI cards, price distributions, and repeating table headers.
* **Same-Day Idempotency**: Repeated report requests return existing cached PDF artifacts unless explicitly bypassed with `force: true`.

### 4. Interactive AI Decision Flow

* **Visual Workflow Canvas**: React Flow canvas allowing users to create, connect, and configure decision nodes.
* **Background Execution**: Dispatches `workflow/execute-node` events to Inngest for asynchronous background evaluation.
* **Live Execution Polling**: The frontend monitors execution status, rendering state transitions (*Idle*, *Running*, *Success*, *Error*) and branching edges (`YES` / `NO`).
* **Workflow Portability**: Full canvas import and export via JSON alongside browser local storage persistence.

---

## AI Decision Flow Evidence

### Inngest Dashboard

The completed background runs and dynamic model results are shown in the Inngest dashboard:

### React Flow Canvas

The canvas screenshot shows successful node execution states, branching edges, and the sidebar execution logs:

---

## Environment Variables

Copy the template file to configure your local runtime:

```bash
cp .env.example .env

```

| Variable | Description | Default | Example |
| --- | --- | --- | --- |
| `PORT` | API port inside the container | `3000` | `3000` |
| `DB_PATH` | Path to persistent SQLite database | `/app/data/tasks.db` | `/app/data/tasks.db` |
| `SUPABASE_URL` | Supabase Project URL | — | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | Supabase anon public API key | — | `eyJhbGci...` |
| `LLM_BASE_URL` | OpenAI-compatible endpoint | `https://api.groq.com/openai/v1` | `https://api.groq.com/openai/v1` |
| `LLM_API_KEY` | Provider API key | — | `gsk_...` |
| `LLM_MODEL` | Model identifier | `openai/gpt-oss-120b` | `openai/gpt-oss-120b` |
| `LLM_ENABLED` | Enables live provider calls | `true` | `true` |
| `LLM_STUB` | Returns local mock classifications | `0` | `1` |
| `LLM_KILL_SWITCH` | Completely halts outgoing LLM calls | `0` | `1` |

---

## Quick Start

### 1. Build and Start the Stack

```bash
docker compose up -d --build

```

### 2. Verify Running Containers

```bash
docker compose ps

```

All three services (`flyrank-task-api-api-1`, `flyrank-task-api-frontend-1`, and `flyrank-task-api-inngest-1`) should report status `Up`.

### 3. Check System Status

```bash
curl http://localhost:3000/health

```

Expected output:

```json
{
  "status": "ok",
  "services": {
    "db": true,
    "llm": true,
    "auth": true
  }
}

```

---

## API Endpoints Reference

### Authentication & Public Routes

| Method | Endpoint | Auth | Description | Status Codes |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/signup` | None | Register a new user account | `201`, `400` |
| `POST` | `/auth/login` | None | Authenticate credentials and get access token | `200`, `400`, `401` |
| `POST` | `/auth/logout` | Bearer Token | Invalidate current session | `204`, `401` |
| `GET` | `/public/info` | None | Public health and info check | `200` |
| `GET` | `/protected/profile` | Bearer Token | Retrieve user profile metadata | `200`, `401` |
| `GET` | `/protected/dashboard` | Bearer Token | Access protected user dashboard metrics | `200`, `401` |
| `GET` | `/docs` | None | Interactive Swagger UI documentation | `200` |

### Task Operations

| Method | Endpoint | Description | Request Body | Status Codes |
| --- | --- | --- | --- | --- |
| `GET` | `/tasks` | List all tasks | — | `200` |
| `GET` | `/tasks/:id` | Get task by ID | — | `200`, `404` |
| `POST` | `/tasks` | Create a new task | `{"title": "Deploy API"}` | `201`, `400` |
| `PUT` | `/tasks/:id` | Update an existing task | `{"title": "Deploy API", "done": true}` | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Remove a task | — | `204`, `404` |

### AI Support Triage

| Method | Endpoint | Description | Request Body |
| --- | --- | --- | --- |
| `POST` | `/triage` | Classify inbound ticket | `{"text": "My invoice was charged twice this month and I need a refund."}` |

Example Response:

```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.96,
  "reason": "This is a billing dispute about a duplicate charge."
}

```

### Polite Scraper & PDF Reports

| Method | Endpoint | Description | Request Body | Status Codes |
| --- | --- | --- | --- | --- |
| `POST` | `/scraper` | Trigger scraper and sync to SQLite | `{"url": "http://books.toscrape.com"}` | `200`, `400` |
| `GET` | `/scraper/data` | Retrieve latest scraped JSON output | — | `200` |
| `GET` | `/reports` | List all historical reports | — | `200` |
| `POST` | `/reports` | Request PDF report generation | `{"type": "books", "force": false}` | `200`, `201`, `400` |
| `GET` | `/reports/:id` | Retrieve report metadata | — | `200`, `404` |
| `GET` | `/reports/:id/file` | Stream rendered PDF file | — | `200`, `404` |

---

## Verification & Testing Guide

### 1. SQLite Volume Persistence Proof

```bash
# 1. Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Docker volume persistence test"}'

# 2. Restart the API container
docker compose restart api

# 3. Verify the task remains present
curl http://localhost:3000/tasks

```

*SQLite task data stored by the API.*

---

### 2. Swagger UI & End-to-End Authentication

Interactive Swagger UI documentation is available at `http://localhost:3000/docs`.

*Swagger UI for the task API.*

```bash
# 1. Create a user
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"a-strong-password"}'

# 2. Log in and extract the access token
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"a-strong-password"}'

# 3. Access protected route with Bearer token
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# 4. Attempt access with invalid token (expect 401)
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer invalid-token"

```

Use the **Authorize** button in Swagger UI to test protected endpoints:

---

### 3. Scraper, Idempotency, and PDF Generation (PowerShell)

```powershell
# 1. Trigger scraper and populate SQLite
Invoke-RestMethod -Uri "http://localhost:3000/scraper" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"url":"[http://books.toscrape.com](http://books.toscrape.com)"}'

# 2. Stage 4 Checkpoint: Generate first report
$res1 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books"}'
$res1 | ConvertTo-Json

# 3. Stage 5 Checkpoint: Test idempotency (same day returns cached record)
$res2 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books"}'
Write-Host "Idempotency match:" ($res1.id -eq $res2.id)

# 4. Force regeneration (bypasses cache)
$res3 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books", "force": true}'
Write-Host "Force bypassed cache:" ($res3.id -ne $res1.id)

# 5. Download and view generated PDF artifact
Invoke-WebRequest -Uri "http://localhost:3000/reports/$($res1.id)/file" -OutFile "books-report.pdf"
Start-Process "books-report.pdf"

```

---

## Project Structure

```text
flyrank-task-api/
├── backend/
│   ├── src/
│   │   ├── config/              # SQLite connection and table definitions
│   │   ├── controllers/         # Route controllers (scraper, tasks, auth)
│   │   ├── middlewares/         # JWT verification, CORS, error handling
│   │   ├── routes/              # Express route modules
│   │   ├── services/            # Playwright PDF rendering, report DB queries, LLM triage
│   │   └── validators/          # Zod schema definitions
│   ├── reports/                 # Stored PDF artifacts
│   ├── Dockerfile               # Node.js 22 Alpine + Chromium configuration
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router (dashboard, scraper, triage)
│   │   ├── components/          # React Flow nodes, sidebar execution logs, KPI cards
│   │   ├── inngest/             # Workflow functions and event handlers
│   │   └── lib/                 # State management and API clients
│   ├── Dockerfile
│   └── package.json
├── prompts/                     # Versioned LLM prompt templates (triage-v1.md)
├── logs/                        # Quarantined payloads and execution traces
├── docker-compose.yml           # Unified multi-service orchestration
└── README.md

```

---

## Troubleshooting

### Port Conflicts

If port `3000`, `3002`, or `8288` is already in use:

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

```

Alternatively, rebind the host ports in `docker-compose.yml` (e.g., `"3001:3000"`).

### SQLite Permission or Directory Missing

If the container logs indicate `SQLITE_CANTOPEN`, verify that the volume mapping points to a dedicated directory:

```yaml
volumes:
  - sqlite_data:/app/data

```

### Native Dependency Compilation

The SQLite driver (`better-sqlite3`) builds native C++ binaries on installation. If switching Node versions or container bases, rebuild using:

```bash
docker compose build --no-cache api

```

---

## Author

**Toni Ihab Youssef**

FlyRank AI Internship · Backend & Fullstack Track

```

```