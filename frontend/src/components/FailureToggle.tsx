import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: (state: boolean) => void;
}

export const FailureToggle: React.FC<Props> = ({ active, onToggle }) => {
  return (
    <div className={`glass-card failure-bar ${active ? 'active' : ''}`}>
      <div className="failure-info">
        {active ? <AlertTriangle size={24} color="#ef4444" /> : <Database size={24} color="#6366f1" />}
        <div>
          <strong style={{ color: active ? '#ef4444' : '#f3f4f6', fontSize: '1rem' }}>
            Simulate Database Failure Mid-Request
          </strong>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>
            {active
              ? '🔴 FAILURE MODE ACTIVE: Ingestion transactions will simulate a database crash and ROLLBACK mid-request.'
              : '🟢 NORMAL MODE: Ingest pipeline commits atomic transactions to PostgreSQL.'}
          </p>
        </div>
      </div>
      <label className="toggle-switch" title="Toggle Failure Simulation Mode">
        <input
          id="failure-simulation-toggle"
          type="checkbox"
          checked={active}
          onChange={e => onToggle(e.target.checked)}
        />
        <span className="slider"></span>
      </label>
    </div>
  );
};
