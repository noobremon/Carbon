import React from 'react';
import { RawEventEntity } from '../api/client';
import { AlertOctagon, XCircle } from 'lucide-react';

interface Props {
  events: RawEventEntity[];
}

export const RejectedEvents: React.FC<Props> = ({ events }) => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <AlertOctagon size={20} color="#ef4444" />
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Rejected / Failed Events Log</h3>
        <span className="badge badge-FAILED">{events.length} Errors</span>
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
          <XCircle size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
          <p>No rejected or failed events logged.</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Raw ID</th>
                <th>Status</th>
                <th>Received At</th>
                <th>Error Reason</th>
                <th>Raw Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>#{ev.id}</td>
                  <td>
                    <span className={`badge badge-${ev.status}`}>{ev.status}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    {new Date(ev.received_at).toLocaleString()}
                  </td>
                  <td style={{ color: '#f87171', fontWeight: 500 }}>
                    {ev.error_message || 'Schema validation or transaction failure'}
                  </td>
                  <td>
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        background: 'rgba(0,0,0,0.4)',
                        padding: '6px',
                        borderRadius: '4px',
                        maxHeight: '80px',
                        overflowY: 'auto'
                      }}
                    >
                      {JSON.stringify(ev.raw_payload, null, 2)}
                    </pre>
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
