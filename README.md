# Fault-Tolerant Event Processing System

A production-grade, resilient event-ingestion platform engineered to reliably ingest, validate, normalize, deduplicate, and atomically persist event streams from external client applications—guaranteeing data integrity and accurate aggregation even during network retries, malformed payloads, and mid-flight database crashes.

---

## Overview

External systems frequently retry requests when networks, load balancers, or downstream microservices fail. Without idempotent ingestion, repeated payloads cause aggregate drift, corrupted analytics, and duplicate records. Furthermore, if a database failure occurs mid-request without strict transaction isolation, partial writes leave data stores in an unrecoverable, inconsistent state.

This system provides a robust ingestion layer that solves these challenges through:
1. **Immutable Raw Audit Logging**: Capturing the raw input before parsing so no payload is ever lost.
2. **Canonical Data Normalization**: Harmonizing varied schema aliases, currency strings, and timestamps into strict ISO 8601 UTC formats.
3. **Deterministic SHA-256 Deduplication**: Generating content-based fingerprints backed by database-level `UNIQUE` constraints to enforce exactly-once aggregation semantics across retries.
4. **Atomic Transaction Isolation**: Wrapping database writes in ACID transactions (`BEGIN ... COMMIT / ROLLBACK`) so partial failures safely roll back with zero aggregate drift.
5. **Dual-Mode Database Architecture**: Production-ready PostgreSQL storage with automatic fallback to an in-memory SQL database for instant, zero-dependency local testing.

> **Note**: This platform processes event payloads (such as telemetry, usage, checkout, and activity metrics). It is an event-processing engine, not a payment gateway.

---

## Real-World Architecture

In production, external application backends send event payloads over HTTP. This platform receives, processes, and stores canonical data while providing real-time aggregation and auditability.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL APPLICATIONS                           │
│               (E-commerce Apps, SaaS Services, Webhooks)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ HTTP POST /api/events
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       INGESTION API LAYER                              │
│         Express + TypeScript Router & Request Audit Capture            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     1. IMMUTABLE RAW CAPTURE                           │
│     Write raw payload to `raw_events` table (Status: RECEIVED)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     2. VALIDATION & NORMALIZATION                      │
│     • Alias mapping (client/source, metric/event, amount/value)        │
│     • Currency & numeric coercion ("$450.75" → 450.75)                 │
│     • Timestamp parsing to canonical ISO 8601 UTC                      │
│     • Unmapped properties preserved in `extra_fields` JSONB            │
│     • Zod schema validation (Non-matching → REJECTED)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    3. DETERMINISTIC FINGERPRINTING                     │
│     Generate SHA-256 hash over canonical client + metric + amount +   │
│     5-minute time window bucket (or fallback content signature)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              4. ATOMIC PERSISTENCE & DEDUPLICATION (ACID)              │
│     BEGIN TRANSACTION                                                  │
│       INSERT INTO normalized_events (...)                              │
│       ON CONFLICT (fingerprint) DO NOTHING;                            │
│       • If rowCount == 0: Mark DUPLICATE, skip aggregate, COMMIT       │
│       • If rowCount == 1: Mark PROCESSED, update aggregates, COMMIT    │
│       • If Error / Crash: ROLLBACK transaction, mark FAILED            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL / PERSISTENCE                         │
│       `raw_events` (Audit) ─── `normalized_events` (Canonical)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   REAL-TIME AGGREGATES & METRICS                       │
│    GET /api/aggregates ── Client Totals, Counts & Activity Feed        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## How It Works: The 7-Stage Event Lifecycle

