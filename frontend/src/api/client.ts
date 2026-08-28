export interface RawEventEntity {
  id: number;
  received_at: string;
  raw_payload: any;
  status: 'RECEIVED' | 'PROCESSED' | 'REJECTED' | 'DUPLICATE' | 'FAILED';
  error_message?: string;
  fingerprint?: string;
  client_id?: string;
  metric?: string;
  amount?: number;
  timestamp?: string;
}

export interface AggregateResult {
  client_id?: string;
  event_count: number;
  total_amount: number;
}

export interface IngestResponse {
  success: boolean;
  status: 'PROCESSED' | 'DUPLICATE' | 'FAILED' | 'REJECTED';
  raw_event_id?: number;
  fingerprint?: string;
  normalized_event?: {
    client_id: string;
    metric: string;
    amount: number;
    timestamp: string;
    is_timestamp_fallback?: boolean;
    extra_fields?: Record<string, any>;
  };
  message?: string;
  error?: string;
  latency_ms?: number;
}

export const api = {
  /**
   * Checks backend health and connectivity
   */
  async getHealth(): Promise<{ status: string; service: string; timestamp: string }> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Backend health check failed');
    return res.json();
  },

  /**
   * POST /api/events
   * Ingest raw event JSON or raw string
   */
  async ingestEvent(payload: any, simulateFailureHeader = false): Promise<IngestResponse> {
    const startTime = performance.now();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (simulateFailureHeader) {
      headers['x-simulate-failure'] = 'true';
    }

    const bodyContent = typeof payload === 'string' ? payload : JSON.stringify(payload);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers,
        body: bodyContent
      });
      const data = await res.json();
      const latency_ms = Math.round(performance.now() - startTime);

      if (!res.ok && !data.status) {
        return {
          success: false,
          status: 'FAILED',
          error: data.error || `HTTP ${res.status}: Server error ingesting event`,
          latency_ms
        };
      }
      return {
        ...data,
        latency_ms
      };
    } catch (err: any) {
      const latency_ms = Math.round(performance.now() - startTime);
      return {
        success: false,
        status: 'FAILED',
        error: err.message || 'Network communication failure with backend',
        latency_ms
      };
    }
  },

  /**
   * GET /api/events
   * Returns recent events history
   */
  async getEvents(limit = 100): Promise<{ success: boolean; events: RawEventEntity[] }> {
    const res = await fetch(`/api/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to retrieve events');
    return res.json();
  },

  /**
   * GET /api/aggregates
   * Calculates persisted aggregate stats filtered by client & date range
   */
  async getAggregates(params?: { client_id?: string; start_date?: string; end_date?: string }): Promise<{ success: boolean; aggregates: AggregateResult[] }> {
    const query = new URLSearchParams();
    if (params?.client_id) query.append('client_id', params.client_id);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const res = await fetch(`/api/aggregates?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to retrieve aggregates');
    return res.json();
  },

  /**
   * GET /api/system/failure-mode
   */
  async getFailureMode(): Promise<{ simulate_failure: boolean }> {
    const res = await fetch('/api/system/failure-mode');
    if (!res.ok) throw new Error('Failed to query failure mode');
    return res.json();
  },

  /**
   * POST /api/system/failure-mode
   */
  async toggleFailureMode(enable: boolean): Promise<{ success: boolean; simulate_failure: boolean; message: string }> {
    const res = await fetch('/api/system/failure-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    });
    if (!res.ok) throw new Error('Failed to toggle failure mode');
    return res.json();
  },

  /**
   * POST /api/system/reset
   */
  async resetState(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/system/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset system state');
    return res.json();
  }
};
