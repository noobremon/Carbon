import React, { useState, useEffect } from 'react';
import { api, RawEventEntity, AggregateResult } from './api/client';
import { FailureToggle } from './components/FailureToggle';
import { EventSubmitter } from './components/EventSubmitter';
import { ProcessedEvents } from './components/ProcessedEvents';
import { AggregationView } from './components/AggregationView';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, Layers, Database } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'duplicate' | 'rejected' | 'failed' | 'aggregate'>('all');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [events, setEvents] = useState<RawEventEntity[]>([]);
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);

  const loadData = async () => {
    try {
      const [eRes, aRes, fRes] = await Promise.all([
        api.getEvents(100),
        api.getAggregates(),
        api.getFailureMode()
      ]);

      if (eRes.success) setEvents(eRes.events);
      if (aRes.success) setAggregates(aRes.aggregates);
      setSimulateFailure(fRes.simulate_failure);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleFailure = async (state: boolean) => {
    setSimulateFailure(state);
    await api.toggleFailureMode(state);
  };

  const processedCount = events.filter(e => e.status === 'PROCESSED').length;
  const duplicateCount = events.filter(e => e.status === 'DUPLICATE').length;
  const rejectedCount = events.filter(e => e.status === 'REJECTED').length;
  const failedCount = events.filter(e => e.status === 'FAILED').length;
  const totalVolume = aggregates.reduce((sum, a) => sum + Number(a.total_amount), 0);

  return (
    <div className="container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-group">
          <div className="logo-badge">
            <ShieldCheck size={26} color="white" />
          </div>
          <div>
            <h1 className="logo-title">Fault-Tolerant Data Processing Dashboard</h1>
            <p className="logo-subtitle">
              Interactive Fault Tolerance, Deduplication Fingerprinting & Persisted Aggregations
            </p>
          </div>
        </div>
        <button
          id="btn-reset-system"
          className="btn-preset"
          onClick={async () => {
            await api.resetState();
            loadData();
          }}
        >
          <RefreshCw size={14} /> Reset Demonstration State
        </button>
      </header>

      {/* Interactive Failure Simulation Bar */}
      <FailureToggle active={simulateFailure} onToggle={handleToggleFailure} />

      {/* System Status Summary Grid */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-lbl">Processed Volume</div>
          <div className="stat-val" style={{ color: '#34d399' }}>
            ${totalVolume.toFixed(2)}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-lbl">Processed Events</div>
          <div className="stat-val" style={{ color: '#60a5fa' }}>
            {processedCount}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-lbl">Duplicates Handled</div>
          <div className="stat-val" style={{ color: '#22d3ee' }}>
            {duplicateCount}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-lbl">Failed / Rejected</div>
          <div className="stat-val" style={{ color: '#f87171' }}>
            {failedCount + rejectedCount}
          </div>
        </div>
      </div>

      {/* Demonstration Instructions Card */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px', background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)' }}>
        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#818cf8', marginBottom: '6px' }}>
          💡 Fault Tolerance Walkthrough Steps:
        </h4>
        <ol style={{ fontSize: '0.82rem', color: '#d1d5db', paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
          <li>Submit <strong>Event E</strong> $\rightarrow$ Status: <span className="badge badge-PROCESSED">PROCESSED</span>. Aggregates increase.</li>
          <li>Submit <strong>Event E again</strong> $\rightarrow$ Status: <span className="badge badge-DUPLICATE">DUPLICATE</span>. Aggregates do NOT double count!</li>
          <li>Toggle <strong>Simulate Database Failure ON</strong> and submit Event E $\rightarrow$ Status: <span className="badge badge-FAILED">FAILED</span>. Aggregates remain unaffected.</li>
          <li>Toggle <strong>Simulate Database Failure OFF</strong> and submit Event E again $\rightarrow$ System recovers safely without corruption.</li>
        </ol>
      </div>

      {/* Main Grid: Left Console, Right Feed */}
      <div className="main-layout">
        <div>
          <EventSubmitter onEventSubmitted={loadData} simulateFailure={simulateFailure} />
        </div>

        <div className="glass-card">
          {/* Navigation Tabs */}
          <div className="tabs-header">
            <button
              id="tab-all"
              className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Events ({events.length})
            </button>
            <button
              id="tab-processed"
              className={`tab-btn ${activeTab === 'processed' ? 'active' : ''}`}
              onClick={() => setActiveTab('processed')}
            >
              Processed ({processedCount})
            </button>
            <button
              id="tab-duplicate"
              className={`tab-btn ${activeTab === 'duplicate' ? 'active' : ''}`}
              onClick={() => setActiveTab('duplicate')}
            >
              Duplicates ({duplicateCount})
            </button>
            <button
              id="tab-failed"
              className={`tab-btn ${activeTab === 'failed' ? 'active' : ''}`}
              onClick={() => setActiveTab('failed')}
            >
              Failed/Rejected ({failedCount + rejectedCount})
            </button>
            <button
              id="tab-aggregate"
              className={`tab-btn ${activeTab === 'aggregate' ? 'active' : ''}`}
              onClick={() => setActiveTab('aggregate')}
            >
              Aggregates
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'aggregate' ? (
            <AggregationView />
          ) : (
            <ProcessedEvents
              events={events}
              filterStatus={
                activeTab === 'processed'
                  ? 'PROCESSED'
                  : activeTab === 'duplicate'
                  ? 'DUPLICATE'
                  : activeTab === 'failed'
                  ? 'FAILED'
                  : 'ALL'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
