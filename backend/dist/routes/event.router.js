"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const event_controller_1 = require("../controllers/event.controller");
const router = (0, express_1.Router)();
// Primary Assignment Endpoints
router.post('/events', event_controller_1.EventController.ingestEvent);
router.get('/events', event_controller_1.EventController.getRecentEvents);
router.get('/aggregates', event_controller_1.EventController.getAggregates);
// Backwards-compatible aliases
router.post('/events/ingest', event_controller_1.EventController.ingestEvent);
exports.default = router;
