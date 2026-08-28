import { getDbClient, getIsInMemoryMode } from '../config/database';
import { IngestResponse } from '../domain/canonical';
import { EventRepository } from '../repositories/event.repository';
import { FingerprintService } from './fingerprint.service';
import { NormalizerService } from './normalizer.service';

export class IngestService {
  private static failureSimulationMode = false;

  static setFailureSimulation(enable: boolean) {
    this.failureSimulationMode = enable;
  }

  static getFailureSimulation(): boolean {
    return this.failureSimulationMode;
  }

  static async ingestEvent(rawPayload: any, simulateFailureOverride = false): Promise<IngestResponse> {
    const shouldSimulateFailure = simulateFailureOverride || this.failureSimulationMode;

    // Step 1: Immutable Raw Event Capture
    const rawId = await EventRepository.createRawEvent(rawPayload, 'RECEIVED');

    // Step 2: Normalization & Type Coercion
    const normResult = NormalizerService.normalize(rawPayload);
    if (!normResult.success || !normResult.event) {
      const errorMsg = normResult.error || 'Schema validation rejected payload';
      await EventRepository.updateRawEvent(rawId, 'REJECTED', errorMsg);
      return {
        success: false,
        status: 'REJECTED',
        raw_event_id: rawId,
        error: errorMsg
      };
    }

    const event = normResult.event;

    // Step 3: Fingerprint Generation for Deduplication
    const fingerprint = FingerprintService.generateFingerprint(event);

    // Step 4: Atomic DB Transaction Execution
    if (getIsInMemoryMode()) {
      try {
        if (shouldSimulateFailure) {
          throw new Error('Simulated database write failure mid-request');
        }

        const { inserted } = await EventRepository.insertNormalizedEventAtomic(
          rawId,
          fingerprint,
          event,
          null,
          false
        );

        if (!inserted) {
          await EventRepository.updateRawEvent(rawId, 'DUPLICATE', null, fingerprint);
          return {
            success: true,
            status: 'DUPLICATE',
            raw_event_id: rawId,
            fingerprint,
            normalized_event: event,
            message: 'Duplicate event detected via fingerprint constraint; skipped duplicate insert'
          };
        }

        await EventRepository.updateRawEvent(rawId, 'PROCESSED', null, fingerprint);
        return {
          success: true,
          status: 'PROCESSED',
          raw_event_id: rawId,
          fingerprint,
          normalized_event: event,
          message: 'Successfully normalized and stored canonical event'
        };

      } catch (err: any) {
        await EventRepository.updateRawEvent(rawId, 'FAILED', err.message, fingerprint);
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
    const client = await getDbClient();
    if (!client) {
      throw new Error('Database client connection failed');
    }

    try {
      await client.query('BEGIN');

      await EventRepository.updateRawEvent(rawId, 'RECEIVED', null, fingerprint, client);

      if (shouldSimulateFailure) {
        throw new Error('Simulated database write failure mid-request');
      }

      const { inserted } = await EventRepository.insertNormalizedEventAtomic(
        rawId,
        fingerprint,
        event,
        client,
        false
      );

      if (!inserted) {
        await client.query('COMMIT');
        await EventRepository.updateRawEvent(rawId, 'DUPLICATE', null, fingerprint);
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

      await EventRepository.updateRawEvent(rawId, 'PROCESSED', null, fingerprint, client);
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

    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();

      await EventRepository.updateRawEvent(rawId, 'FAILED', err.message, fingerprint);

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
