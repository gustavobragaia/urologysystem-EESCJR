# Urofluxometry Platform

**A production medical IoT system for urofluxometry diagnostics — deployed for a urologist client.**

![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-deployed-2496ED?logo=docker&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_+_Auth-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?logo=vercel&logoColor=white)

---

## Overview

Urofluxometry measures a patient's urinary flow rate to help diagnose conditions such as benign prostatic hyperplasia (BPH), urethral strictures, and neurogenic bladder dysfunction. Traditionally, this exam requires an expensive, clinic-only device.

This platform enables **portable, office-based testing** using a custom ESP32 microcontroller with an HX711 load cell. The doctor connects the device, the patient performs the exam, and results appear in real-time on a clinical web dashboard — including 6 validated diagnostic metrics and a downloadable PDF report.

**Deployed for:** Dr. Rômulo Nunes — Urologist and Robotic Surgeon  
**Contracted through:** EESC Jr. USP (R$ 5,000)  
**Status:** Live in production

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         IoT Device Layer                             │
│                                                                      │
│   ESP32 + HX711 Load Cell                                            │
│   (Measures urinary weight at 10 readings/sec)                       │
│              │                                                       │
│              │ POST /api/coleta/dados                                │
│              │ (raw readings array: [{Fl, It}])                      │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Backend (VPS Contabo — Docker)                    │
│                                                                      │
│   Express.js + TypeScript                                            │
│   ├── Auth Middleware (Supabase JWT)                                 │
│   ├── Zod Input Validation                                           │
│   ├── Rate Limiting (Helmet + express-rate-limit)                    │
│   ├── Processamento Service → 6 Clinical Metrics                     │
│   ├── SSE Service (in-memory Map, single-process)                    │
│   ├── PDF Service (PDFKit + ChartJS Node Canvas)                     │
│   └── Drizzle ORM → Supabase PostgreSQL                              │
│              │                                                       │
│              │ Server-Sent Events (SSE)                              │
│              │ GET /api/coleta/aguardar/:pacienteId                  │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Frontend (Vercel — Global CDN)                     │
│                                                                      │
│   React 19 + TypeScript + Vite                                       │
│   ├── React Router (protected routes)                                │
│   ├── TanStack React Query (server state)                            │
│   ├── Radix UI + Tailwind CSS + shadcn/ui                            │
│   ├── React Hook Form + Zod (form validation)                        │
│   ├── Recharts (flow curve visualization)                            │
│   └── Supabase JS Client (auth + session)                            │
└──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Supabase (Managed Cloud)                           │
│                                                                      │
│   PostgreSQL + Auth (JWT issuing) + Row-Level Security               │
│   Tables: pacientes, exames, leituras                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js 20 LTS |
| **Backend Language** | TypeScript 5.4+ |
| **Web Framework** | Express.js 4.19 |
| **ORM** | Drizzle ORM 0.30 + drizzle-kit |
| **DB Driver** | porsager/postgres 3.4 |
| **Input Validation** | Zod 3.23 |
| **Security** | Helmet.js, express-rate-limit |
| **Real-time** | Server-Sent Events (custom in-memory) |
| **PDF Generation** | PDFKit 0.15 + ChartJS Node Canvas 5.0 |
| **API Docs** | Swagger/OpenAPI (swagger-jsdoc + swagger-ui-express) |
| **Frontend Framework** | React 19 + TypeScript 6.0 |
| **Build Tool** | Vite 8.0 |
| **Routing** | React Router 7.14 |
| **Server State** | TanStack React Query 5.100 |
| **HTTP Client** | Axios 1.15 (JWT interceptor) |
| **UI Components** | Radix UI + shadcn/ui + Tailwind CSS 3.4 |
| **Forms** | React Hook Form 7.74 + Zod resolvers |
| **Charts** | Recharts 3.8 |
| **Database** | Supabase (PostgreSQL + Auth + RLS) |
| **Container** | Docker (multi-stage build, bookworm-slim) |
| **Backend Hosting** | VPS Contabo |
| **Frontend Hosting** | Vercel |
| **CI/CD** | GitHub Actions → GHCR → SSH deploy |

---

## Key Features

### 1. Real-Time Exam Collection (SSE Pipeline)
The data collection flow runs entirely in real-time without WebSockets:

1. Doctor opens the collection wizard and selects a patient — the frontend opens an SSE connection to the backend.
2. The ESP32 device POSTs raw readings to `POST /api/coleta/dados`.
3. The backend processes all metrics, saves exam + readings to PostgreSQL, and fires an SSE event to the open connection.
4. The frontend receives the `exame_pronto` event and immediately displays all 6 metrics.

