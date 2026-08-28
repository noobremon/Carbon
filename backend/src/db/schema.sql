-- PostgreSQL Schema for Fault-Tolerant Data Processing System

-- 1. Raw Event Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raw_event_status') THEN
        CREATE TYPE raw_event_status AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'DUPLICATE', 'FAILED');
    END IF;
END $$;

-- 2. Raw Storage Table (Immutable audit log of all raw inputs)
CREATE TABLE IF NOT EXISTS raw_events (
    id SERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    raw_payload JSONB NOT NULL,
    status raw_event_status NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    fingerprint VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_raw_events_status ON raw_events(status);
CREATE INDEX IF NOT EXISTS idx_raw_events_received_at ON raw_events(received_at DESC);

-- 3. Normalized Canonical Events Storage
CREATE TABLE IF NOT EXISTS normalized_events (
    id SERIAL PRIMARY KEY,
    raw_event_id INT UNIQUE REFERENCES raw_events(id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL UNIQUE, -- Primary database-level deduplication constraint
    client_id VARCHAR(100) NOT NULL,
    metric VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    extra_fields JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_norm_client_id ON normalized_events(client_id);
CREATE INDEX IF NOT EXISTS idx_norm_metric ON normalized_events(metric);
CREATE INDEX IF NOT EXISTS idx_norm_timestamp ON normalized_events(timestamp);
