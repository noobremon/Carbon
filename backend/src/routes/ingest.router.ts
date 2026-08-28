import { Router } from 'express';
import { IngestService } from '../services/ingest.service';

const router = Router();

/**
 * POST /api/events/ingest
 * Accepts raw client JSON events. Normalizes, deduplicates, and stores canonically.
 */
router.post('/ingest', async (req, res) => {
  try {
    const rawPayload = req.body;
    const simulateFailure = req.headers['x-simulate-failure'] === 'true';

    const result = await IngestService.ingestEvent(rawPayload, simulateFailure);

    if (result.status === 'REJECTED') {
      return res.status(400).json(result);
    }

    if (result.status === 'FAILED') {
      return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      status: 'FAILED',
      error: `Unexpected ingest failure: ${err.message}`
    });
  }
});

export default router;