SSE was chosen over WebSockets because it is unidirectional (data only flows device→server→browser), auto-reconnects natively, and traverses corporate/clinic firewalls without special configuration.

### 2. Clinical Metric Engine (6 Metrics)
The `processamento.service.ts` converts raw load-cell readings into the 6 validated urofluxometry metrics used in clinical practice:

| Metric | Description | Normal Range |
|---|---|---|
| **Qmax** | Peak flow rate (mL/s) | 15–50 |
| **Qavg** | Average flow rate (mL/s) | 10–25 |
| **Voided Volume** | Discrete integral of flow curve (mL) | 150–500 |
| **Time to Qmax** | Latency to peak flow (s) | 3–10 |
| **Total Void Time** | Full micturition duration (s) | 15–40 |
| **Post-Void Residual** | Entered manually by physician (mL) | 0–50 |

The calculation is deterministic and server-side — there is no ML classification. The system reports, the doctor interprets. This is an intentional medical liability boundary.

### 3. PDF Clinical Report
`GET /api/exames/:id/pdf` generates a complete clinical PDF on-demand:
- Flow curve chart (rendered server-side with ChartJS Node Canvas)
- Cumulative volume curve
- All 6 metrics with reference ranges
- Patient and physician information
- Interpretation guide

The PDF is fully server-rendered with no browser dependency, making it suitable for API-level automation.

### 4. Authentication & Row-Level Security
- **Supabase Auth** issues JWTs for the physician login.
- **Backend middleware** validates JWT on every request and binds `req.user.id` to all DB queries.
- **Supabase RLS policies** enforce `medico_id = auth.uid()` at the database level — even if the backend were compromised, data isolation holds.
- **SSE special case**: `EventSource` cannot set custom headers, so the token is passed as a query parameter (`?token=...`) and a dedicated `auth-query.middleware.ts` handles that path.

### 5. Orphan Exam Recovery
If the ESP32 POSTs data while no SSE session is active (network gap, page refresh, device delay), the exam is saved with `statusVinculacao: 'orfao'` instead of being discarded. The doctor can later browse orphan exams and manually link them to the correct patient — zero data loss regardless of connectivity.

### 6. CI/CD Pipeline
```
git push main
     │
     ▼
GitHub Actions
  ├── Docker buildx (multi-platform)
  ├── Push :latest + :git-sha to GHCR
  └── SSH into VPS → docker compose up -d
                      │
                      ▼
                  Live in production
```
Frontend deploys automatically via Vercel on the same push.

---

## Technical Highlights

### Single-Process Architecture (Deliberate)
SSE sessions are stored in an in-memory `Map<string, Response>`. This is intentional: the system serves a single user on a single device. Using Redis for session distribution would add operational complexity with no benefit. The tradeoff is explicitly documented — horizontal scaling would require a distributed session store, which is a known, planned upgrade path if the system becomes multi-tenant.

### Drizzle ORM over Prisma
Drizzle was chosen because it generates SQL-readable migrations, has no runtime query overhead, and produces TypeScript types directly from the schema — which compose cleanly with Zod inference across the codebase. Prisma's schema DSL adds an unnecessary abstraction for a non-serverless environment.

### End-to-End Type Safety
```
Drizzle schema → inferred TypeScript types
Zod schemas   → validated + typed request bodies (z.infer<typeof schema>)
React Query   → typed API responses
React Hook Form + Zod → typed, validated forms
```
No type casts. No `any`. Runtime validation at every boundary.

### Infrastructure Split
- **Backend on VPS**: ESP32 needs a stable IP with no cold-start latency. Serverless functions would timeout or fail on device POSTs.
- **Frontend on Vercel**: Global CDN for the SPA; no reason to serve it from the same VPS.
- **Database on Supabase**: Managed PostgreSQL with built-in auth, backups, and PgBouncer pooling — no database ops burden.

