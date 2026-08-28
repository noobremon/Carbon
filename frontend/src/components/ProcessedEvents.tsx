import React from 'react';
import { RawEventEntity } from '../api/client';
import { Layers, CheckCircle2, AlertOctagon, Copy, XCircle } from 'lucide-react';

interface Props {
  events: RawEventEntity[];
  filterStatus?: 'ALL' | 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'FAILED';
}

export const ProcessedEvents: React.FC<Props> = ({ events, filterStatus = 'ALL' }) => {
  const filteredEvents = filterStatus === 'ALL'
    ? events
    : events.filter(e => e.status === filterStatus);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Layers size={20} color="#6366f1" />
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Event Ingestion & History Feed</h3>
        <span className="badge badge-RECEIVED">{filteredEvents.length} Events</span>
      </div>

      {filteredEvents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px', color: '#6b7280' }}>
          <CheckCircle2 size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem' }}>No events recorded for status "{filterStatus}".</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Client ID</th>
                <th>Amount</th>
                <th>Timestamp</th>
                <th>Error Details / Payload</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>#{ev.id}</td>
                  <td>
                    <span className={`badge badge-${ev.status}`}>{ev.status}</span>
                  </td>
                  <td>
                    {ev.client_id ? (
                      <span className="code-inline" style={{ color: '#60a5fa' }}>{ev.client_id}</span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>N/A</span>
                    )}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: ev.amount !== undefined ? '#34d399' : '#6b7280' }}>
                    {ev.amount !== undefined ? `$${Number(ev.amount).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : new Date(ev.received_at).toLocaleString()}
                  </td>
                  <td>
                    {ev.error_message ? (
                      <span style={{ color: '#f87171', fontWeight: 500, fontSize: '0.8rem' }}>
                        ❌ {ev.error_message}
                      </span>
                    ) : (
                      <span className="code-inline" style={{ fontSize: '0.75rem' }}>
                        {JSON.stringify(ev.raw_payload).substring(0, 45)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