1. **Receive**: Ingests raw JSON or raw text. Inserts an immutable row into `raw_events` with status `RECEIVED` to guarantee full auditability.
2. **Validate**: Verifies the structural envelope using Zod. Rejects unparseable syntax, negative/non-numeric amounts, or missing source identifiers with status `REJECTED` (HTTP 400).
3. **Normalize**: Coerces field variations (e.g. `client_name` $\rightarrow$ `client_id`, `price` $\rightarrow$ `amount`, fuzzy slash dates $\rightarrow$ ISO 8601 UTC). Stores extra metadata in `extra_fields`.
4. **Fingerprint**: Computes a deterministic SHA-256 hash across canonical event attributes and a 5-minute time bucket (or sorted attribute signature for events without client timestamps).
5. **Deduplicate**: Checks for fingerprint collisions against the database `UNIQUE` index. If matched, flags the event as `DUPLICATE` (HTTP 200) without inserting a duplicate canonical row or inflating aggregates.
6. **Atomic Persist**: Writes canonical records inside an isolated SQL transaction. If a database failure occurs mid-write, the transaction rolls back cleanly, leaving no orphaned data, and marks the raw record as `FAILED` (HTTP 500).
7. **Aggregate**: Updates real-time metric aggregates (event counts, total volume) computed exclusively from committed canonical events.

---

## Fault Tolerance & ACID Guarantees

When a database connection drops or a write crash occurs mid-request:

```
                  DATABASE FAILURE WORKFLOW

Incoming Event Request
        │
        ▼
   BEGIN TRANSACTION
        │
        ▼
   Write normalized event
        │
   [ SYSTEM CRASH / FAILURE ]
        │
        ▼
   ROLLBACK TRANSACTION
        │
        ▼
   Raw event marked FAILED in audit store
   (Aggregate totals remain completely unaffected)
        │
        ▼
   Client receives HTTP 500
        │
        ▼ (Client retries after system recovery)
   BEGIN TRANSACTION
        │
        ▼
   Write succeeds & COMMIT
        │
   Event marked PROCESSED (Counted exactly once)
```

- **No Partial State**: Transactions ensure atomic "all-or-nothing" semantics. A failed write never mutates aggregates or leaves dangling rows.
- **Audit Preservation**: The raw payload remains intact in `raw_events` with status `FAILED` and error diagnostics for troubleshooting.
- **Safe Recovery**: When the client retries the same request, the system processes it cleanly into `normalized_events` with status `PROCESSED`.

---

## Duplicate Prevention & Idempotency

External networks and client SDKs routinely retry requests upon timeout. The platform implements deterministic deduplication:

1. **Deterministic SHA-256 Fingerprint**:
   - **With Timestamp**: `SHA256(client_id + "::" + metric + "::" + amount.toFixed(2) + "::" + 5_min_time_bucket)`
   - **Without Client Timestamp**: `SHA256(client_id + "::" + metric + "::" + amount.toFixed(2) + "::NO_CLIENT_TIMESTAMP::" + sorted_extra_fields)`
2. **Database-Level Constraint**:
   ```sql
   CREATE TABLE normalized_events (
       ...
       fingerprint VARCHAR(64) NOT NULL UNIQUE
   );
   ```
3. **Idempotent Insertion**:
   ```sql
   INSERT INTO normalized_events (raw_event_id, fingerprint, client_id, metric, amount, timestamp, extra_fields)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (fingerprint) DO NOTHING;
   ```
   If `rowCount === 0`, the event is recognized as a duplicate. The system logs the outcome as `DUPLICATE` and returns HTTP 200 without double-counting.

*Technical Note*: Deduplication is based on canonical content attributes within a 5-minute bucket window. In production architectures requiring cross-day identical transactions, clients can provide explicit unique idempotency keys in payload headers.

---

## Data Normalization Engine

The normalizer accepts messy, real-world external payloads and maps them to canonical types:

| Capability | Input Example | Normalized Canonical Output |
|---|---|---|
| **Field Aliasing** | `{"source": "A", "price": "100"}` or `{"client": "A", "val": "100"}` | `client_id = "A"`, `amount = 100.00` |
| **Nested Envelopes** | `{"source": "A", "payload": {"amount": 100}}` | Flattened to root canonical event |
| **String Amount Coercion** | `"$1,200.50"`, `"  450.75 "` | `1200.50`, `450.75` (`number`) |
| **Date Normalization** | `"2024/03/15 10:00:00"`, `"2024-03-15"` | `"2024-03-15T10:00:00.000Z"` (`ISO 8601 UTC`) |
| **Unmapped Attributes** | `{"user_segment": "enterprise", "device": "mobile"}` | Preserved intact in `extra_fields` JSONB |

---

## API Reference

