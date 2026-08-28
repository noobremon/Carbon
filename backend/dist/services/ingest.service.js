"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestService = void 0;
const database_1 = require("../config/database");
const event_repository_1 = require("../repositories/event.repository");
const fingerprint_service_1 = require("./fingerprint.service");
const normalizer_service_1 = require("./normalizer.service");
class IngestService {
    static failureSimulationMode = false;
    static setFailureSimulation(enable) {
        this.failureSimulationMode = enable;
    }
    static getFailureSimulation() {
        return this.failureSimulationMode;
    }
    static async ingestEvent(rawPayload, simulateFailureOverride = false) {
        const shouldSimulateFailure = simulateFailureOverride || this.failureSimulationMode;
        // Step 1: Immutable Raw Event Capture
        const rawId = await event_repository_1.EventRepository.createRawEvent(rawPayload, 'RECEIVED');
        // Step 2: Normalization & Type Coercion
        const normResult = normalizer_service_1.NormalizerService.normalize(rawPayload);
        if (!normResult.success || !normResult.event) {
            const errorMsg = normResult.error || 'Schema validation rejected payload';
            await event_repository_1.EventRepository.updateRawEvent(rawId, 'REJECTED', errorMsg);
            return {
                success: false,
                status: 'REJECTED',
                raw_event_id: rawId,
                error: errorMsg
            };
        }
        const event = normResult.event;
        // Step 3: Fingerprint Generation for Deduplication
        const fingerprint = fingerprint_service_1.FingerprintService.generateFingerprint(event);
        // Step 4: Atomic DB Transaction Execution
        if ((0, database_1.getIsInMemoryMode)()) {
            try {
                if (shouldSimulateFailure) {
                    throw new Error('Simulated database write failure mid-request');
                }
                const { inserted } = await event_repository_1.EventRepository.insertNormalizedEventAtomic(rawId, fingerprint, event, null, false);
                if (!inserted) {
                    await event_repository_1.EventRepository.updateRawEvent(rawId, 'DUPLICATE', null, fingerprint);
                    return {
                        success: true,
                        status: 'DUPLICATE',
                        raw_event_id: rawId,
                        fingerprint,
                        normalized_event: event,
                        message: 'Duplicate event detected via fingerprint constraint; skipped duplicate insert'
                    };
                }
                await event_repository_1.EventRepository.updateRawEvent(rawId, 'PROCESSED', null, fingerprint);
                return {
                    success: true,
                    status: 'PROCESSED',
                    raw_event_id: rawId,
                    fingerprint,
                    normalized_event: event,
                    message: 'Successfully normalized and stored canonical event'
                };
            }
            catch (err) {
                await event_repository_1.EventRepository.updateRawEvent(rawId, 'FAILED', err.message, fingerprint);
                return {
                    success: false,
                    status: 'FAILED',
                    raw_event_id: rawId,
                    fingerprint,
                    error: `Database write failure: ${err.message}`
                };
            }
        }
        // PostgreSQL Execution Path with Transaction Isolation
        const client = await (0, database_1.getDbClient)();
        if (!client) {
            throw new Error('Database client connection failed');
        }
        try {
            await client.query('BEGIN');
            await event_repository_1.EventRepository.updateRawEvent(rawId, 'RECEIVED', null, fingerprint, client);
            if (shouldSimulateFailure) {
                throw new Error('Simulated database write failure mid-request');
            }
            const { inserted } = await event_repository_1.EventRepository.insertNormalizedEventAtomic(rawId, fingerprint, event, client, false);
            if (!inserted) {
                await client.query('COMMIT');
                await event_repository_1.EventRepository.updateRawEvent(rawId, 'DUPLICATE', null, fingerprint);
                client.release();
                return {
                    success: true,
                    status: 'DUPLICATE',
                    raw_event_id: rawId,
                    fingerprint,
                    normalized_event: event,
                    message: 'Duplicate event detected via fingerprint constraint; skipped duplicate insert'
                };
            }
            await event_repository_1.EventRepository.updateRawEvent(rawId, 'PROCESSED', null, fingerprint, client);
            await client.query('COMMIT');
            client.release();
            return {
                success: true,
                status: 'PROCESSED',
                raw_event_id: rawId,
                fingerprint,
                normalized_event: event,
                message: 'Successfully normalized and stored canonical event'
            };
        }
        catch (err) {
            await client.query('ROLLBACK').catch(() => { });
            client.release();
            await event_repository_1.EventRepository.updateRawEvent(rawId, 'FAILED', err.message, fingerprint);
            return {
                success: false,
                status: 'FAILED',
                raw_event_id: rawId,
                fingerprint,
                error: `Database transaction error: ${err.message}`
            };
        }
    }
}
exports.IngestService = IngestService;
