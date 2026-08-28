"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ingest_service_1 = require("../services/ingest.service");
const router = (0, express_1.Router)();
/**
 * POST /api/events/ingest
 * Accepts raw client JSON events. Normalizes, deduplicates, and stores canonically.
 */
router.post('/ingest', async (req, res) => {
    try {
        const rawPayload = req.body;
        const simulateFailure = req.headers['x-simulate-failure'] === 'true';
        const result = await ingest_service_1.IngestService.ingestEvent(rawPayload, simulateFailure);
        if (result.status === 'REJECTED') {
            return res.status(400).json(result);
        }
        if (result.status === 'FAILED') {
            return res.status(500).json(result);
        }
        return res.status(200).json(result);
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            status: 'FAILED',
            error: `Unexpected ingest failure: ${err.message}`
        });
    }
});
exports.default = router;