### 1. Ingest Event
```http
POST /api/events
Content-Type: application/json
```
**Request Body**:
```json
{
  "source": "company_A",
  "payload": {
    "metric": "payment",
    "amount": 1400,
    "timestamp": "2026-08-29T10:30:00.000Z"
  }
}
```

**Responses**:
- `HTTP 200 OK` (`status: "PROCESSED"`):
  ```json
  {
    "success": true,
    "status": "PROCESSED",
    "raw_event_id": 1,
    "fingerprint": "a3f12c8e9b4d5...",
    "normalized_event": {
      "client_id": "company_A",
      "metric": "payment",
      "amount": 1400,
      "timestamp": "2026-08-29T10:30:00.000Z",
      "extra_fields": {}
    },
    "message": "Successfully normalized and stored canonical event"
  }
  ```
- `HTTP 200 OK` (`status: "DUPLICATE"`):
  ```json
  {
    "success": true,
    "status": "DUPLICATE",
    "raw_event_id": 2,
    "fingerprint": "a3f12c8e9b4d5...",
    "message": "Duplicate event detected via fingerprint constraint; skipped duplicate insert"
  }
  ```
- `HTTP 400 Bad Request` (`status: "REJECTED"`):
  ```json
  {
    "success": false,
    "status": "REJECTED",
    "raw_event_id": 3,
    "error": "Validation error: amount - Expected number, received nan"
  }
  ```
- `HTTP 500 Internal Server Error` (`status: "FAILED"`):
  ```json
  {
    "success": false,
    "status": "FAILED",
    "raw_event_id": 4,
    "error": "Database transaction error: Simulated database write failure mid-request"
  }
  ```

*(Backwards-compatible alias `POST /api/events/ingest` is also supported).*

---

### 2. Query Recent Events
```http
GET /api/events?limit=50
```
Returns recent audit records including raw payloads, status (`RECEIVED`, `PROCESSED`, `DUPLICATE`, `FAILED`, `REJECTED`), fingerprints, and error logs.

---

### 3. Query Aggregates
```http
GET /api/aggregates?client_id=company_A&start_date=2026-01-01&end_date=2026-12-31
```
Returns calculated aggregate totals (`event_count`, `total_amount`) filtered by client ID and date ranges.

---

### 4. Metrics Summary & Health
- `GET /api/events/raw`: Returns all raw audit logs.
- `GET /api/events/processed`: Returns canonical persisted events.
- `GET /api/events/rejected`: Returns rejected and failed events.
- `GET /api/metrics/stats`: Returns system-wide statistics (processed, duplicate, failed, rejected counts).
- `GET /api/health`: System health check (`status: "ok"`).
- `GET /api/system/failure-mode`: Check fault injection state.
- `POST /api/system/failure-mode`: Enable/disable simulated database crashes (`{"enable": true}`).
- `POST /api/system/reset`: Reset in-memory evaluation state.

---

## Developer Test Tools & External Client Simulator

The dashboard includes a dedicated left-hand console with two complementary modes:

```
┌─────────────────────────────────────────────────────────────┐
│                 DEVELOPER CONSOLE MODES                     │
├──────────────────────────────┬──────────────────────────────┤
│  External Client Simulator   │   Raw JSON & Preset Cases    │
│   (Structured Form Inputs)   │    (Developer Test Client)   │
└──────────────────────────────┴──────────────────────────────┘
```

1. **External Client Simulator**:
   - Explicitly configures **Client / Producer** (`Company A`, `Company B`, `Company C`, `Partner X`, `Service Y`), **Event Type** (`Payment`, `Purchase`, `Subscription Renewal`, `Checkout`, `Refund`), **Amount**, and **Timestamp**.
   - Displays real-time `POST /api/events` payload previews and copyable cURL commands.
   - Clarifies that this is a developer simulation representing what an external application's backend would send in production.
2. **Developer Test Client (Raw JSON & Presets)**:
   - Provides full manual JSON editing and presets for testing edge cases (*Standard Purchase*, *String Amount*, *Fuzzy Date*, *Extra Fields*, *Invalid Amount*, *Malformed JSON*).
3. Both modes route through the **exact same** `api.ingestEvent()` $\rightarrow$ `POST /api/events` backend pipeline.

