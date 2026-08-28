import React from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  isBackendHealthy: boolean;
  healthLatency: number | null;
  simulateFailure: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onReset: () => void;
}

export const DashboardHeader: React.FC<Props> = ({
  isBackendHealthy,
  healthLatency,
  simulateFailure,
  isLoading,
  onRefresh,
  onReset
}) => {
  return (
    <header className="app-header animate-fade-in" aria-label="Application Header">
      <div className="header-brand-group">
        <div className="brand-icon-wrapper">
          <ShieldCheck size={22} className="brand-shield-icon" />
          <span className="brand-pulse-dot" />
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <h1 className="brand-title">Fault-Tolerant Data Processing</h1>
            <span className="brand-version-badge">v1.2.0</span>
          </div>
          <p className="brand-subtitle">
            Deduplication fingerprinting • Atomic isolation • Resilient aggregation
          </p>
        </div>
      </div>

      <div className="header-controls">
        {/* System Health Status Indicator */}
        <div
          className={`health-badge ${isBackendHealthy ? 'healthy' : 'degraded'}`}
          title={isBackendHealthy ? `Engine online (${healthLatency ?? 0}ms)` : 'Backend unreachable'}
        >
          <span className={`status-dot ${isBackendHealthy ? 'dot-green' : 'dot-red'}`} />
          <span className="health-text">
            {isBackendHealthy ? 'Engine Online' : 'Disconnected'}
          </span>
          {healthLatency !== null && isBackendHealthy && (
            <span className="health-latency">{healthLatency}ms</span>
          )}
        </div>

        {/* Failure Simulation Warning Pill */}
        {simulateFailure && (
          <div className="fault-warning-pill">
            <AlertTriangle size={13} />
            <span>Fault Injection Active</span>
          </div>
        )}

        {/* Refresh & Reset Actions */}
        <div className="header-btn-group">
          <button
            id="btn-refresh-dashboard"
            className="btn-header-action"
            onClick={onRefresh}
            title="Refresh dashboard metrics and events"
            aria-label="Refresh data"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-reset-system"
            className="btn-header-action btn-reset"
            onClick={onReset}
            title="Clear in-memory database events and aggregates for a fresh test run"
            aria-label="Reset demonstration state"
          >
            <RotateCcw size={14} />
            <span>Reset State</span>
          </button>
        </div>
      </div>
    </header>
  );
};
