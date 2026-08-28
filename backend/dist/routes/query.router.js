"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const aggregation_service_1 = require("../services/aggregation.service");
const router = (0, express_1.Router)();
/**
 * GET /api/events/processed
 * Returns normalized canonical events
 */
router.get('/processed', async (req, res) => {
    try {
        if ((0, database_1.getIsInMemoryMode)()) {
            return res.json({
                success: true,
                count: database_1.inMemoryDb.normalizedEvents.length,
                events: database_1.inMemoryDb.normalizedEvents
            });
        }
        const dbRes = await (0, database_1.query)(`
      SELECT 
        id, raw_event_id, fingerprint, client_id, metric, 
        amount::FLOAT as amount, timestamp, created_at, extra_fields
      FROM normalized_events
      ORDER BY id DESC
      LIMIT 100
    `);
        return res.json({
            success: true,
            count: dbRes.rowCount,
            events: dbRes.rows
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/events/rejected
 * Returns raw events with status REJECTED or FAILED
 */
router.get('/rejected', async (req, res) => {
    try {
        if ((0, database_1.getIsInMemoryMode)()) {
            const rejected = database_1.inMemoryDb.rawEvents.filter(e => e.status === 'REJECTED' || e.status === 'FAILED');
            return res.json({
                success: true,
                count: rejected.length,
                events: rejected
            });
        }
        const dbRes = await (0, database_1.query)(`
      SELECT id, received_at, raw_payload, status, error_message, fingerprint
      FROM raw_events
      WHERE status IN ('REJECTED', 'FAILED')
      ORDER BY id DESC
      LIMIT 100
    `);
        return res.json({
            success: true,
            count: dbRes.rowCount,
            events: dbRes.rows
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/events/raw
 * Returns all raw ingest log records
 */
router.get('/raw', async (req, res) => {
    try {
        if ((0, database_1.getIsInMemoryMode)()) {
            return res.json({
                success: true,
                count: database_1.inMemoryDb.rawEvents.length,
                events: database_1.inMemoryDb.rawEvents
            });
        }
        const dbRes = await (0, database_1.query)(`
      SELECT id, received_at, raw_payload, status, error_message, fingerprint
      FROM raw_events
      ORDER BY id DESC
      LIMIT 100
    `);
        return res.json({
            success: true,
            count: dbRes.rowCount,
            events: dbRes.rows
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/metrics/aggregate
 * Exposes aggregated metric summary outputs with optional filtering
 */
router.get('/metrics/aggregate', async (req, res) => {
    try {
        const { client_id, metric, start_date, end_date } = req.query;
        const summaries = await aggregation_service_1.AggregationService.getAggregatedMetrics({
            client_id: client_id ? String(client_id) : undefined,
            metric: metric ? String(metric) : undefined,
            start_date: start_date ? String(start_date) : undefined,
            end_date: end_date ? String(end_date) : undefined
        });
        return res.json({
            success: true,
            count: summaries.length,
            filters: { client_id, metric, start_date, end_date },
            metrics: summaries
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/metrics/stats
 * High-level system statistics (processed vs rejected vs duplicates vs failed counts)
 */
router.get('/metrics/stats', async (req, res) => {
    try {
        const stats = await aggregation_service_1.AggregationService.getSystemStats();
        return res.json({
            success: true,
            stats
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