---

## Tech Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (v5.5)
- **Framework**: Express (v4.19)
- **Validation**: Zod (v3.23)
- **Database Driver**: `pg` (v8.12) with connection pooling & transaction isolation
- **Testing**: Jest (v29.7) & Supertest (v7.0)
- **Development**: `ts-node-dev`

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite (v5.3)
- **Language**: TypeScript (v5.5)
- **Icons**: Lucide React
- **Styling**: Vanilla CSS Design Tokens (Glassmorphism, custom theme variables, responsive grid/flex layouts)

### Database
- **Primary**: PostgreSQL (DDL auto-migration on boot)
- **Fallback / Embedded**: High-reliability In-Memory SQL database for zero-dependency local development and CI testing

---

## Project Structure

```
Carbon/
├── backend/
│   ├── src/
│   │   ├── config/          # PostgreSQL pool connection & In-Memory fallback store
│   │   ├── controllers/     # HTTP endpoint handlers (EventController)
│   │   ├── db/              # SQL schema DDL (raw_events, normalized_events)
│   │   ├── domain/          # Canonical Zod schemas & field alias dictionaries
│   │   ├── repositories/    # Database queries, atomic transactions & aggregations
│   │   ├── routes/          # Express route definitions (/events, /metrics, /system)
│   │   ├── services/        # IngestService, NormalizerService, FingerprintService
│   │   ├── __tests__/       # Comprehensive Jest test suites (lifecycle, pipeline, fixes)
│   │   ├── app.ts           # Express application setup & JSON error middleware
│   │   └── server.ts        # Server entry point & DB initialization
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── public/              # Static assets (custom favicon.svg)
│   ├── src/
│   │   ├── api/             # Typed API client (api.ingestEvent, getAggregates, etc.)
│   │   ├── components/      # PipelineVisualizer, EventSubmitter, LiveEventFeed, etc.
│   │   ├── hooks/           # useCountUp, utility hooks
│   │   ├── App.tsx          # Main dashboard container & live data polling
│   │   ├── index.css        # Complete design system & responsive stylesheets
│   │   └── main.tsx         # React application entry point
│   ├── index.html           # HTML template with custom SVG favicon
│   ├── package.json
│   └── vite.config.ts       # Vite build & proxy configuration
├── render.yaml              # Render cloud infrastructure blueprint (Web + PostgreSQL)
└── README.md                # Technical documentation
```

---

## Running Locally

### Prerequisites
- Node.js (v18.0 or later)
- npm (v9.0 or later)
- *(Optional)* PostgreSQL (v14+) — *if PostgreSQL is not running, the system automatically uses its built-in in-memory database*.

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/fault-tolerant-processing.git
cd fault-tolerant-processing

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

The backend runs out of the box with default fallback settings. To configure custom settings, create a `backend/.env` file:

```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fault_tolerant_db
NODE_ENV=development
```

For the frontend, create `frontend/.env` if connecting to a custom backend host:
```env
VITE_API_URL=http://localhost:4000
```

### 3. Start the Backend

```bash
cd backend
npm run dev
```
Backend runs on **http://localhost:4000**.

### 4. Start the Frontend

In a separate terminal:
```bash
cd frontend
npm run dev
```
Frontend runs on **http://localhost:3000** (with proxy forwarding `/api` to backend).

### 5. Run Automated Tests

```bash
cd backend
npm test
```

### 6. Production Build

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

---

## Environment Variables

| Variable | Target | Purpose | Required | Default |
|---|---|---|---|---|
| `PORT` | Backend | Port for Express server | No | `4000` |
| `DATABASE_URL` | Backend | PostgreSQL connection string | No | `postgresql://.../fault_tolerant_db` *(falls back to in-memory store)* |
| `NODE_ENV` | Backend | Environment flag (`development` / `production`) | No | `development` |
| `VITE_API_URL` | Frontend | Base URL of the backend API | No | `""` *(uses Vite dev proxy)* |

---

## Database Schema

