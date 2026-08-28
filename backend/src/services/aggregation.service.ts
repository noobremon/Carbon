import { getIsInMemoryMode, inMemoryDb, query } from '../config/database';

export interface AggregationFilter {
  client_id?: string;
  metric?: string;
  start_date?: string;
  end_date?: string;
}

export interface MetricSummary {
  client_id: string;
  metric: string;
  total_events: number;
  total_amount: number;
  avg_amount: number;
  min_amount: number;
  max_amount: number;
  first_event_at: string;
  last_event_at: string;
}

export interface SystemStats {
  total_raw_received: number;
  total_processed: number;
  total_duplicates: number;
  total_rejected: number;
  total_failed: number;
}

export class AggregationService {
  /**
   * Calculates aggregated metrics over normalized canonical events.
   * Supports filtering by client_id, metric, and date range.
   */
  static async getAggregatedMetrics(filter: AggregationFilter = {}): Promise<MetricSummary[]> {
    if (getIsInMemoryMode()) {
      return this.getAggregatedMetricsInMemory(filter);
    }
    return this.getAggregatedMetricsPostgres(filter);
  }

  static async getSystemStats(): Promise<SystemStats> {
    if (getIsInMemoryMode()) {
      const stats: SystemStats = {
        total_raw_received: inMemoryDb.rawEvents.length,
        total_processed: inMemoryDb.rawEvents.filter(e => e.status === 'PROCESSED').length,
        total_duplicates: inMemoryDb.rawEvents.filter(e => e.status === 'DUPLICATE').length,
        total_rejected: inMemoryDb.rawEvents.filter(e => e.status === 'REJECTED').length,
        total_failed: inMemoryDb.rawEvents.filter(e => e.status === 'FAILED').length,
      };
      return stats;
    }

    const res = await query(`
      SELECT 
        COUNT(*) as total_raw_received,
        COUNT(*) FILTER (WHERE status = 'PROCESSED') as total_processed,
        COUNT(*) FILTER (WHERE status = 'DUPLICATE') as total_duplicates,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as total_rejected,
        COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed
      FROM raw_events
    `);

    const row = res.rows[0] || {};
    return {
      total_raw_received: parseInt(row.total_raw_received || '0', 10),
      total_processed: parseInt(row.total_processed || '0', 10),
      total_duplicates: parseInt(row.total_duplicates || '0', 10),
      total_rejected: parseInt(row.total_rejected || '0', 10),
      total_failed: parseInt(row.total_failed || '0', 10)
    };
  }

  // --- In-Memory Aggregations ---
  private static getAggregatedMetricsInMemory(filter: AggregationFilter): MetricSummary[] {
    let events = [...inMemoryDb.normalizedEvents];

    if (filter.client_id) {
      events = events.filter(e => e.client_id.toLowerCase() === filter.client_id!.toLowerCase());
    }
    if (filter.metric) {
      events = events.filter(e => e.metric.toLowerCase() === filter.metric!.toLowerCase());
    }
    if (filter.start_date) {
      const start = new Date(filter.start_date).getTime();
      if (!isNaN(start)) {
        events = events.filter(e => e.timestamp.getTime() >= start);
      }
    }
    if (filter.end_date) {
      const end = new Date(filter.end_date).getTime();
      if (!isNaN(end)) {
        events = events.filter(e => e.timestamp.getTime() <= end);
      }
    }

    // Group by (client_id, metric)
    const groups = new Map<string, typeof events>();
    for (const e of events) {
      const key = `${e.client_id}::${e.metric}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(e);
    }

    const summaries: MetricSummary[] = [];
    for (const [key, groupEvents] of groups.entries()) {
      const [clientId, metric] = key.split('::');
      const amounts = groupEvents.map(e => Number(e.amount));
      const dates = groupEvents.map(e => e.timestamp.getTime()).sort((a, b) => a - b);
      
      const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
      const count = amounts.length;

      summaries.push({
        client_id: clientId,
        metric,
        total_events: count,
        total_amount: Math.round(totalAmount * 100) / 100,
        avg_amount: count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0,
        min_amount: Math.min(...amounts),
        max_amount: Math.max(...amounts),
        first_event_at: new Date(dates[0]).toISOString(),
        last_event_at: new Date(dates[dates.length - 1]).toISOString()
      });
    }

    return summaries;
  }

  // --- PostgreSQL Aggregations ---
  private static async getAggregatedMetricsPostgres(filter: AggregationFilter): Promise<MetricSummary[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filter.client_id) {
      conditions.push(`LOWER(client_id) = LOWER($${paramIdx++})`);
      params.push(filter.client_id);
    }
    if (filter.metric) {
      conditions.push(`LOWER(metric) = LOWER($${paramIdx++})`);
      params.push(filter.metric);
    }
    if (filter.start_date) {
      conditions.push(`timestamp >= $${paramIdx++}`);
      params.push(filter.start_date);
    }
    if (filter.end_date) {
      conditions.push(`timestamp <= $${paramIdx++}`);
      params.push(filter.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        client_id,
        metric,
        COUNT(*)::INT as total_events,
        SUM(amount)::FLOAT as total_amount,
        AVG(amount)::FLOAT as avg_amount,
        MIN(amount)::FLOAT as min_amount,
        MAX(amount)::FLOAT as max_amount,
        MIN(timestamp) as first_event_at,
        MAX(timestamp) as last_event_at
      FROM normalized_events
      ${whereClause}
      GROUP BY client_id, metric
      ORDER BY client_id, metric
    `;

    const res = await query(sql, params);
    return res.rows.map(r => ({
      client_id: r.client_id,
      metric: r.metric,
      total_events: r.total_events,
      total_amount: Math.round(r.total_amount * 100) / 100,
      avg_amount: Math.round(r.avg_amount * 100) / 100,
      min_amount: r.min_amount,
      max_amount: r.max_amount,
      first_event_at: new Date(r.first_event_at).toISOString(),
      last_event_at: new Date(r.last_event_at).toISOString()
    }));
  }
}
