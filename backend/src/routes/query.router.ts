import { Router } from 'express';
import { getIsInMemoryMode, inMemoryDb, query } from '../config/database';
import { AggregationService } from '../services/aggregation.service';

const router = Router();

/**
 * GET /api/events/processed
 * Returns normalized canonical events
 */
router.get('/processed', async (req, res) => {
  try {
    if (getIsInMemoryMode()) {
      return res.json({
        success: true,
        count: inMemoryDb.normalizedEvents.length,
        events: inMemoryDb.normalizedEvents
      });
    }

    const dbRes = await query(`
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events/rejected
 * Returns raw events with status REJECTED or FAILED
 */
router.get('/rejected', async (req, res) => {
  try {
    if (getIsInMemoryMode()) {
      const rejected = inMemoryDb.rawEvents.filter(e => e.status === 'REJECTED' || e.status === 'FAILED');
      return res.json({
        success: true,
        count: rejected.length,
        events: rejected
      });
    }

    const dbRes = await query(`
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events/raw
 * Returns all raw ingest log records
 */
router.get('/raw', async (req, res) => {
  try {
    if (getIsInMemoryMode()) {
      return res.json({
        success: true,
        count: inMemoryDb.rawEvents.length,
        events: inMemoryDb.rawEvents
      });
    }

    const dbRes = await query(`
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
  } catch (err: any) {
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
    
    const summaries = await AggregationService.getAggregatedMetrics({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/metrics/stats
 * High-level system statistics (processed vs rejected vs duplicates vs failed counts)
 */
router.get('/metrics/stats', async (req, res) => {
  try {
    const stats = await AggregationService.getSystemStats();
    return res.json({
      success: true,
      stats
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