### Realistic ESP32 Mock
The `mock/esp32-mock.ts` simulator generates a sinusoidal rise + exponential decay + Gaussian noise — matching the real device's output curve. This allows full end-to-end development and testing without the physical device.

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/auth/me` | JWT | Current authenticated user |
| `GET` | `/api/pacientes` | JWT | List patients (search + pagination) |
| `POST` | `/api/pacientes` | JWT | Create patient |
| `GET` | `/api/pacientes/:id` | JWT | Patient detail + exam history |
| `PATCH` | `/api/pacientes/:id` | JWT | Update patient |
| `DELETE` | `/api/pacientes/:id` | JWT | Delete patient (cascade) |
| `GET` | `/api/exames/:id` | JWT | Exam detail + readings |
| `PATCH` | `/api/exames/:id` | JWT | Update residual volume |
| `DELETE` | `/api/exames/:id` | JWT | Delete exam |
| `GET` | `/api/exames/:id/pdf` | Query token | Download clinical PDF |
| `POST` | `/api/coleta/dados` | — | ESP32 data ingestion |
| `GET` | `/api/coleta/aguardar/:pacienteId` | Query token | SSE real-time stream |
| `POST` | `/api/coleta/cancelar/:pacienteId` | JWT | Cancel active SSE session |
| `GET` | `/api/coleta/orfaos` | JWT | List orphan exams |
| `POST` | `/api/coleta/vincular` | JWT | Link orphan to patient |
| `GET` | `/api/docs` | — | Swagger UI (dev only) |

---

## Database Schema

```
pacientes
├── id              UUID PK
├── medico_id       UUID (FK → Supabase auth.users)
├── nome            text
├── data_nascimento date
├── sexo            enum (M / F / Outro)
├── cpf             text (nullable)
├── convenio        text (nullable)
├── telefone        text (nullable)
├── email           text (nullable)
├── endereco        text (nullable)
└── created_at / updated_at  timestamptz

exames
├── id                    UUID PK
├── medico_id             UUID
├── paciente_id           UUID (FK → pacientes, CASCADE DELETE)
├── status_vinculacao     enum (vinculado / orfao)
├── data_exame            timestamptz
├── fluxo_maximo          real  (mL/s)
├── fluxo_medio           real  (mL/s)
├── volume_miccao         real  (mL)
├── tempo_ate_fluxo_max   real  (s)
├── tempo_total_miccao    real  (s)
├── volume_residual       real  (nullable, mL)
└── created_at / updated_at  timestamptz

leituras
├── id        UUID PK
├── exame_id  UUID (FK → exames, CASCADE DELETE)
├── indice    integer  (0–1000, at 10Hz = 100s max)
└── fluxo     real     (mL/s at this index)
```

RLS policies enforce `medico_id = auth.uid()` on `pacientes` and `exames` at the database level.

---

## Project Structure

```
.
├── backend/
│   └── src/
│       ├── server.ts                # Express app entry
│       ├── db/
│       │   ├── schema.ts            # Drizzle schema
│       │   └── migrations/          # Auto-generated migrations
│       ├── routes/                  # auth, pacientes, exames, coleta
│       ├── services/
│       │   ├── processamento.service.ts  # 6-metric calculation
│       │   ├── sse.service.ts            # In-memory SSE sessions
│       │   ├── pdf.service.ts            # Clinical PDF rendering
│       │   └── exame.service.ts          # Exam persistence
│       └── middleware/              # auth, validate, error, rateLimit
├── frontend/
│   └── src/
│       ├── pages/                   # auth, pacientes, coleta, exames, perfil
│       ├── components/              # layout, coleta wizard, ui library
│       ├── hooks/                   # useColeta, usePacientes, useExames
│       └── services/                # Axios instance, Supabase client
├── mock/
│   └── esp32-mock.ts                # Realistic device simulator
├── .github/workflows/
│   └── deploy.yml                   # CI/CD pipeline
├── docker-compose.yml               # VPS orchestration
└── BUILD.md                         # Full architecture spec
```

---

## Running Locally

**Prerequisites:** Node.js 20 LTS, a free [Supabase](https://supabase.com) project

```bash
# 1. Clone and install
git clone <repo>
npm install

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in your Supabase URL, anon key, and service role key

# 3. Push DB schema
cd backend && npx drizzle-kit push

# 4. Start development servers
npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173

# 5. Simulate the ESP32 device
cd mock && npm install
BACKEND_URL=http://localhost:3000 npm run start
```

The mock will POST a realistic urofluxometry curve to the backend. With the frontend open on a patient's collection screen, the exam will complete in real-time.

---

## Deployment

### Backend (VPS Contabo)
Push to `main` triggers GitHub Actions:
1. Docker multi-stage build (TypeScript compile → lightweight runtime image with Cairo/Pango for canvas)
2. Push `:latest` and `:git-sha` to GitHub Container Registry
3. SSH into VPS → `docker compose pull && docker compose up -d`
4. Old images pruned automatically

### Frontend (Vercel)
Automatic deployment on push to `main`. Zero configuration required.

### Database (Supabase)
Managed PostgreSQL with automatic backups and PgBouncer connection pooling. Schema changes applied via `drizzle-kit push` or SQL migrations.

---

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | backend | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Admin key (JWT verification) |
| `FRONTEND_URL` | backend | CORS allowlist |
| `VITE_SUPABASE_URL` | frontend | Supabase URL for client-side auth |
| `VITE_SUPABASE_ANON_KEY` | frontend | Supabase anon key |
| `VITE_API_URL` | frontend | Backend API base URL |
