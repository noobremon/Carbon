import { describe, test, expect, beforeEach } from '@jest/globals';
import { IngestService } from '../services/ingest.service';
import { EventRepository } from '../repositories/event.repository';
import { inMemoryDb } from '../config/database';

describe('Exact 10-Step Failure, Retry, Deduplication & Aggregation Lifecycle Test', () => {
  beforeEach(() => {
    inMemoryDb.reset();
    IngestService.setFailureSimulation(false);
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
    IngestService.setFailureSimulation(true);
    const res1 = await IngestService.ingestEvent(eventE);

    console.log('--- Step 3: Verify request fails ---');
    expect(res1.success).toBe(false);
    expect(res1.status).toBe('FAILED');
    expect(res1.error).toContain('Simulated database write failure');

    console.log('--- Step 4: Verify no successful event was persisted/countable ---');
    const aggsStep4 = await EventRepository.queryAggregates({ client_id: 'client_TEST_LIFECYCLE' });
    expect(aggsStep4[0].event_count).toBe(0);
    expect(aggsStep4[0].total_amount).toBe(0);

    console.log('--- Step 5 & 6: Disable simulated failure & submit exact same event E again ---');
    IngestService.setFailureSimulation(false);
    const res2 = await IngestService.ingestEvent(eventE);

    console.log('--- Step 7: Verify it succeeds ---');
    expect(res2.success).toBe(true);
    expect(res2.status).toBe('PROCESSED');
    expect(res2.normalized_event?.amount).toBe(750.50);

    console.log('--- Step 8: Submit E a third time ---');
    const res3 = await IngestService.ingestEvent(eventE);

    console.log('--- Step 9: Verify it is identified as duplicate ---');
    expect(res3.success).toBe(true);
    expect(res3.status).toBe('DUPLICATE');

    console.log('--- Step 10: Verify aggregation counts E exactly once ---');
    const aggsStep10 = await EventRepository.queryAggregates({ client_id: 'client_TEST_LIFECYCLE' });
    expect(aggsStep10.length).toBe(1);
    expect(aggsStep10[0].event_count).toBe(1);
    expect(aggsStep10[0].total_amount).toBe(750.50);

    console.log('✅ ALL 10 STEPS VERIFIED PERFECTLY!');
  });
});