```sql
-- 1. Raw audit storage table
CREATE TABLE raw_events (
    id SERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    raw_payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    fingerprint VARCHAR(64)
);

-- 2. Canonical normalized events table
CREATE TABLE normalized_events (
    id SERIAL PRIMARY KEY,
    raw_event_id INT UNIQUE REFERENCES raw_events(id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL UNIQUE,
    client_id VARCHAR(100) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra_fields JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_norm_client_id ON normalized_events(client_id);
CREATE INDEX idx_norm_timestamp ON normalized_events(timestamp);
```

---

## External Backend Integration Example

Here is how an external service integrates with this platform using Node.js / `fetch`:

```typescript
// external-service-integration.ts
async function sendEventToPlatform(clientId: string, metric: string, amount: number) {
  const payload = {
    source: clientId,
    payload: {
      metric: metric,
      amount: amount,
      timestamp: new Date().toISOString()
    }
  };

  const response = await fetch('http://localhost:4000/api/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  
  if (result.status === 'PROCESSED') {
    console.log('Event recorded canonically:', result.fingerprint);
  } else if (result.status === 'DUPLICATE') {
    console.log('Idempotent retry detected; safe skip:', result.fingerprint);
  } else if (result.status === 'FAILED') {
    console.error('Server write failed; schedule retry:', result.error);
  }
}
```

---

## Evaluator Demo Flow

Follow this 10-step sequence to verify all core capabilities in the UI:

1. **Submit Valid Event**: In the *External Client Simulator*, select **Company A**, **Payment**, **$1,400.00**, and click **SEND EVENT**. Observe status `PROCESSED` and aggregates increase by $1,400.00.
2. **Submit Duplicate Event**: Without changing the timestamp, click **SEND EVENT** again. Observe status `DUPLICATE` (matching fingerprint) and aggregates remain unchanged.
3. **Arm Fault Injection**: Toggle **Fault Injection** to **ON** in the top control bar.
4. **Submit Event Under Crash**: In the simulator, set Amount to **$2,000.00** and click **SEND EVENT**. Observe status `FAILED` (transaction safely rolled back with 0 aggregate change).
5. **Disarm Fault Injection**: Toggle **Fault Injection** to **OFF**.
6. **Retry the Same Event**: Click **SEND EVENT** with the same $2,000.00 payload. Observe status `PROCESSED` (committed and aggregated exactly once).
7. **Test Type Coercion**: Switch to the *Raw JSON / Presets* tab, select **String Amount** (`price: "$450.75"`), and submit. Observe numeric parsing to canonical float `450.75`.
8. **Test Fuzzy Date Normalization**: Select the **Fuzzy Date** preset (`"2024/03/15 10:00:00"`) and submit. Observe conversion to ISO 8601 UTC.
9. **Test Schema Rejection**: Select **Invalid Amount** and submit. Observe HTTP 400 rejection with raw payload preserved in audit logs.
10. **Verify Aggregates Tab**: Switch to the **Aggregates** tab to inspect per-client event counts, date range filters, and total volume breakdown.

---

## Design Decisions & Engineering Trade-Offs

- **Raw Capture First**: Storing raw payloads before validation ensures zero loss of malformed data and provides complete auditability for forensic debugging.
- **Database-Level Idempotency**: Relying on database `UNIQUE` constraints (`ON CONFLICT DO NOTHING`) prevents race conditions between concurrent requests that in-memory locks cannot solve across horizontal instances.
- **Transparent Fallback Database**: The built-in in-memory database engine allows immediate local evaluation and seamless CI/CD test execution without requiring a live PostgreSQL instance.
- **Pragmatic Architecture**: Kept the architecture focused on core fault tolerance, transactions, and normalization without adding unneeded message queues, microservices, or complex external dependencies.

---

## What This Project Demonstrates

- **Resilient API Design**: Schema contracts, custom error parsing, and structured HTTP response status codes.
- **Idempotency & Deduplication**: Deterministic SHA-256 fingerprinting and SQL unique constraints.
- **Data Normalization**: Robust alias mapping, numeric/currency string coercion, and UTC date normalization.
- **ACID Transaction Isolation**: Rollback safety and audit logging during simulated database write crashes.
- **Full-Stack TypeScript**: End-to-end typed contracts across Express backend, Zod validators, and React UI.
