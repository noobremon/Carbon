import { Router } from 'express';
import { EventController } from '../controllers/event.controller';

const router = Router();

// Primary Assignment Endpoints
router.post('/events', EventController.ingestEvent);
router.get('/events', EventController.getRecentEvents);
router.get('/aggregates', EventController.getAggregates);

// Backwards-compatible aliases
router.post('/events/ingest', EventController.ingestEvent);

export default router;
