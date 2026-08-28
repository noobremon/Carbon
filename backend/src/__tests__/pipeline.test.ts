import { describe, test, expect, beforeEach } from '@jest/globals';
import { NormalizerService } from '../services/normalizer.service';
import { FingerprintService } from '../services/fingerprint.service';
import { IngestService } from '../services/ingest.service';
import { EventRepository } from '../repositories/event.repository';
import { inMemoryDb } from '../config/database';

describe('Fault-Tolerant Data Processing System - Comprehensive Test Suite', () => {
  beforeEach(() => {
    inMemoryDb.reset();
    IngestService.setFailureSimulation(false);
  });

  test('1. Valid event normalization & ingestion', async () => {
    const rawPayload = {
      source: "client_A",
      payload: {
        metric: "purchase",
        amount: 150.00,
        timestamp: "2024-01-01T12:00:00Z"
      }
    };

    const res = await IngestService.ingestEvent(rawPayload);
    expect(res.success).toBe(true);
    expect(res.status).toBe('PROCESSED');
    expect(res.normalized_event?.client_id).toBe('client_A');
    expect(res.normalized_event?.amount).toBe(150.00);
  });

  test('2. String-to-number normalization ($1,200.50 -> 1200.5)', () => {
    const rawPayload = {
      client: "client_B",
      payload: {
        metric: "checkout",
        amount: "$1,200.50",
        timestamp: "2024-01-01T12:00:00Z"
      }
    };

    const normRes = NormalizerService.normalize(rawPayload);
    expect(normRes.success).toBe(true);
    expect(normRes.event?.amount).toBe(1200.5);
  });

  test('3. Date normalization to UTC ISO format ("2024/01/01" -> "2024-01-01T00:00:00.000Z")', () => {
    const rawPayload = {
      source: "client_A",
      payload: {
        metric: "login",
        amount: "0",
        timestamp: "2024/01/01"
      }
    };

    const normRes = NormalizerService.normalize(rawPayload);
    expect(normRes.success).toBe(true);
    expect(normRes.event?.timestamp).toBe("2024-01-01T00:00:00.000Z");
  });

  test('4. Extra fields preservation in extra_fields object', () => {
    const rawPayload = {
      source: "client_A",
      payload: {
        metric: "signup",
        amount: "0",
        timestamp: "2024-01-01T12:00:00Z",
        referral_code: "SUMMER2026",
        device: "iOS"
      }
    };

    const normRes = NormalizerService.normalize(rawPayload);
    expect(normRes.success).toBe(true);
    expect(normRes.event?.extra_fields).toEqual({
      referral_code: "SUMMER2026",
      device: "iOS"
    });
  });

  test('5. Rejects malformed input missing required metric/amount', async () => {
    const rawPayload = {
      source: "client_A",
      payload: {
        amount: "invalid_string_amount"
      }
    };

    const res = await IngestService.ingestEvent(rawPayload);
    expect(res.success).toBe(false);
    expect(res.status).toBe('REJECTED');
    expect(res.error).toContain('Validation error');
  });

  test('6. Sequential duplicate submission prevention (Fingerprint Match)', async () => {
    const rawPayload = {
      source: "client_A",
      payload: {
        metric: "subscription",
        amount: "99.99",
        timestamp: "2024-01-01T12:00:00Z"
      }
    };

    const res1 = await IngestService.ingestEvent(rawPayload);
    expect(res1.status).toBe('PROCESSED');

    const res2 = await IngestService.ingestEvent(rawPayload);
    expect(res2.status).toBe('DUPLICATE');
    expect(res2.success).toBe(true);

    const aggregates = await EventRepository.queryAggregates({ client_id: 'client_A' });
    expect(aggregates[0].event_count).toBe(1);
    expect(aggregates[0].total_amount).toBe(99.99);
  });

  test('7. Concurrent duplicate submission handling', async () => {
    const rawPayload = {
      source: "client_CONCURRENT",
      payload: {
        metric: "payment",
        amount: "500.00",
        timestamp: "2024-01-01T15:00:00Z"
      }
    };

    // Fire 5 simultaneous requests
    const promises = Array.from({ length: 5 }).map(() => IngestService.ingestEvent(rawPayload));
    const results = await Promise.all(promises);

    const processedCount = results.filter(r => r.status === 'PROCESSED').length;
    const duplicateCount = results.filter(r => r.status === 'DUPLICATE').length;

    expect(processedCount).toBe(1);
    expect(duplicateCount).toBe(4);

    const aggregates = await EventRepository.queryAggregates({ client_id: 'client_CONCURRENT' });
    expect(aggregates[0].event_count).toBe(1);
    expect(aggregates[0].total_amount).toBe(500.00);
  });

  test('8. Simulated database failure mid-request', async () => {
    IngestService.setFailureSimulation(true);

    const rawPayload = {
      source: "client_FAIL",
      payload: {
        metric: "refund",
        amount: "200.00",
        timestamp: "2024-01-01T12:00:00Z"
      }
    };

    const res = await IngestService.ingestEvent(rawPayload);
    expect(res.success).toBe(false);
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('Simulated database write failure');

    // Verify aggregate count is 0 (no partial state committed)
    const aggregates = await EventRepository.queryAggregates({ client_id: 'client_FAIL' });
    expect(aggregates[0].event_count).toBe(0);
    expect(aggregates[0].total_amount).toBe(0);
  });

  test('9. Successful retry after simulated database failure', async () => {
    IngestService.setFailureSimulation(true);

    const rawPayload = {
      source: "client_RETRY",
      payload: {
        metric: "order",
        amount: "350.00",
        timestamp: "2024-01-01T12:00:00Z"
      }
    };

    // 1st attempt fails
    const res1 = await IngestService.ingestEvent(rawPayload);
    expect(res1.status).toBe('FAILED');

    // Disable failure mode & retry 2nd attempt
    IngestService.setFailureSimulation(false);
    const res2 = await IngestService.ingestEvent(rawPayload);
    expect(res2.status).toBe('PROCESSED');
    expect(res2.success).toBe(true);

    const aggregates = await EventRepository.queryAggregates({ client_id: 'client_RETRY' });
    expect(aggregates[0].event_count).toBe(1);
    expect(aggregates[0].total_amount).toBe(350.00);
  });

  test('10. Aggregation correctness (filtering by client & date range)', async () => {
    // Ingest events for client_X and client_Y
    await IngestService.ingestEvent({
      source: "client_X",
      payload: { metric: "sale", amount: "100", timestamp: "2024-01-01T10:00:00Z" }
    });
    await IngestService.ingestEvent({
      source: "client_X",
      payload: { metric: "sale", amount: "200", timestamp: "2024-01-02T10:00:00Z" }
    });
    await IngestService.ingestEvent({
      source: "client_Y",
      payload: { metric: "sale", amount: "500", timestamp: "2024-01-01T10:00:00Z" }
    });

    // 1. All aggregates
    const allAggs = await EventRepository.queryAggregates({});
    expect(allAggs.length).toBe(2);

    // 2. Filter by client_X
    const clientXAggs = await EventRepository.queryAggregates({ client_id: 'client_X' });
    expect(clientXAggs.length).toBe(1);
    expect(clientXAggs[0].event_count).toBe(2);
    expect(clientXAggs[0].total_amount).toBe(300);

    // 3. Filter by date range (2024-01-01 only)
    const dateAggs = await EventRepository.queryAggregates({
      client_id: 'client_X',
      start_date: '2024-01-01T00:00:00Z',
      end_date: '2024-01-01T23:59:59Z'
    });
    expect(dateAggs[0].event_count).toBe(1);
    expect(dateAggs[0].total_amount).toBe(100);
  });
});
