"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregationService = void 0;
const database_1 = require("../config/database");
class AggregationService {
    /**
     * Calculates aggregated metrics over normalized canonical events.
     * Supports filtering by client_id, metric, and date range.
     */
    static async getAggregatedMetrics(filter = {}) {
        if ((0, database_1.getIsInMemoryMode)()) {
            return this.getAggregatedMetricsInMemory(filter);
        }
        return this.getAggregatedMetricsPostgres(filter);
    }
    static async getSystemStats() {
        if ((0, database_1.getIsInMemoryMode)()) {
            const stats = {
                total_raw_received: database_1.inMemoryDb.rawEvents.length,
                total_processed: database_1.inMemoryDb.rawEvents.filter(e => e.status === 'PROCESSED').length,
                total_duplicates: database_1.inMemoryDb.rawEvents.filter(e => e.status === 'DUPLICATE').length,
                total_rejected: database_1.inMemoryDb.rawEvents.filter(e => e.status === 'REJECTED').length,
                total_failed: database_1.inMemoryDb.rawEvents.filter(e => e.status === 'FAILED').length,
            };
            return stats;
        }
        const res = await (0, database_1.query)(`
      SELECT 
        COUNT(*) as total_raw_received,
        COUNT(*) FILTER (WHERE status = 'PROCESSED') as total_processed,
        COUNT(*) FILTER (WHERE status = 'DUPLICATE') as total_duplicates,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as total_rejected,
        COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed
      FROM raw_events
    `);
        const row = res.rows[0] || {};
        return {
            total_raw_received: parseInt(row.total_raw_received || '0', 10),
            total_processed: parseInt(row.total_processed || '0', 10),
            total_duplicates: parseInt(row.total_duplicates || '0', 10),
            total_rejected: parseInt(row.total_rejected || '0', 10),
            total_failed: parseInt(row.total_failed || '0', 10)
        };
    }
    // --- In-Memory Aggregations ---
    static getAggregatedMetricsInMemory(filter) {
        let events = [...database_1.inMemoryDb.normalizedEvents];
        if (filter.client_id) {
            events = events.filter(e => e.client_id.toLowerCase() === filter.client_id.toLowerCase());
        }
        if (filter.metric) {
            events = events.filter(e => e.metric.toLowerCase() === filter.metric.toLowerCase());
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
        // Group by (client_id, metric)
        const groups = new Map();
        for (const e of events) {
            const key = `${e.client_id}::${e.metric}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(e);
        }
        const summaries = [];
        for (const [key, groupEvents] of groups.entries()) {
            const [clientId, metric] = key.split('::');
            const amounts = groupEvents.map(e => Number(e.amount));
            const dates = groupEvents.map(e => e.timestamp.getTime()).sort((a, b) => a - b);
            const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
            const count = amounts.length;
            summaries.push({
                client_id: clientId,
                metric,
                total_events: count,
                total_amount: Math.round(totalAmount * 100) / 100,
                avg_amount: count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0,
                min_amount: Math.min(...amounts),
                max_amount: Math.max(...amounts),
                first_event_at: new Date(dates[0]).toISOString(),
                last_event_at: new Date(dates[dates.length - 1]).toISOString()
            });
        }
        return summaries;
    }
    // --- PostgreSQL Aggregations ---
    static async getAggregatedMetricsPostgres(filter) {
        const conditions = [];
        const params = [];
        let paramIdx = 1;
        if (filter.client_id) {
            conditions.push(`LOWER(client_id) = LOWER($${paramIdx++})`);
            params.push(filter.client_id);
        }
        if (filter.metric) {
            conditions.push(`LOWER(metric) = LOWER($${paramIdx++})`);
            params.push(filter.metric);
        }
        if (filter.start_date) {
            conditions.push(`timestamp >= $${paramIdx++}`);
            params.push(filter.start_date);
        }
        if (filter.end_date) {
            conditions.push(`timestamp <= $${paramIdx++}`);
            params.push(filter.end_date);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
      SELECT 
        client_id,
        metric,
        COUNT(*)::INT as total_events,
        SUM(amount)::FLOAT as total_amount,
        AVG(amount)::FLOAT as avg_amount,
        MIN(amount)::FLOAT as min_amount,
        MAX(amount)::FLOAT as max_amount,
        MIN(timestamp) as first_event_at,
        MAX(timestamp) as last_event_at
      FROM normalized_events
      ${whereClause}
      GROUP BY client_id, metric
      ORDER BY client_id, metric
    `;
        const res = await (0, database_1.query)(sql, params);
        return res.rows.map(r => ({
            client_id: r.client_id,
            metric: r.metric,
            total_events: r.total_events,
            total_amount: Math.round(r.total_amount * 100) / 100,
            avg_amount: Math.round(r.avg_amount * 100) / 100,
            min_amount: r.min_amount,
            max_amount: r.max_amount,
            first_event_at: new Date(r.first_event_at).toISOString(),
            last_event_at: new Date(r.last_event_at).toISOString()
        }));
    }
}
exports.AggregationService = AggregationService;
