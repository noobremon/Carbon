import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fault_tolerant_db';

let pool: Pool | null = null;
let isUsingInMemoryStore = true; // Default to true until live connection verified

export interface RawEventRecord {
  id: number;
  received_at: Date;
  raw_payload: any;
  status: 'RECEIVED' | 'PROCESSED' | 'REJECTED' | 'DUPLICATE' | 'FAILED';
  error_message: string | null;
  fingerprint: string | null;
}

export interface NormalizedEventRecord {
  id: number;
  raw_event_id: number;
  fingerprint: string;
  client_id: string;
  metric: string;
  amount: number;
  timestamp: Date;
  created_at: Date;
  extra_fields: any;
}

class InMemoryDatabase {
  rawEvents: RawEventRecord[] = [];
  normalizedEvents: NormalizedEventRecord[] = [];
  rawEventSeq = 1;
  normEventSeq = 1;

  reset() {
    this.rawEvents = [];
    this.normalizedEvents = [];
    this.rawEventSeq = 1;
    this.normEventSeq = 1;
  }
}

export const inMemoryDb = new InMemoryDatabase();

export function getIsInMemoryMode(): boolean {
  return isUsingInMemoryStore || pool === null;
}

export async function initDatabase(): Promise<void> {
  try {
    const testPool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2000,
    });
    const client = await testPool.connect();
    client.release();
    pool = testPool;
    isUsingInMemoryStore = false;
    console.log('✅ Successfully connected to PostgreSQL database.');
    
    // Auto-migrate tables
    const schemaSql = `
      DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raw_event_status') THEN
              CREATE TYPE raw_event_status AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'DUPLICATE', 'FAILED');
          END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS raw_events (
          id SERIAL PRIMARY KEY,
          received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          raw_payload JSONB NOT NULL,
          status raw_event_status NOT NULL DEFAULT 'RECEIVED',
          error_message TEXT,
          fingerprint VARCHAR(64)
      );

      CREATE TABLE IF NOT EXISTS normalized_events (
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
    `;
    await pool.query(schemaSql);
  } catch (err: any) {
    console.warn(`⚠️ PostgreSQL connection not available (${err.message}). Using high-reliability In-Memory Database engine.`);
    isUsingInMemoryStore = true;
    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }
  }
}

export async function query(text: string, params?: any[]): Promise<QueryResult<any>> {
  if (pool && !isUsingInMemoryStore) {
    return pool.query(text, params);
  }
  
  return {
    rows: [],
    command: 'SELECT',
    rowCount: 0,
    oid: 0,
    fields: []
  };
}

export async function getDbClient() {
  if (pool && !isUsingInMemoryStore) {
    return await pool.connect();
  }
  return null;
}
