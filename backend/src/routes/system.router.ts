import { Router } from 'express';
import { inMemoryDb } from '../config/database';
import { IngestService } from '../services/ingest.service';

const router = Router();

/**
 * GET /api/system/failure-mode
 * Gets current state of failure simulation mode
 */
router.get('/failure-mode', (req, res) => {
  return res.json({
    simulate_failure: IngestService.getFailureSimulation()
  });
});

/**
 * POST /api/system/failure-mode
 * Toggles failure simulation mode ON or OFF
 */
router.post('/failure-mode', (req, res) => {
  const { enable } = req.body;
  const targetState = Boolean(enable);
  IngestService.setFailureSimulation(targetState);
  return res.json({
    success: true,
    simulate_failure: targetState,
    message: `Failure simulation mode is now ${targetState ? 'ENABLED 🔴' : 'DISABLED 🟢'}`
  });
});

/**
 * POST /api/system/reset
 * Helper to clear test data in in-memory mode
 */
router.post('/reset', (req, res) => {
  inMemoryDb.reset();
  return res.json({
    success: true,
    message: 'Test state successfully reset'
  });
});

export default router;
