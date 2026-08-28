"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ingest_service_1 = require("../services/ingest.service");
const event_repository_1 = require("../repositories/event.repository");
const database_1 = require("../config/database");
describe('Exact 10-Step Failure, Retry, Deduplication & Aggregation Lifecycle Test', () => {
    beforeEach(() => {
        database_1.inMemoryDb.reset();
        ingest_service_1.IngestService.setFailureSimulation(false);
    });
    test('Executes exact 10-step resilience scenario', async () => {
        const eventE = {
            source: "client_TEST_LIFECYCLE",
            payload: {
                metric: "payment_transaction",
                amount: "750.50",
                timestamp: "2024-01-01T12:00:00Z"
            }
        };
        console.log('--- Step 1 & 2: Submit event E with simulated DB failure ---');
        ingest_service_1.IngestService.setFailureSimulation(true);
        const res1 = await ingest_service_1.IngestService.ingestEvent(eventE);
        console.log('--- Step 3: Verify request fails ---');
        expect(res1.success).toBe(false);
        expect(res1.status).toBe('FAILED');
        expect(res1.error).toContain('Simulated database write failure');
        console.log('--- Step 4: Verify no successful event was persisted/countable ---');
        const aggsStep4 = await event_repository_1.EventRepository.queryAggregates({ client_id: 'client_TEST_LIFECYCLE' });
        expect(aggsStep4[0].event_count).toBe(0);
        expect(aggsStep4[0].total_amount).toBe(0);
        console.log('--- Step 5 & 6: Disable simulated failure & submit exact same event E again ---');
        ingest_service_1.IngestService.setFailureSimulation(false);
        const res2 = await ingest_service_1.IngestService.ingestEvent(eventE);
        console.log('--- Step 7: Verify it succeeds ---');
        expect(res2.success).toBe(true);
        expect(res2.status).toBe('PROCESSED');
        expect(res2.normalized_event?.amount).toBe(750.50);
        console.log('--- Step 8: Submit E a third time ---');
        const res3 = await ingest_service_1.IngestService.ingestEvent(eventE);
        console.log('--- Step 9: Verify it is identified as duplicate ---');
        expect(res3.success).toBe(true);
        expect(res3.status).toBe('DUPLICATE');
        console.log('--- Step 10: Verify aggregation counts E exactly once ---');
        const aggsStep10 = await event_repository_1.EventRepository.queryAggregates({ client_id: 'client_TEST_LIFECYCLE' });
        expect(aggsStep10.length).toBe(1);
        expect(aggsStep10[0].event_count).toBe(1);
        expect(aggsStep10[0].total_amount).toBe(750.50);
        console.log('✅ ALL 10 STEPS VERIFIED PERFECTLY!');
    });
});
