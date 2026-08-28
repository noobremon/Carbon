import React, { useState, useEffect, useCallback } from 'react';
import { api, RawEventEntity, AggregateResult, IngestResponse } from './api/client';
import { DashboardHeader } from './components/DashboardHeader';
import { MetricCards } from './components/MetricCards';
import { FaultInjectionPanel } from './components/FaultInjectionPanel';
import { PipelineVisualizer, PipelineStage } from './components/PipelineVisualizer';
import { EventSubmitter } from './components/EventSubmitter';
import { LiveEventFeed } from './components/LiveEventFeed';
import { AggregationView } from './components/AggregationView';
import { DemoScenarioHelper } from './components/DemoScenarioHelper';
import { ToastProvider, useToast } from './components/Toast';
import {
  Layers,
  CheckCircle2,
  AlertOctagon,
  Copy,
  BarChart3,
  Sparkles
} from 'lucide-react';

export function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'all' | 'processed' | 'duplicate' | 'failed' | 'aggregate' | 'demo'>('all');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isTogglingFailure, setIsTogglingFailure] = useState(false);
  const [events, setEvents] = useState<RawEventEntity[]>([]);
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);
  const [isBackendHealthy, setIsBackendHealthy] = useState(true);
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Pipeline execution state
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('IDLE');
  const [lastIngestResponse, setLastIngestResponse] = useState<IngestResponse | null>(null);

  const { showToast } = useToast();

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    const startPing = performance.now();

    try {
      const [eRes, aRes, fRes] = await Promise.all([
        api.getEvents(100),
        api.getAggregates(),
        api.getFailureMode()
      ]);

      const pingDuration = Math.round(performance.now() - startPing);
      setHealthLatency(pingDuration);
      setIsBackendHealthy(true);

      if (eRes.success) setEvents(eRes.events);
      if (aRes.success) setAggregates(aRes.aggregates);
      setSimulateFailure(fRes.simulate_failure);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setIsBackendHealthy(false);
      if (!silent) {
        showToast('error', 'Connection Warning', 'Unable to reach backend ingestion service');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(false);
    const timer = setInterval(() => {
      loadData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleToggleFailure = async (targetState: boolean) => {
    setIsTogglingFailure(true);
    try {
      const res = await api.toggleFailureMode(targetState);
      setSimulateFailure(res.simulate_failure);
      showToast(
        targetState ? 'warning' : 'info',
        targetState ? 'Fault Injection Armed' : 'Fault Injection Disarmed',
        targetState
          ? 'Database writes will simulate crash mid-request.'
          : 'Database operations returned to normal atomic commits.'
      );
    } catch (err: any) {
      showToast('error', 'Failure Mode Toggle Error', err.message);
    } finally {
      setIsTogglingFailure(false);
      loadData(true);
    }
  };

  const handleResetSystemState = async () => {
    try {
      await api.resetState();
      await api.toggleFailureMode(false);
      setSimulateFailure(false);
      setPipelineStage('IDLE');
      setLastIngestResponse(null);
      await loadData(false);
      showToast('success', 'System State Reset', 'All events and aggregates have been reset.');
    } catch (err: any) {
      showToast('error', 'Reset Failed', err.message);
    }
  };

  const handlePipelineStageChange = (stage: PipelineStage, response?: IngestResponse | null) => {
    setPipelineStage(stage);
    if (response !== undefined) {
      setLastIngestResponse(response);
    }
  };

  const processedCount = events.filter(e => e.status === 'PROCESSED').length;
  const duplicateCount = events.filter(e => e.status === 'DUPLICATE').length;
  const rejectedCount = events.filter(e => e.status === 'REJECTED').length;
  const failedCount = events.filter(e => e.status === 'FAILED').length;
  const totalVolume = aggregates.reduce((sum, a) => sum + Number(a.total_amount), 0);

  return (
    <div className="app-viewport">
      <div className="container">
        {/* Dashboard Header */}
        <DashboardHeader
          isBackendHealthy={isBackendHealthy}
          healthLatency={healthLatency}
          simulateFailure={simulateFailure}
          isLoading={isLoading}
          onRefresh={() => loadData(false)}
          onReset={handleResetSystemState}
        />

        {/* Unified Cohesive Metric Cards */}
        <MetricCards
          processedCount={processedCount}
          duplicateCount={duplicateCount}
          failedCount={failedCount}
          rejectedCount={rejectedCount}
          totalVolume={totalVolume}
          totalEvents={events.length}
        />

        {/* Sleek Fault Injection Status Bar */}
        <FaultInjectionPanel
          active={simulateFailure}
          onToggle={handleToggleFailure}
          isToggling={isTogglingFailure}
        />

        {/* Deterministic Processing Pipeline */}
        <PipelineVisualizer
          currentStage={pipelineStage}
          finalStatus={lastIngestResponse?.status}
          latencyMs={lastIngestResponse?.latency_ms}
          fingerprint={lastIngestResponse?.fingerprint}
          errorMessage={lastIngestResponse?.error}
          clientId={lastIngestResponse?.normalized_event?.client_id}
          amount={lastIngestResponse?.normalized_event?.amount}
        />

        {/* Main Two-Column Layout */}
        <div className="main-layout">
          {/* Left Column: Event Ingestion Console (38%) */}
          <div className="left-console-column">
            <EventSubmitter
              onEventSubmitted={() => loadData(true)}
              simulateFailure={simulateFailure}
              onPipelineStageChange={handlePipelineStageChange}
            />
          </div>

          {/* Right Column: Tabbed Views (Feed / Aggregates / Demo Helper) (62%) */}
          <div className="right-display-column">
            <div className="tabs-container glass-card">
              {/* Segmented Tab Bar */}
              <div className="tabs-header" role="tablist">
                <button
                  id="tab-all"
                  role="tab"
                  aria-selected={activeTab === 'all'}
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <Layers size={13} />
                  <span>All Events</span>
                  <span className="tab-pill">{events.length}</span>
                </button>

                <button
                  id="tab-processed"
                  role="tab"
                  aria-selected={activeTab === 'processed'}
                  className={`tab-btn ${activeTab === 'processed' ? 'active' : ''}`}
                  onClick={() => setActiveTab('processed')}
                >
                  <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                  <span>Processed</span>
                  <span className="tab-pill">{processedCount}</span>
                </button>

                <button
                  id="tab-duplicate"
                  role="tab"
                  aria-selected={activeTab === 'duplicate'}
                  className={`tab-btn ${activeTab === 'duplicate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('duplicate')}
                >
                  <Copy size={13} style={{ color: '#06b6d4' }} />
                  <span>Duplicates</span>
                  <span className="tab-pill">{duplicateCount}</span>
                </button>

                <button
                  id="tab-failed"
                  role="tab"
                  aria-selected={activeTab === 'failed'}
                  className={`tab-btn ${activeTab === 'failed' ? 'active' : ''}`}
                  onClick={() => setActiveTab('failed')}
                >
                  <AlertOctagon size={13} style={{ color: '#f43f5e' }} />
                  <span>Failed/Rejected</span>
                  <span className="tab-pill">{failedCount + rejectedCount}</span>
                </button>

                <button
                  id="tab-aggregate"
                  role="tab"
                  aria-selected={activeTab === 'aggregate'}
                  className={`tab-btn ${activeTab === 'aggregate' ? 'active' : ''}`}
                  onClick={() => setActiveTab('aggregate')}
                >
                  <BarChart3 size={13} style={{ color: '#818cf8' }} />
                  <span>Aggregates</span>
                </button>

                <button
                  id="tab-demo"
                  role="tab"
                  aria-selected={activeTab === 'demo'}
                  className={`tab-btn tab-btn-highlight ${activeTab === 'demo' ? 'active' : ''}`}
                  onClick={() => setActiveTab('demo')}
                >
                  <Sparkles size={13} />
                  <span>Demo Guide</span>
                </button>
              </div>

              {/* Tab Panel Content */}
              <div className="tab-body" role="tabpanel">
                {activeTab === 'aggregate' ? (
                  <AggregationView />
                ) : activeTab === 'demo' ? (
                  <DemoScenarioHelper
                    onRefreshData={() => loadData(true)}
                    onPipelineStageChange={handlePipelineStageChange}
                    simulateFailure={simulateFailure}
                    onSetSimulateFailure={setSimulateFailure}
                  />
                ) : (
                  <LiveEventFeed
                    events={events}
                    filterStatus={
                      activeTab === 'processed'
                        ? 'PROCESSED'
                        : activeTab === 'duplicate'
                        ? 'DUPLICATE'
                        : activeTab === 'failed'
                        ? 'FAILED_OR_REJECTED'
                        : 'ALL'
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}

export default App;
