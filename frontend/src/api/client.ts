export interface RawEventEntity {
  id: number;
  received_at: string;
  raw_payload: any;
  status: 'RECEIVED' | 'PROCESSED' | 'REJECTED' | 'DUPLICATE' | 'FAILED';
  error_message?: string;
  fingerprint?: string;
  client_id?: string;
  amount?: number;
  timestamp?: string;
}

export interface AggregateResult {
  client_id?: string;
  event_count: number;
  total_amount: number;
}

export const api = {
  /**
   * POST /api/events
   * Ingest raw event JSON
   */
  async ingestEvent(payload: any, simulateFailureHeader = false) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (simulateFailureHeader) {
      headers['x-simulate-failure'] = 'true';
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok && !data.status) {
      throw new Error(data.error || 'Server error ingesting event');
    }
    return data;
  },

  /**
   * GET /api/events
   * Returns recent events history
   */
  async getEvents(limit = 100): Promise<{ success: boolean; events: RawEventEntity[] }> {
    const res = await fetch(`/api/events?limit=${limit}`);
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
    return res.json();
  },

  /**
   * GET /api/system/failure-mode
   */
  async getFailureMode(): Promise<{ simulate_failure: boolean }> {
    const res = await fetch('/api/system/failure-mode');
    return res.json();
  },

  /**
   * POST /api/system/failure-mode
   */
  async toggleFailureMode(enable: boolean) {
    const res = await fetch('/api/system/failure-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable })
    });
    return res.json();
  },

  /**
   * POST /api/system/reset
   */
  async resetState() {
    const res = await fetch('/api/system/reset', { method: 'POST' });
    return res.json();
  }
};
