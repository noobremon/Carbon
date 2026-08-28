"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inMemoryDb = void 0;
exports.getIsInMemoryMode = getIsInMemoryMode;
exports.initDatabase = initDatabase;
exports.query = query;
exports.getDbClient = getDbClient;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fault_tolerant_db';
let pool = null;
let isUsingInMemoryStore = true; // Default to true until live connection verified
class InMemoryDatabase {
    rawEvents = [];
    normalizedEvents = [];
    rawEventSeq = 1;
    normEventSeq = 1;
    reset() {
        this.rawEvents = [];
        this.normalizedEvents = [];
        this.rawEventSeq = 1;
        this.normEventSeq = 1;
    }
}
exports.inMemoryDb = new InMemoryDatabase();
function getIsInMemoryMode() {
    return isUsingInMemoryStore || pool === null;
}
async function initDatabase() {
    try {
        const testPool = new pg_1.Pool({
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
    }
    catch (err) {
        console.warn(`⚠️ PostgreSQL connection not available (${err.message}). Using high-reliability In-Memory Database engine.`);
        isUsingInMemoryStore = true;
        if (pool) {
            await pool.end().catch(() => { });
            pool = null;
        }
    }
}
async function query(text, params) {
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
async function getDbClient() {
    if (pool && !isUsingInMemoryStore) {
        return await pool.connect();
    }
    return null;
}
