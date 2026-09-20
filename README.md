# Core Task API & AI Decision Flow

A full-stack platform integrating an Express.js REST API with SQLite persistence, Supabase authentication, LLM-driven triage, a polite web scraper with automated Playwright PDF reporting, and an interactive Next.js React Flow decision canvas orchestrated by Inngest.

---

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [Core Features](#core-features)
3. [Quick Start](#quick-start)
4. [Environment Variables](#environment-variables)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [AI Decision Flow](#ai-decision-flow)
7. [Background Job Engine (Assignment A7)](#background-job-engine-assignment-a7)
8. [Verification & Testing Guide](#verification--testing-guide)
9. [Docker Commands Reference](#docker-commands-reference)
10. [Project Structure](#project-structure)
11. [Troubleshooting](#troubleshooting)
12. [Technology Stack](#technology-stack)
13. [Stages & Assignments Completed](#stages--assignments-completed)
14. [Example Requests & Responses](#example-requests--responses)
15. [Contributing & License](#contributing)

---

## Platform Architecture

### High-Level System Design

```text
Browser / Client
  │
  ├──► Next.js Showcase & Canvas (:3002)
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

### Containerized Infrastructure

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
|---------|-----------|-----------------|-----------------|
| **Core API** | `3000` | `3000` | Task CRUD, Supabase auth verification, AI triage, scraping, and PDF reporting |
| **Showcase Web App** | `3002` | `3002` | Next.js dashboard, visual workflow canvas, scraper monitor, and report viewer |
| **Inngest Server** | `8288` | `8288` | Background execution queue, step orchestration, and retry management |

---

## Core Features

### 1. Persistent Task API & Authentication

* **Single-Command Multi-Container Stack**: Docker Compose builds and orchestrates the API, Next.js web application, and Inngest background engine simultaneously.
* **Persistent SQLite Storage**: SQLite database files persist across container restarts, stops, and rebuilds via named Docker volumes.
* **Supabase Authentication**: Secure token verification using bearer tokens delegated to Supabase Auth with password encryption and session management.
* **Parameterized SQL Queries**: All queries execute through prepared statements in `better-sqlite3` to prevent SQL injection vulnerabilities.
* **Interactive API Documentation**: Built-in Swagger UI explorer available directly at `/docs`.

### 2. AI Support Triage (Assignment A17)

* **Prompt Engineering**: Versioned system prompt (`prompts/triage-v1.md`) categorizing tickets into `billing`, `bug`, `feature`, and `other`.
* **Validation & Self-Repair**: Strict Zod schema enforcement with an automated repair prompt loop on malformed outputs.
* **Quarantine Pipeline**: Unrecoverable responses are quarantined under `logs/quarantine.jsonl` with request and error context.
* **Operational Guardrails**: Configurable kill switch (`LLM_KILL_SWITCH=1`), deterministic stubs, and strict request timeouts (30 seconds).
* **Eval Performance**: 8/8 correct classifications on the official eval set using `openai/gpt-oss-120b`.

### 3. Polite Scraper & PDF Reporting

* **Headless Scraping Pipeline**: Crawls structured datasets (Books, Quotes) with caching, rate limiting, and SQLite data synchronization.
* **Automated PDF Engine**: Uses Playwright to render multi-page operational reports featuring dynamic KPI cards, price distributions, and repeating table headers.
* **Same-Day Idempotency**: Repeated report requests return existing cached PDF artifacts unless explicitly bypassed with `force: true`.

### 4. Interactive AI Decision Flow

* **Visual Workflow Canvas**: React Flow canvas allowing users to create, connect, and configure decision nodes.
* **Background Execution**: Dispatches `workflow/execute-node` events to Inngest for asynchronous background evaluation.
* **Live Execution Polling**: The frontend monitors execution status, rendering state transitions (*Idle*, *Running*, *Success*, *Error*) and branching edges (`YES` / `NO`).
* **Workflow Portability**: Full canvas import and export via JSON alongside browser local storage persistence.
* **LLM Resilience**: Zod schema validation with one-shot repair on malformed output, explicit 30-second timeout, and deterministic fallback via `LLM_KILL_SWITCH`.

### 5. Background Job Engine (Assignment A7)

* **202 Accepted Asynchronous Pattern**: Long-running requests return immediately with an ID and pending status, offloading work to background workers.
* **Durable Step Execution**: Multi-step workflows that survive server restarts mid-run through Inngest's durable execution model.
* **Exponential Backoff Retries**: Transient failures automatically retry with increasing delays; deterministic errors are rejected upfront with `400 Bad Request`.
* **Automated Cron Scheduling**: Scheduled heartbeat tasks executing on the clock without incoming HTTP requests (e.g., `0 8 * * *` for daily 08:00 UTC).
* **Idempotency & Concurrency**: Safeguards against redundant executions and protects downstream services with concurrency caps (e.g., `limit: 2`).

---

## Quick Start

### Prerequisites

* **Docker Desktop** (v20.10+) – [Download here](https://www.docker.com/products/docker-desktop)
* **Git** – [Download here](https://git-scm.com/)
* **curl** or **Postman** – For testing endpoints (optional; Swagger UI is built-in)

### 1. Clone and Configure

```bash
git clone https://github.com/YOUR-USERNAME/flyrank-task-api.git
cd flyrank-task-api
cp .env.example .env
```

### 2. Start the Full Stack

```bash
docker compose up -d --build
```

**What happens:**
- Docker builds the Node.js application image
- Frontend, API, and Inngest containers start
- Named volume `sqlite_data` is created or mounted
- SQLite database is initialized at `/app/data/tasks.db`
- Three example tasks are seeded (only on first run)
- Services listen on their designated ports

### 3. Verify Running Containers

```bash
docker compose ps
```

All three services should report status `Up`:
- `flyrank-task-api-api-1`
- `flyrank-task-api-frontend-1`
- `flyrank-task-api-inngest-1`

### 4. Check System Status

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

### 5. Access the Platform

- **Dashboard & Canvas**: `http://localhost:3002`
- **API Documentation**: `http://localhost:3000/docs`
- **Inngest Monitor**: `http://localhost:8288`

---

## Environment Variables

Copy the template file to configure your local runtime:

```bash
cp .env.example .env
```

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
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

**Security Note:** The `.env` file contains sensitive configuration and is never committed to Git. Only `.env.example` is tracked so team members know which keys to set.

---

## API Endpoints Reference

### Authentication & Public Routes

| Method | Endpoint | Auth | Description | Status Codes |
|--------|----------|------|-------------|--------------|
| `POST` | `/auth/signup` | None | Register a new user account | `201`, `400` |
| `POST` | `/auth/login` | None | Authenticate credentials and get access token | `200`, `400`, `401` |
| `POST` | `/auth/logout` | Bearer Token | Invalidate current session | `204`, `401` |
| `GET` | `/public/info` | None | Public health and info check | `200` |
| `GET` | `/protected/profile` | Bearer Token | Retrieve user profile metadata | `200`, `401` |
| `GET` | `/protected/dashboard` | Bearer Token | Access protected user dashboard metrics | `200`, `401` |
| `GET` | `/docs` | None | Interactive Swagger UI documentation | `200` |
| `GET` | `/health` | None | System health check | `200` |

### Task Operations

| Method | Endpoint | Description | Request Body | Status Codes |
|--------|----------|-------------|--------------|--------------|
| `GET` | `/tasks` | List all tasks | — | `200` |
| `GET` | `/tasks/:id` | Get task by ID | — | `200`, `404` |
| `POST` | `/tasks` | Create a new task | `{"title": "Deploy API"}` | `201`, `400` |
| `PUT` | `/tasks/:id` | Update an existing task | `{"title": "Deploy API", "done": true}` | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Remove a task | — | `204`, `404` |

### AI Support Triage

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `POST` | `/triage` | Classify inbound support ticket | `{"text": "My invoice was charged twice this month and I need a refund."}` |

**Example Response:**

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
|--------|----------|-------------|--------------|--------------|
| `POST` | `/scraper` | Trigger scraper and sync to SQLite | `{"url": "http://books.toscrape.com"}` | `200`, `400` |
| `GET` | `/scraper/data` | Retrieve latest scraped JSON output | — | `200` |
| `GET` | `/reports` | List all historical reports | — | `200` |
| `POST` | `/reports` | Request PDF report generation | `{"type": "books", "force": false}` | `200`, `201`, `400` |
| `GET` | `/reports/:id` | Retrieve report metadata | — | `200`, `404` |
| `GET` | `/reports/:id/file` | Stream rendered PDF file | — | `200`, `404` |

### Workflow & Inngest

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| `POST` | `/api/workflow/run` | Queue a decision node for execution | `{"nodeId": "node-1", "nodeData": {...}}` |
| `GET` | `/api/workflow/status/:runId` | Poll execution result | — |
| `POST` | `/api/inngest` | Inngest event handler webhook | Inngest payload |

---

## AI Decision Flow

### Architecture

The React Flow canvas is the workflow editor and execution surface. Running a node sends `POST /api/workflow/run`, which creates an execution record and publishes a `workflow/execute-node` event to Inngest. The Inngest function runs the LLM decision, updates the execution store, and records either a `YES` or `NO` result. The browser polls `GET /api/workflow/status/:runId` and applies the result to the node and sidebar log in real time.

```text
React Flow canvas
       |
       v
Next.js /api/workflow/run --> Inngest event queue
            |
            v
          LLM decision function
            |
            v
React Flow polling <-- /api/workflow/status/:runId
```

### LLM Resilience & Validation

- **Zod Schema Enforcement**: Every model response is validated against `{ decision: "YES" | "NO", reason }`.
- **One-Shot Repair**: Invalid JSON or schema mismatches trigger exactly one repair request including the validation error message.
- **Strict Timeouts**: Model calls have an explicit 30-second timeout with retry only for transient provider failures (429, 5xx).
- **Kill Switch**: The `LLM_ENABLED=false` kill switch returns a deterministic fallback without calling any provider.
- **Cost & Metrics**: Structured logging includes token counts, duration, repair count, and execution traces.

### Visual Features

- **Node Execution States**: Idle, Running, Success, and Error with color-coded visual indicators.
- **Real-Time Logs**: Sidebar displays live execution log with node ID, status, LLM decision, and reasoning.
- **Branching Edges**: Animated edges labeled `YES` and `NO` connect nodes based on decision outcomes.
- **Workflow Persistence**: Full canvas import/export via JSON and browser local storage.
- **Inngest Dashboard**: View completed runs, retry history, and dynamic model results at `http://localhost:8288`.

### Setup & Evidence

From the repository root:

```bash
cd frontend
npm install
npm run dev            # Runs Next.js on port 3002

# In a separate terminal
npx inngest-cli dev -u http://localhost:3002/api/inngest  # Runs Inngest on port 8288
```

Configure provider credentials and runtime flags in `frontend/.env` (keep untracked).

#### Inngest Dashboard

The completed background runs and dynamic model results are shown in the Inngest dashboard:

![Completed Inngest runs](/dashboard.png)

*Inngest dashboard showing executed decision workflows, run history, and background job metrics.*

#### React Flow Canvas

The canvas screenshot shows successful node execution states, branching edges, and the sidebar execution logs:

![Workflow UI](/flow.png)

*Interactive React Flow canvas with real-time execution status, decision logs, and branching logic visualization.*

---

## Background Job Engine (Assignment A7)

An asynchronous background job processing engine built with Express.js and Inngest. Long-running operational tasks (such as report generation or AI batch jobs) are decoupled from HTTP request lifecycles using the **202 Accepted** pattern, non-blocking polling, exponential backoff retries, and automated cron heartbeats.

```text
HTTP Client / Frontend UI
       │
       ├──► POST /reports {"topic":"cats"}
       │      │
       │      ├─► Store initial record in-memory (status: "pending")
       │      ├─► Dispatch "report/requested" event to Inngest
       │      └─► Return HTTP 202 Accepted instantly (<150ms)
       │
       ├──► Background Worker (Inngest)
       │      │
       │      ├─► Step 1: Idempotency check & order preparation
       │      ├─► Step 2: Durable sleep (8s simulation)
       │      └─► Step 3: Compute report & transition state to "done"
       │
       └──► GET /reports/:id (Polling) ──► Returns "pending" -> "done"
```

### Inngest Functions & Endpoints

#### Background Functions (`backend/src/inngest/functions.js`)

| Function ID | Trigger Type | Event / Schedule | Configuration & Steps |
|---|---|---|---|
| `say-hello` | Event | `test/hello` | 5-second durable sleep (`wait-a-bit`), returns confirmation message |
| `make-report` | Event | `report/requested` | 3-step pipeline (`prepare-order`, `do-the-slow-work` [8s sleep], `build-report`), `retries: 2`, `concurrency: 2`, native `onFailure` hook |
| `heartbeat` | Cron | `* * * * *` | Runs every minute on the clock; aggregates and logs in-memory pending, done, and failed metrics |

#### API Endpoints (`backend/src/routes/reports.routes.js`)

| Method | Endpoint | Status Code | Description |
|---|---|---|---|
| `POST` | `/reports` | `202 Accepted` | Validates `topic`, creates an in-memory job record, dispatches `report/requested`, and returns `{ id, status: "pending" }` |
| `POST` | `/reports` | `400 Bad Request` | Rejects missing or blank `topic` payloads before emitting any queue events |
| `GET` | `/reports/:id` | `200 OK` | Returns report status (`pending`, `done`, or `failed`), result payload, and timestamps |
| `GET` | `/reports/:id` | `404 Not Found` | Returned when the requested ID does not exist in the in-memory store or SQLite database |

### Core Concepts & Rubric Reflections

* **Validation vs. Retries**: Bad input (empty topic) is a deterministic client error rejected immediately with `400 Bad Request` without consuming queue resources. Retries are reserved strictly for transient runtime errors (timeouts, provider outages, rate limits) where exponential backoff gives dependencies time to recover.
* **Cron Expressions**:
  - Every day at 08:00 UTC: `0 8 * * *`
  - Every Sunday at 22:00 UTC: `0 22 * * 0` (or `0 22 * * SUN`)
* **Idempotency (Stretch Goal)**: Background jobs survive multiple executions because queues guarantee at-least-once delivery. Checking existing status before execution ensures side effects occur only once.
* **Concurrency Limits (Stretch Goal)**: Concurrency ceiling (configured to `limit: 2`) protects downstream infrastructure from saturation when traffic spikes.
* **Durability Experiment (Stretch Goal)**: When stopping the API container during the 8-second sleep step and restarting, Inngest resumes execution directly at that step without re-running completed steps, demonstrating durable step execution.

### Live Verification Proofs

#### 1. Instant 202 Accepted & Eventual Consistency Polling

```http
POST /reports {"topic":"cats"} -> 202 Accepted (115 ms)
Response:
{
  "id": "0e586bd7-7917-4ba9-a90f-84cd8bde2b36",
  "status": "pending"
}

GET /reports/0e586bd7-7917-4ba9-a90f-84cd8bde2b36 -> 200 OK (Immediate Poll)
Response:
{
  "id": "0e586bd7-7917-4ba9-a90f-84cd8bde2b36",
  "topic": "cats",
  "status": "pending",
  "result": null
}

GET /reports/0e586bd7-7917-4ba9-a90f-84cd8bde2b36 -> 200 OK (Polled After 8.3s)
Response:
{
  "id": "0e586bd7-7917-4ba9-a90f-84cd8bde2b36",
  "topic": "cats",
  "status": "done",
  "result": "Comprehensive executive report on [cats]: All 8 metrics analyzed and verified.",
  "error": null,
  "created_at": "2026-09-20T11:36:44.477Z",
  "updated_at": "2026-09-20T11:36:52.776Z"
}
```

#### 2. Deterministic Input Validation (400 Bad Request)

```http
POST /reports {} -> 400 Bad Request
Response:
{
  "error": "Valid non-empty topic is required"
}
```

#### 3. Automatic Retries & Exponential Backoff (Topic: "fail")

```http
POST /reports {"topic":"fail"} -> 202 Accepted
Triggered Job ID: d5aa6ae4-26b8-4a90-800d-e226b1344fd9

GET /reports/d5aa6ae4-26b8-4a90-800d-e226b1344fd9 -> 200 OK (After 3 Attempts Exhausted)
Response:
{
  "id": "d5aa6ae4-26b8-4a90-800d-e226b1344fd9",
  "topic": "fail",
  "status": "failed",
  "result": null,
  "error": "The report oven is broken!",
  "created_at": "2026-09-20T11:36:54.818Z",
  "updated_at": "2026-09-20T11:38:41.579Z"
}
```

*(Total duration spans 107 seconds across attempt 1, backoff delays, and attempt 3 before transitioning to failed).*

#### 4. Scheduled Cron Heartbeat Log Output

```text
api-1 | [Heartbeat Cron] Reports status -> Pending: 0 | Done: 1 | Failed: 1 (Total: 2)
api-1 | [Heartbeat Cron] Reports status -> Pending: 0 | Done: 1 | Failed: 1 (Total: 2)
```

### Dashboard & Operational Evidence

#### Multi-App Registry & Functions Directory

The local Inngest Dev Server (`:8288`) discovers background workers from both the Express API and Next.js frontend:

![Inngest Functions Directory](/functions.png)

*All backend worker functions (`say-hello`, `make-report`, and `heartbeat` with its `* * * * *` cron trigger) registered under `report-api` alongside the Next.js workflow engine.*

#### Execution Timeline & Retry Backoff

Inspection of the failed run demonstrates automated recovery handling:

![Inngest Run Details & Retries](/details.png)

*Timeline showing 3 discrete execution attempts with increasing backoff delays, the `"The report oven is broken!"` stack trace, and the frontend monitoring status.*

---

## Verification & Testing Guide

### 1. Data Persistence Proof (Docker Named Volume)

Create a task, restart the container, and verify the record persists:

```bash
# 1. Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Docker volume persistence test"}'

# 2. Restart the API container
docker compose restart api

# 3. Retrieve tasks and ensure the created record remains present
curl http://localhost:3000/tasks
```

**Expected Result**: Task appears in the list after restart, proving SQLite persistence via Docker volume.

![SQLite persistence screenshot](/sql-screenshot.png)

*SQLite task data stored by the API and persisted across restarts.*

### 2. End-to-End Authentication Flow

```bash
# Missing password: 400 Bad Request
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Create a user: 201 Created
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"a-strong-password"}'

# Log in and extract access_token: 200 OK
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"a-strong-password"}'

# Access protected route with bearer token: 200 OK
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Attempt access with invalid token: 401 Unauthorized
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer invalid-token"

# Public route without authentication: 200 OK
curl -i http://localhost:3000/public/info

# Logout: 204 No Content
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Swagger UI & Interactive Testing

Open `http://localhost:3000/docs` in your browser. Use the **Authorize** button to test protected endpoints with a valid bearer token. The lock icon marks `/protected/profile`, `/protected/dashboard`, and `/auth/logout` as protected operations.

![Swagger UI documentation](/swagger-screenshot.png)

*Swagger UI for the task API with interactive endpoint testing.*

![Swagger UI bearer authentication](/swagger-auth-screenshot.png)

*Swagger UI with bearer token authentication enabled for protected endpoints.*

### 4. Scraper, Idempotency, and PDF Generation

```powershell
# 1. Trigger scraper and populate SQLite
Invoke-RestMethod -Uri "http://localhost:3000/scraper" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"url":"http://books.toscrape.com"}'

# 2. Generate first report
$res1 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books"}'
$res1 | ConvertTo-Json

# 3. Test idempotency (same day returns cached record)
$res2 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books"}'
Write-Host "Idempotency match:" ($res1.id -eq $res2.id)

# 4. Force regeneration (bypasses cache)
$res3 = Invoke-RestMethod -Uri "http://localhost:3000/reports" -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"type":"books", "force": true}'
Write-Host "Force bypassed cache:" ($res3.id -ne $res1.id)

# 5. Download and view generated PDF artifact
Invoke-WebRequest -Uri "http://localhost:3000/reports/$($res1.id)/file" -OutFile "books-report.pdf"
Start-Process "books-report.pdf"
```

### 5. AI Support Triage Endpoint

```bash
curl -i -X POST http://localhost:3000/triage \
  -H "Content-Type: application/json" \
  -d '{"text":"My invoice was charged twice this month and I need a refund."}'
```

**Expected Response** (200 OK):

```json
{
  "category": "billing",
  "urgency": "high",
  "confidence": 0.96,
  "reason": "Customer is reporting a duplicate charge and requesting a refund."
}
```

---

## Docker Commands Reference

### Common Operations

```bash
# Start the stack (detached mode)
docker compose up -d --build

# View logs in real-time (all services)
docker compose logs -f

# View logs for a specific service
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f inngest

# Stop the stack (containers stopped, data persists)
docker compose down

# Stop and delete everything (data persists in volume)
docker compose down

# Stop and delete volumes (WARNING: deletes data)
docker compose down -v

# Restart a specific container
docker restart flyrank-task-api-api-1

# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View Docker volumes
docker volume ls

# Inspect a volume
docker volume inspect flyrank-task-api_sqlite_data

# Delete unused volumes
docker volume prune

# View container stats (CPU, memory, I/O)
docker stats

# Execute a command inside a running container
docker exec -it flyrank-task-api-api-1 sh
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
│   ├── .env                     # (git-ignored) Provider credentials and runtime flags
│   └── package.json
├── prompts/                     # Versioned LLM prompt templates (triage-v1.md)
├── logs/                        # Quarantined payloads and execution traces
├── .env.example                 # Template for environment variables
├── docker-compose.yml           # Unified multi-service orchestration
└── README.md                    # This file
```

---

## Troubleshooting

### Port Conflicts

If port `3000`, `3002`, or `8288` is already in use:

**Windows PowerShell:**
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

**Alternative:** Rebind the host ports in `docker-compose.yml`:
```yaml
services:
  api:
    ports:
      - "3001:3000"  # Changed from 3000:3000
```

### SQLite Permission or Directory Missing

If the container logs indicate `SQLITE_CANTOPEN`, verify that the volume mapping points to a dedicated directory, not the application root:

```yaml
volumes:
  - sqlite_data:/app/data  # Correct: separate volume
```

❌ **Do NOT use:**
```yaml
volumes:
  - sqlite_data:/app  # Wrong: shadows entire app directory
```

### Native Dependency Compilation

The SQLite driver (`better-sqlite3`) builds native C++ binaries on installation. If switching Node versions or container bases, rebuild using:

```bash
docker compose build --no-cache api
```

### Container Exits Immediately

Check the logs for errors:
```bash
docker compose logs api
docker compose logs frontend
```

**Common causes:**
- Missing `.env` file (should exist, can be empty)
- Database directory doesn't exist (auto-created by app)
- Syntax error in source code
- Missing environment variables for Supabase or LLM provider

### Data Disappeared After Restart

Verify the volume is correctly mounted:
```bash
docker volume inspect flyrank-task-api_sqlite_data

# Should show a "Mountpoint" on your host filesystem
```

If the volume exists but data is gone, check:
1. `.env` has `DB_PATH=/app/data/tasks.db`
2. `docker-compose.yml` has `sqlite_data:/app/data` (NOT `/app`)
3. No `DROP TABLE` statement in application code

---

## Technology Stack

* **Runtime:** Node.js v22 (Alpine Linux base for backend)
* **Frontend Framework:** Next.js with App Router
* **Backend Framework:** Express.js
* **Database Driver:** better-sqlite3 (synchronous SQLite bindings)
* **Database:** SQLite (file-based, single-file, zero-config)
* **LLM Integration:** Groq/OpenAI-compatible API with Zod validation
* **Containerization:** Docker & Docker Compose
* **Task Orchestration:** Inngest (local dev server)
* **Visual Workflow:** React Flow
* **PDF Generation:** Playwright + Chromium
* **Authentication:** Supabase Auth via `@supabase/supabase-js`
* **Documentation:** Swagger UI (OpenAPI 3.0)
* **Language:** TypeScript (frontend) / JavaScript (backend)

---

## Stages & Assignments Completed

✅ **Assignment A1** – In-memory array (baseline, data lost on restart)  
✅ **Assignment A2** – SQLite file on disk (data persists locally)  
✅ **Assignment A3** – Containerized with Docker Compose (portable, reproducible stack)  
✅ **Assignment BE-03** – Supabase email/password authentication and protected routes  
✅ **Assignment BE-04** – Multi-service orchestration with frontend and background engine  
✅ **Assignment A17** – LLM Support Triage with Zod validation, repair loop, and quarantine pipeline (8/8 eval accuracy)  
✅ **Assignment A18** – Polite Scraper and PDF Report Generation with same-day idempotency  
✅ **Assignment A19** – Interactive AI Decision Flow with React Flow, Inngest, and LLM resilience  
✅ **Assignment A7 / BE-06** – Distributed Background Job Engine with Inngest (202 Accepted, retries, cron, durability, and idempotency)  

---

## Example Requests & Responses

### GET /tasks – List all tasks

```bash
curl http://localhost:3000/tasks
```

**Response (200 OK):**
```json
[
  { "id": 1, "title": "Set up Express server", "done": 1 },
  { "id": 2, "title": "Build read endpoints", "done": 0 },
  { "id": 3, "title": "Publish to GitHub", "done": 0 }
]
```

### POST /tasks – Create a new task

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn Docker"}'
```

**Response (201 Created):**
```json
{
  "id": 4,
  "title": "Learn Docker",
  "done": false
}
```

### PUT /tasks/:id – Update a task

```bash
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Update Express server","done":true}'
```

**Response (200 OK):**
```json
{
  "id": 1,
  "title": "Update Express server",
  "done": true
}
```

### DELETE /tasks/:id – Delete a task

```bash
curl -X DELETE http://localhost:3000/tasks/2
```

**Response (204 No Content)** – No body returned.

---

## Contributing

Contributions are welcome! Feel free to:
- Open an issue to report bugs or suggest features
- Submit a pull request with improvements
- Add optional stretch features (Redis cache, database indexes, migrations, etc.)

---

## License

This project is open-source and available under the **MIT License**.

---

## Author

**Toni Ihab Youssef**

FlyRank AI Internship · Backend & Fullstack Track

Originally built as Assignment A1–A3 (Task API), evolved through BE-03 (Auth), and now unified with A17 (Triage), A18 (Scraper), A19 (Decision Flow), and full Docker containerization.