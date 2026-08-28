import { Request, Response } from 'express';
import { EventRepository } from '../repositories/event.repository';
import { IngestService } from '../services/ingest.service';

export class EventController {
  /**
   * POST /api/events
   * Primary ingestion endpoint
   */
  static async ingestEvent(req: Request, res: Response) {
    try {
      const rawPayload = req.body;
      const simulateFailureHeader = req.headers['x-simulate-failure'] === 'true';

      const result = await IngestService.ingestEvent(rawPayload, simulateFailureHeader);

      if (result.status === 'REJECTED') {
        return res.status(400).json(result);
      }
      if (result.status === 'FAILED') {
        return res.status(500).json(result);
      }

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('Unhandled Controller Error in ingestEvent:', err);
      return res.status(500).json({
        success: false,
        status: 'FAILED',
        error: 'Internal server processing error'
      });
    }
  }

  /**
   * GET /api/events
   * Returns recent events including status, client, amount, timestamp, and error info
   */
  static async getRecentEvents(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const events = await EventRepository.findRecentEvents(limit);
      return res.status(200).json({
        success: true,
        count: events.length,
        events
      });
    } catch (err: any) {
      console.error('Unhandled Controller Error in getRecentEvents:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve recent events'
      });
    }
  }

  /**
   * GET /api/aggregates
   * Calculates persisted aggregate stats (event count and total amount) for successfully processed events
   */
  static async getAggregates(req: Request, res: Response) {
    try {
      const { client_id, start_date, end_date } = req.query;

      const aggregates = await EventRepository.queryAggregates({
        client_id: client_id ? String(client_id) : undefined,
        start_date: start_date ? String(start_date) : undefined,
        end_date: end_date ? String(end_date) : undefined
      });

      return res.status(200).json({
        success: true,
        filters: { client_id, start_date, end_date },
        aggregates
      });
    } catch (err: any) {
      console.error('Unhandled Controller Error in getAggregates:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to calculate aggregate metrics'
      });
    }
  }
}
