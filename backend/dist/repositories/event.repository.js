"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventRepository = void 0;
const database_1 = require("../config/database");
class EventRepository {
    /**
     * Inserts an immutable raw event payload. Returns inserted raw event ID.
     */
    static async createRawEvent(rawPayload, status = 'RECEIVED') {
        if ((0, database_1.getIsInMemoryMode)()) {
            const id = database_1.inMemoryDb.rawEventSeq++;
            database_1.inMemoryDb.rawEvents.push({
                id,
                received_at: new Date(),
                raw_payload: rawPayload,
                status,
                error_message: null,
                fingerprint: null
            });
            return id;
        }
        const res = await (0, database_1.query)(`INSERT INTO raw_events (raw_payload, status) VALUES ($1, $2) RETURNING id`, [JSON.stringify(rawPayload), status]);
        return res.rows[0].id;
    }
    /**
     * Updates raw event status and optional error message or fingerprint.
     */
    static async updateRawEvent(rawId, status, errorMessage, fingerprint, clientTransaction) {
        if ((0, database_1.getIsInMemoryMode)()) {
            const record = database_1.inMemoryDb.rawEvents.find(r => r.id === rawId);
            if (record) {
                record.status = status;
                if (errorMessage !== undefined)
                    record.error_message = errorMessage;
                if (fingerprint !== undefined)
                    record.fingerprint = fingerprint;
            }
            return;
        }
        const sql = `UPDATE raw_events SET status = $1, error_message = $2, fingerprint = COALESCE($3, fingerprint) WHERE id = $4`;
        if (clientTransaction) {
            await clientTransaction.query(sql, [status, errorMessage || null, fingerprint || null, rawId]);
        }
        else {
            await (0, database_1.query)(sql, [status, errorMessage || null, fingerprint || null, rawId]);
        }
    }
    /**
     * Inserts a canonical normalized event atomically using database UNIQUE fingerprint constraint.
     */
    static async insertNormalizedEventAtomic(rawId, fingerprint, event, clientTransaction, simulateFailure = false) {
        if ((0, database_1.getIsInMemoryMode)()) {
            if (simulateFailure) {
                throw new Error('Simulated database write failure mid-request');
            }
            const existing = database_1.inMemoryDb.normalizedEvents.find(e => e.fingerprint === fingerprint);
            if (existing) {
                return { inserted: false };
            }
            const id = database_1.inMemoryDb.normEventSeq++;
            database_1.inMemoryDb.normalizedEvents.push({
                id,
                raw_event_id: rawId,
                fingerprint,
                client_id: event.client_id,
                metric: event.metric,
                amount: event.amount,
                timestamp: new Date(event.timestamp),
                created_at: new Date(),
                extra_fields: event.extra_fields
            });
            return { inserted: true };
        }
        if (simulateFailure) {
            throw new Error('Simulated database write failure mid-request');
        }
        const dbClient = clientTransaction || (await (0, database_1.getDbClient)());
        const sql = `
      INSERT INTO normalized_events (raw_event_id, fingerprint, client_id, metric, amount, timestamp, extra_fields)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (fingerprint) DO NOTHING
      RETURNING id
    `;
        const params = [
            rawId,
            fingerprint,
            event.client_id,
            event.metric,
            event.amount,
            event.timestamp,
            JSON.stringify(event.extra_fields || {})
        ];
        const res = await dbClient.query(sql, params);
        if (!clientTransaction && dbClient) {
            dbClient.release();
        }
        return { inserted: (res.rowCount ?? 0) > 0 };
    }
    /**
     * Fetches recent events with status, client_id, amount, timestamp, and error details.
     */
    static async findRecentEvents(limit = 50) {
        if ((0, database_1.getIsInMemoryMode)()) {
            const records = [...database_1.inMemoryDb.rawEvents].reverse().slice(0, limit);
            return records.map(raw => {
                const norm = database_1.inMemoryDb.normalizedEvents.find(n => n.raw_event_id === raw.id);
                return {
                    id: raw.id,
                    received_at: raw.received_at,
                    raw_payload: raw.raw_payload,
                    status: raw.status,
                    error_message: raw.error_message || undefined,
                    fingerprint: raw.fingerprint || undefined,
                    client_id: norm?.client_id,
                    amount: norm?.amount,
                    timestamp: norm?.timestamp ? norm.timestamp.toISOString() : undefined
                };
            });
        }
        const res = await (0, database_1.query)(`
      SELECT 
        r.id,
        r.received_at,
        r.raw_payload,
        r.status,
        r.error_message,
        r.fingerprint,
        n.client_id,
        n.amount::FLOAT as amount,
        n.timestamp
      FROM raw_events r
      LEFT JOIN normalized_events n ON r.id = n.raw_event_id
      ORDER BY r.id DESC
      LIMIT $1
    `, [limit]);
        return res.rows;
    }
    /**
     * Calculates persisted aggregate stats (event count and total amount) for successfully processed events.
     * Fixes Critical Issue 3: Returns [] on empty database unless a specific client_id filter was requested.
     */
    static async queryAggregates(filter) {
        if ((0, database_1.getIsInMemoryMode)()) {
            let events = [...database_1.inMemoryDb.normalizedEvents];
            if (filter.client_id) {
                events = events.filter(e => e.client_id.toLowerCase() === filter.client_id.toLowerCase());
            }
            if (filter.start_date) {
                const start = new Date(filter.start_date).getTime();
                if (!isNaN(start)) {
                    events = events.filter(e => e.timestamp.getTime() >= start);
                }
            }
            if (filter.end_date) {
                const end = new Date(filter.end_date).getTime();
                if (!isNaN(end)) {
                    events = events.filter(e => e.timestamp.getTime() <= end);
                }
            }
            const groups = new Map();
            for (const e of events) {
                const cid = e.client_id;
                if (!groups.has(cid))
                    groups.set(cid, []);
                groups.get(cid).push(e);
            }
            if (groups.size === 0) {
                if (filter.client_id) {
                    return [{
                            client_id: filter.client_id,
                            event_count: 0,
                            total_amount: 0
                        }];
                }
                return [];
            }
            const results = [];
            for (const [cid, group] of groups.entries()) {
                const total = group.reduce((sum, item) => sum + Number(item.amount), 0);
                results.push({
                    client_id: cid,
                    event_count: group.length,
                    total_amount: Math.round(total * 100) / 100
                });
            }
            return results;
        }
        const conditions = [];
        const params = [];
        let pIdx = 1;
        if (filter.client_id) {
            conditions.push(`LOWER(client_id) = LOWER($${pIdx++})`);
            params.push(filter.client_id);
        }
        if (filter.start_date) {
            conditions.push(`timestamp >= $${pIdx++}`);
            params.push(filter.start_date);
        }
        if (filter.end_date) {
            conditions.push(`timestamp <= $${pIdx++}`);
            params.push(filter.end_date);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
      SELECT 
        client_id,
        COUNT(*)::INT as event_count,
        COALESCE(SUM(amount), 0)::FLOAT as total_amount
      FROM normalized_events
      ${whereClause}
      GROUP BY client_id
      ORDER BY client_id
    `;
        const res = await (0, database_1.query)(sql, params);
        if (res.rows.length === 0) {
            if (filter.client_id) {
                return [{
                        client_id: filter.client_id,
                        event_count: 0,
                        total_amount: 0
                    }];
            }
            return [];
        }
        return res.rows.map(r => ({
            client_id: r.client_id,
            event_count: r.event_count,
            total_amount: Math.round(r.total_amount * 100) / 100
        }));
    }
}
exports.EventRepository = EventRepository;
