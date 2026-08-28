import React from 'react';
import { AlertTriangle, Database, Zap, ShieldCheck } from 'lucide-react';

interface Props {
  active: boolean;
  onToggle: (state: boolean) => void;
  isToggling?: boolean;
}

export const FaultInjectionPanel: React.FC<Props> = ({ active, onToggle, isToggling = false }) => {
  return (
    <section
      className={`fault-injection-panel ${active ? 'fault-active' : 'fault-normal'} animate-fade-in`}
      aria-label="Fault Injection Simulation Control"
    >
      <div className="fault-panel-content">
        <div className="fault-icon-container">
          {active ? (
            <div className="fault-pulse-icon warning-pulse">
              <Zap size={24} className="icon-bolt" />
            </div>
          ) : (
            <div className="fault-pulse-icon normal-pulse">
              <Database size={24} className="icon-db" />
            </div>
          )}
        </div>

        <div className="fault-text-container">
          <div className="fault-title-row">
            <h2 className="fault-title">
              {active ? '⚡ FAULT INJECTION ACTIVE' : 'DATABASE TRANSACTION MODE'}
            </h2>
            <span className={`fault-status-pill ${active ? 'pill-active' : 'pill-normal'}`}>
              {active ? 'SIMULATING FAILURE' : 'NORMAL ATOMIC INGEST'}
            </span>
          </div>

          <p className="fault-description">
            {active ? (
              <span className="text-warning-highlight">
                <strong>Intentional Failure Enabled:</strong> Database write operations will intentionally throw a simulated crash mid-request. The raw event will be recorded as <span className="badge badge-FAILED">FAILED</span> and the transaction will atomically <span className="badge badge-FAILED">ROLLBACK</span> without mutating aggregates.
              </span>
            ) : (
              <span>
                <strong>Standard Operation:</strong> Incoming event payloads are validated, normalized, deduplicated with SHA-256 fingerprints, and atomically committed to storage.
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="fault-control-container">
        <button
          id="btn-toggle-failure-mode"
          className={`fault-toggle-btn ${active ? 'btn-danger-active' : 'btn-safe'}`}
          onClick={() => onToggle(!active)}
          disabled={isToggling}
          aria-pressed={active}
          aria-label={active ? 'Disable Database Failure Simulation' : 'Enable Database Failure Simulation'}
        >
          <div className="toggle-indicator-track">
            <span className="toggle-indicator-thumb" />
          </div>
          <span className="toggle-action-label">
            {active ? 'DISARM SIMULATION' : 'SIMULATE DB CRASH'}
          </span>
        </button>
      </div>
    </section>
  );
};
