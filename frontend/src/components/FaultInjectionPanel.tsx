import React from 'react';
import { Database, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: (state: boolean) => void;
  isToggling?: boolean;
}

export const FaultInjectionPanel: React.FC<Props> = ({ active, onToggle, isToggling = false }) => {
  return (
    <section
      className={`fault-injection-bar ${active ? 'fault-active' : ''} animate-fade-in`}
      aria-label="Database & Fault Injection Status Control"
    >
      <div className="fault-bar-info-group">
        {/* Database Status */}
        <div className="fault-info-item">
          <span className="fault-info-label">Database</span>
          <span className="fault-info-val">
            <span className="status-dot-sm" /> Connected
          </span>
        </div>

        {/* Transaction Mode */}
        <div className="fault-info-item">
          <span className="fault-info-label">Transaction Mode</span>
          <span className="fault-info-val">
            <ShieldCheck size={14} className="text-primary" /> Atomic (ACID)
          </span>
        </div>

        {/* Secondary Context / Explanation */}
        <div className="fault-bar-explanation">
          {active ? (
            <span className="fault-active-alert">
              <AlertTriangle size={14} /> Fault Injection Active — Database write operations will intentionally fail and roll back.
            </span>
          ) : (
            <span>Incoming payloads are deduplicated with SHA-256 and committed atomically.</span>
          )}
        </div>
      </div>

      {/* Control Switch Button */}
      <div className="fault-bar-controls">
        <button
          id="btn-toggle-failure-mode"
          className={`fault-toggle-switch ${active ? 'armed' : ''}`}
          onClick={() => onToggle(!active)}
          disabled={isToggling}
          aria-pressed={active}
          aria-label={active ? 'Disable Fault Injection' : 'Enable Fault Injection Simulation'}
          title="Simulate mid-request database write failure & transaction rollback"
        >
          {active ? <Zap size={14} /> : <Database size={14} />}
          <span>Fault Injection</span>
          <span className="switch-pill">{active ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </section>
  );
};
