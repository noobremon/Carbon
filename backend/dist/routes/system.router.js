"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const ingest_service_1 = require("../services/ingest.service");
const router = (0, express_1.Router)();
/**
 * GET /api/system/failure-mode
 * Gets current state of failure simulation mode
 */
router.get('/failure-mode', (req, res) => {
    return res.json({
        simulate_failure: ingest_service_1.IngestService.getFailureSimulation()
    });
});
/**
 * POST /api/system/failure-mode
 * Toggles failure simulation mode ON or OFF
 */
router.post('/failure-mode', (req, res) => {
    const { enable } = req.body;
    const targetState = Boolean(enable);
    ingest_service_1.IngestService.setFailureSimulation(targetState);
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
    database_1.inMemoryDb.reset();
    return res.json({
        success: true,
        message: 'Test state successfully reset'
    });
});
exports.default = router;
