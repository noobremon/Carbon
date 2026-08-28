# Fault-Tolerant Data Processing System

## 1. What assumptions did you make?

- **Fingerprint Window Bucket**: Retried or duplicate events arrive within a 5-minute time window of the original event timestamp.
- **Fallback for Missing Timestamps**: When a client payload omits a timestamp, the server generates a deterministic fingerprint over content attributes (`client_id`, `metric`, `amount`, `extra_fields`) while omitting fluctuating server timestamps. This guarantees that retries without timestamps generate the exact same fingerprint across time window boundaries.
- **Required Envelope Contract**: An event must resolve to a non-empty `client_id`, `metric`, and a valid numeric `amount` to be valid for canonical ingestion. Malformed values (e.g., non-numeric amounts like `"invalid"`) are rejected with status `REJECTED`. Unmapped fields are preserved inside `extra_fields`.
- **Database Engine Dual-Mode**: The application attempts a connection to PostgreSQL, but falls back to an embedded in-memory SQL database engine if no local PostgreSQL daemon is running.

---

## 2. How does your system prevent double counting?

- **Deterministic SHA-256 Fingerprinting**: Computes a SHA-256 hash across canonical event attributes:
  - With client timestamp: `SHA256(client_id + "::" + metric + "::" + amount.toFixed(2) + "::" + 5_min_time_bucket)`
  - Without client timestamp: `SHA256(client_id + "::" + metric + "::" + amount.toFixed(2) + "::NO_CLIENT_TIMESTAMP::" + extra_fields)`
- **Database-Enforced Unique Constraint**: The `fingerprint` column in `normalized_events` is backed by a PostgreSQL `UNIQUE` index constraint.
- **Atomic Insert Strategy**:
  Executes `INSERT INTO normalized_events (...) ON CONFLICT (fingerprint) DO NOTHING`.
  If a duplicate fingerprint is submitted, the database returns `rowCount = 0`. The pipeline updates the raw event status to `DUPLICATE` and returns HTTP 200 without inserting a duplicate canonical row or incrementing aggregate totals.

### Limitation Acknowledgment
Because clients do **not** provide a guaranteed unique event ID, deduplication relies on attribute fingerprinting. If a legitimate user submits two separate, intentional transactions with the exact same `client_id`, `metric`, and `amount` within the same 5-minute window, the system will treat the second transaction as a duplicate. True idempotent deduplication at scale requires clients to supply unique event IDs or idempotency keys.

---

## 3. What happens if the database fails mid-request?

- **Atomic SQL Transaction Rollback**: Raw event status updates, canonical event inserts, and metric calculations execute inside an atomic PostgreSQL transaction (`BEGIN ... COMMIT`).
- **Clean Failure Logging**: If a database write fails mid-request (or if failure simulation mode is enabled):
  1. The SQL transaction executes `ROLLBACK`.
  2. No partial or uncommitted records are written to `normalized_events`.
  3. The raw event payload is preserved in `raw_events` with status `FAILED` and an error log message.
- **Safe Retry Recovery**: When the database recovers and the client retries the exact same request, the system processes the raw event cleanly, transitions it to `PROCESSED`, and counts it in aggregates exactly once.

---

## 4. What would break first at scale?

### Likely First Bottleneck
Dynamic `SELECT client_id, COUNT(*), SUM(amount) FROM normalized_events WHERE ... GROUP BY client_id` SQL queries executed on every `GET /api/aggregates` request. As `normalized_events` grows to millions of rows, scanning and grouping un-indexed or large table ranges will cause database CPU and I/O saturation, leading to query latency degradation.

### Measured Remediation Strategy
Only after profiling write throughput versus read latency under load would we introduce architectural changes:
1. **If read queries bottleneck first**: Introduce an incremental pre-aggregated rollups table (`aggregated_metrics`) updated atomically during event insert transactions, or use PostgreSQL continuous materialized views.
2. **If write transactions bottleneck first**: Decouple ingestion from normalization by introducing an asynchronous stream buffer (e.g. Redis Streams or Kafka) between raw ingest logging and canonical database persistence.
