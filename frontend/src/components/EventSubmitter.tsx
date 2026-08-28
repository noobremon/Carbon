import React, { useState, useEffect } from 'react';
import {
  Send,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Sparkles,
  Trash2,
  Clock,
  Code2,
  ChevronDown,
  ChevronRight,
  Terminal,
  ArrowRight,
  Globe,
  Sliders,
  Info,
  Server,
  Building2,
  DollarSign,
  Calendar
} from 'lucide-react';
import { api, IngestResponse } from '../api/client';
import { PipelineStage } from './PipelineVisualizer';
import { useToast } from './Toast';

interface Props {
  onEventSubmitted: () => void;
  simulateFailure: boolean;
  onPipelineStageChange: (stage: PipelineStage, response?: IngestResponse | null) => void;
}

export interface PresetScenario {
  id: string;
  name: string;
  badge: string;
  description: string;
  payload: string;
  isRawString?: boolean;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'valid-event-a',
    name: 'Standard Purchase',
    badge: 'Valid',
    description: 'Clean numeric amount ($1,200.00) with client_A',
    payload: JSON.stringify(
      {
        source: 'client_A',
        payload: {
          metric: 'purchase',
          amount: 1200,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      },
      null,
      2
    )
  },
  {
    id: 'string-amount-coercion',
    name: 'String Amount',
    badge: 'Normalize',
    description: 'String amount "$450.75" coerced to canonical float',
    payload: JSON.stringify(
      {
        client: 'client_B',
        payload: {
          action: 'checkout',
          price: '$450.75',
          date: '2024/01/02 14:30:00'
        }
      },
      null,
      2
    )
  },
  {
    id: 'alternate-date-format',
    name: 'Fuzzy Date',
    badge: 'Date UTC',
    description: 'Slash-separated date normalized to ISO 8601 UTC',
    payload: JSON.stringify(
      {
        source: 'client_C',
        payload: {
          metric: 'subscription_renewal',
          amount: 89.99,
          timestamp: '2024/03/15 10:00:00'
        }
      },
      null,
      2
    )
  },
  {
    id: 'extra-fields-nested',
    name: 'Extra Fields',
    badge: 'Hash Order',
    description: 'Nested fields hashed deterministically regardless of key order',
    payload: JSON.stringify(
      {
        source: 'client_A',
        payload: {
          metric: 'custom_telemetry',
          amount: 350.0,
          timestamp: '2024-01-01T12:00:00.000Z',
          extra_fields: {
            user_segment: 'enterprise',
            location: { region: 'us-east', zone: '1a' },
            device: 'desktop-client'
          }
        }
      },
      null,
      2
    )
  },
  {
    id: 'invalid-amount-error',
    name: 'Invalid Amount',
    badge: 'Schema Reject',
    description: 'Non-numeric amount fails validation and is rejected',
    payload: JSON.stringify(
      {
        source: 'client_B',
        payload: {
          metric: 'purchase',
          amount: 'NOT_A_VALID_NUMBER',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      },
      null,
      2
    )
  },
  {
    id: 'malformed-json-syntax',
    name: 'Malformed JSON',
    badge: 'Syntax Error',
    description: 'Unclosed bracket raw string preserved as rejected',
    payload: '{\n  "source": "client_MALFORMED",\n  "payload": { \n',
    isRawString: true
  }
];

const CLIENT_OPTIONS = [
  { id: 'company_A', label: 'Company A', note: 'E-commerce backend' },
  { id: 'company_B', label: 'Company B', note: 'SaaS platform' },
  { id: 'company_C', label: 'Company C', note: 'Billing service' },
  { id: 'partner_X', label: 'Partner X', note: 'Partner integration' },
  { id: 'service_Y', label: 'Service Y', note: 'Checkout microservice' }
];

const METRIC_OPTIONS = [
  { id: 'payment', label: 'Payment' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'subscription_renewal', label: 'Subscription Renewal' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'refund', label: 'Refund' }
];

export const EventSubmitter: React.FC<Props> = ({
  onEventSubmitted,
  simulateFailure,
  onPipelineStageChange
}) => {
  // Navigation mode: 'simulator' (structured) vs 'manual' (raw JSON & presets)
  const [activeMode, setActiveMode] = useState<'simulator' | 'manual'>('simulator');

  // Simulator Form State (Deterministic & Explicit)
  const [selectedClient, setSelectedClient] = useState<string>('company_A');
  const [selectedMetric, setSelectedMetric] = useState<string>('payment');
  const [amountInput, setAmountInput] = useState<string>('1400');
  const [timestampValue, setTimestampValue] = useState<string>(() => new Date().toISOString());
  const [autoTimestamp, setAutoTimestamp] = useState<boolean>(false);

  // Manual Raw JSON State
  const [jsonText, setJsonText] = useState<string>(PRESET_SCENARIOS[0].payload);
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_SCENARIOS[0].id);

  // Submission & Response State
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'processing' | 'success' | 'duplicate' | 'failed' | 'rejected'>('idle');
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
  const [showProductionDetails, setShowProductionDetails] = useState(false);

  const { showToast } = useToast();

  // Active constructed payload for the simulator
  const simulatorPayload = {
    source: selectedClient,
    payload: {
      metric: selectedMetric,
      amount: parseFloat(amountInput) || 0,
      timestamp: timestampValue
    }
  };

  const handleRefreshTimestamp = () => {
    const now = new Date().toISOString();
    setTimestampValue(now);
    showToast('info', 'Timestamp Updated', 'Set to current ISO 8601 UTC timestamp');
  };

  const handleSelectPreset = (preset: PresetScenario) => {
    setSelectedPreset(preset.id);
    setJsonText(preset.payload);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      showToast('info', 'JSON Formatted', 'Syntax formatted cleanly');
    } catch (err: any) {
      showToast('warning', 'Format Warning', `Cannot format unparseable JSON: ${err.message}`);
    }
  };

  const handleClearEditor = () => {
    setJsonText('{\n  "source": "client_A",\n  "payload": {\n    "metric": "purchase",\n    "amount": 100\n  }\n}');
    setSelectedPreset('');
  };

  const handleCopyPayload = (content: string) => {
    navigator.clipboard.writeText(content);
    showToast('info', 'Copied', 'Payload copied to clipboard');
  };

  const handleCopyCurl = (payloadObj: any) => {
    const curl = `curl -X POST http://localhost:3001/api/events \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payloadObj, null, 2)}'`;
    navigator.clipboard.writeText(curl);
    showToast('info', 'Copied', 'cURL command copied to clipboard');
  };

  const executePipelineIngestion = async (payload: any, isSimulator = false) => {
    setSubmitState('submitting');
    onPipelineStageChange('RECEIVED');

    // Visual progression matching deterministic pipeline
    await new Promise(r => setTimeout(r, 90));
    onPipelineStageChange('VALIDATING');
    await new Promise(r => setTimeout(r, 90));
    onPipelineStageChange('NORMALIZING');
    await new Promise(r => setTimeout(r, 90));
    onPipelineStageChange('DEDUPLICATING');
    await new Promise(r => setTimeout(r, 90));
    onPipelineStageChange('PERSISTING');

    try {
      const response = await api.ingestEvent(payload, simulateFailure);
      setLastResponse(response);

      const clientName = response.normalized_event?.client_id || (typeof payload === 'object' && payload?.source) || 'client';
      const eventMetric = response.normalized_event?.metric || (typeof payload === 'object' && payload?.payload?.metric) || 'event';
      const formattedAmt = Number(response.normalized_event?.amount ?? (typeof payload === 'object' ? payload?.payload?.amount : 0)).toFixed(2);

      if (response.status === 'PROCESSED') {
        setSubmitState('success');
        onPipelineStageChange('PROCESSED', response);
        showToast(
          'success',
          'Simulated Event Processed',
          `Simulated ${eventMetric} event from ${clientName} ($${formattedAmt}) persisted to aggregates.`
        );
      } else if (response.status === 'DUPLICATE') {
        setSubmitState('duplicate');
        onPipelineStageChange('DUPLICATE', response);
        showToast(
          'info',
          'Idempotent Duplicate Detected',
          `Identical SHA-256 fingerprint matched. Aggregates protected from duplicate inflation.`
        );
      } else if (response.status === 'FAILED') {
        setSubmitState('failed');
        onPipelineStageChange('FAILED', response);
        showToast(
          'error',
          'Simulated Write Failure',
          response.error || 'Simulated crash caught. Transaction rolled back with 0 aggregate drift.'
        );
      } else if (response.status === 'REJECTED') {
        setSubmitState('rejected');
        onPipelineStageChange('REJECTED', response);
        showToast(
          'warning',
          'Event Payload Rejected',
          response.error || 'Payload failed schema validation.'
        );
      }

      onEventSubmitted();
    } catch (err: any) {
      const failResponse: IngestResponse = {
        success: false,
        status: 'FAILED',
        error: err.message || 'Network communication error with backend'
      };
      setLastResponse(failResponse);
      setSubmitState('failed');
      onPipelineStageChange('FAILED', failResponse);
      showToast('error', 'Submission Error', err.message);
    } finally {
      setTimeout(() => {
        setSubmitState('idle');
      }, 3500);
    }
  };

  const handleSendSimulatorEvent = () => {
    const finalTimestamp = autoTimestamp ? new Date().toISOString() : timestampValue;
    if (autoTimestamp) {
      setTimestampValue(finalTimestamp);
    }

    const payloadToSend = {
      source: selectedClient,
      payload: {
        metric: selectedMetric,
        amount: parseFloat(amountInput) || 0,
        timestamp: finalTimestamp
      }
    };

    executePipelineIngestion(payloadToSend, true);
  };

  const handleSendManualEvent = () => {
    let parsedPayload: any = jsonText;
    try {
      parsedPayload = JSON.parse(jsonText);
    } catch (syntaxErr: any) {
      parsedPayload = jsonText;
    }
    executePipelineIngestion(parsedPayload, false);
  };

  return (
    <div className="event-submission-panel glass-card animate-fade-in" aria-label="External Client Simulator and Developer Console">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title-group">
          {activeMode === 'simulator' ? (
            <Server size={18} className="text-primary" />
          ) : (
            <Terminal size={18} className="text-primary" />
          )}
          <h2 className="panel-title">
            {activeMode === 'simulator' ? 'External Client Simulator' : 'Developer Test Client'}
          </h2>
        </div>
        <span className="panel-badge">
          {activeMode === 'simulator' ? 'Simulates External App' : 'Raw JSON Testing'}
        </span>
      </div>

      <p className="panel-subtitle">
        {activeMode === 'simulator'
          ? "Simulate an external application's backend sending a structured event to this platform's ingestion API."
          : "Manually test raw payloads, edge cases, type coercions, and malformed inputs against the ingestion API."}
      </p>

      {/* Mode Switcher Tabs */}
      <div className="mode-switcher-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === 'simulator'}
          className={`mode-switch-btn ${activeMode === 'simulator' ? 'mode-active' : ''}`}
          onClick={() => setActiveMode('simulator')}
          id="tab-simulator-mode"
        >
          <Server size={13} />
          <span>External Client Simulator</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === 'manual'}
          className={`mode-switch-btn ${activeMode === 'manual' ? 'mode-active' : ''}`}
          onClick={() => setActiveMode('manual')}
          id="tab-manual-mode"
        >
          <Code2 size={13} />
          <span>Raw JSON / Presets</span>
        </button>
      </div>

      {/* ──────────────── MODE 1: EXTERNAL CLIENT SIMULATOR ──────────────── */}
      {activeMode === 'simulator' && (
        <div className="simulator-view animate-fade-in">
          {/* Transparent Simulation Notice */}
          <div className="simulator-disclaimer-card">
            <Info size={14} className="disclaimer-icon" />
            <div className="disclaimer-text">
              <strong>Simulation only</strong> — represents an external application's backend. In production, Company A's backend would send this HTTP POST request directly to <code>POST /api/events</code>.
            </div>
          </div>

          {/* Form Controls for Realistic Structured Event */}
          <div className="simulator-form-grid">
            {/* Client Selector */}
            <div className="sim-field-group">
              <label htmlFor="sim-client-select" className="sim-label">
                <Building2 size={12} />
                <span>Client / Producer</span>
              </label>
              <select
                id="sim-client-select"
                className="sim-select"
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
              >
                {CLIENT_OPTIONS.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.note})
                  </option>
                ))}
              </select>
            </div>

            {/* Event / Metric Selector */}
            <div className="sim-field-group">
              <label htmlFor="sim-metric-select" className="sim-label">
                <Sliders size={12} />
                <span>Event Type</span>
              </label>
              <select
                id="sim-metric-select"
                className="sim-select"
                value={selectedMetric}
                onChange={e => setSelectedMetric(e.target.value)}
              >
                {METRIC_OPTIONS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div className="sim-field-group">
              <label htmlFor="sim-amount-input" className="sim-label">
                <DollarSign size={12} />
                <span>Amount ($ / ₹)</span>
              </label>
              <input
                id="sim-amount-input"
                type="number"
                step="0.01"
                min="0"
                className="sim-input"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                placeholder="1400.00"
              />
            </div>

            {/* Timestamp Control */}
            <div className="sim-field-group">
              <div className="sim-label-split">
                <label htmlFor="sim-timestamp-input" className="sim-label">
                  <Calendar size={12} />
                  <span>Timestamp (UTC)</span>
                </label>
                <button
                  type="button"
                  className="sim-timestamp-btn"
                  onClick={handleRefreshTimestamp}
                  title="Update timestamp to current time"
                >
                  <RefreshCw size={10} />
                  <span>Now</span>
                </button>
              </div>
              <input
                id="sim-timestamp-input"
                type="text"
                className="sim-input sim-input-mono"
                value={timestampValue}
                onChange={e => setTimestampValue(e.target.value)}
                title="Exact timestamp sent in payload. Keep identical to test idempotent deduplication."
              />
              <span className="sim-helper-text">
                Keep timestamp unchanged to test <strong>DUPLICATE</strong> detection on re-send.
              </span>
            </div>
          </div>

          {/* Request Payload Preview */}
          <div className="sim-payload-preview-card">
            <div className="preview-card-header">
              <div className="preview-endpoint-tag">
                <span className="http-method">POST</span>
                <code>/api/events</code>
              </div>
              <div className="preview-actions">
                <button
                  type="button"
                  className="sim-copy-btn"
                  onClick={() => handleCopyCurl(simulatorPayload)}
                  title="Copy as cURL command"
                >
                  <Copy size={11} />
                  <span>Copy cURL</span>
                </button>
              </div>
            </div>
            <pre className="sim-json-display">
              <code>{JSON.stringify(simulatorPayload, null, 2)}</code>
            </pre>
          </div>

          {/* Flow Visual */}
          <div className="sim-flow-strip">
            <div className="flow-step">
              <span className="flow-step-tag">
                {CLIENT_OPTIONS.find(c => c.id === selectedClient)?.label || 'External Client'}
              </span>
            </div>
            <ArrowRight size={13} className="flow-arrow-icon" />
            <div className="flow-step flow-step-highlight">
              <code>POST /api/events</code>
            </div>
            <ArrowRight size={13} className="flow-arrow-icon" />
            <div className="flow-step">
              <span className="flow-step-tag">Fault-Tolerant Engine</span>
            </div>
          </div>

          {/* Dominant Send Event Button */}
          <div className="submit-action-row">
            <button
              id="btn-send-simulated-event"
              className={`btn-ingest-submit submit-state-${submitState}`}
              onClick={handleSendSimulatorEvent}
              disabled={submitState === 'submitting' || submitState === 'processing'}
              aria-label="Send simulated client event"
            >
              {submitState === 'submitting' || submitState === 'processing' ? (
                <>
                  <RefreshCw className="spin" size={16} />
                  <span>Processing Pipeline...</span>
                </>
              ) : submitState === 'success' ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Simulated Event Processed</span>
                </>
              ) : submitState === 'duplicate' ? (
                <>
                  <Copy size={16} />
                  <span>Duplicate Detected (Idempotent)</span>
                </>
              ) : submitState === 'failed' ? (
                <>
                  <AlertCircle size={16} />
                  <span>Transaction Rolled Back (Failed)</span>
                </>
              ) : submitState === 'rejected' ? (
                <>
                  <AlertCircle size={16} />
                  <span>Validation Failed (Rejected)</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>SEND EVENT ({CLIENT_OPTIONS.find(c => c.id === selectedClient)?.label})</span>
                </>
              )}
            </button>
          </div>

          {/* Real-World Production Context Collapsible */}
          <div className="production-context-card">
            <button
              type="button"
              className="context-accordion-toggle"
              onClick={() => setShowProductionDetails(!showProductionDetails)}
              aria-expanded={showProductionDetails}
            >
              {showProductionDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Globe size={13} />
              <span>How would this work in production?</span>
            </button>

            {showProductionDetails && (
              <div className="context-accordion-content animate-fade-in">
                <p className="context-p">
                  An external application's backend integrates with the ingestion API. When an event occurs, the application sends an HTTP POST request containing the event payload. This platform then validates, normalizes, deduplicates, and atomically persists the event.
                </p>
                <div className="context-points-list">
                  <div className="context-point-item">
                    <strong>1. HTTP Integration:</strong> External servers call <code>POST /api/events</code> with standard JSON.
                  </div>
                  <div className="context-point-item">
                    <strong>2. Resilient Ingestion:</strong> Raw audit logs are saved before parsing, ensuring no lost events.
                  </div>
                  <div className="context-point-item">
                    <strong>3. Exactly-Once Delivery:</strong> Network retries with the same event fingerprint return <code>DUPLICATE</code> with zero aggregate inflation.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── MODE 2: DEVELOPER TEST CLIENT (RAW JSON) ──────────────── */}
      {activeMode === 'manual' && (
        <div className="manual-view animate-fade-in">
          {/* Preset Scenario Selector */}
          <div className="scenarios-container">
            <div className="scenarios-label-row">
              <span className="scenarios-label">Preset Edge Cases & Unreliable Payloads</span>
              <span className="scenarios-helper">Click to load</span>
            </div>

            <div className="scenario-chips-grid">
              {PRESET_SCENARIOS.map(scenario => {
                const isSelected = selectedPreset === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    id={`preset-${scenario.id}`}
                    className={`scenario-chip ${isSelected ? 'chip-selected' : ''}`}
                    onClick={() => handleSelectPreset(scenario)}
                    title={scenario.description}
                  >
                    <div className="chip-header">
                      <span className="chip-name">{scenario.name}</span>
                      <span className="chip-badge">{scenario.badge}</span>
                    </div>
                    <p className="chip-desc">{scenario.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Label */}
          <div className="editor-context-label">
            <FileCode size={12} />
            <span>Developer Test Client: Manually simulate raw payloads and schema anomalies.</span>
          </div>

          {/* Code Editor Toolbar */}
          <div className="editor-toolbar">
            <div className="editor-lang-indicator">
              <Code2 size={13} />
              <span>Raw Payload Editor (POST /api/events)</span>
            </div>
            <div className="editor-action-buttons">
              <button
                className="editor-btn"
                onClick={handleFormatJson}
                title="Auto-format JSON syntax"
                aria-label="Format JSON"
              >
                <Sparkles size={12} />
                <span>Format</span>
              </button>
              <button
                className="editor-btn"
                onClick={() => handleCopyPayload(jsonText)}
                title="Copy payload to clipboard"
                aria-label="Copy JSON"
              >
                <Copy size={12} />
                <span>Copy</span>
              </button>
              <button
                className="editor-btn editor-btn-danger"
                onClick={handleClearEditor}
                title="Clear editor"
                aria-label="Clear editor"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Raw JSON Code Textarea */}
          <div className="editor-container">
            <textarea
              id="raw-json-editor"
              className="code-editor-box"
              value={jsonText}
              onChange={e => {
                setJsonText(e.target.value);
                setSelectedPreset('');
              }}
              placeholder="Enter JSON or text payload..."
              spellCheck={false}
              aria-label="Raw event payload editor"
            />
          </div>

          {/* Submit Button for Manual Mode */}
          <div className="submit-action-row">
            <button
              id="btn-submit-event"
              className={`btn-ingest-submit submit-state-${submitState}`}
              onClick={handleSendManualEvent}
              disabled={submitState === 'submitting' || submitState === 'processing'}
              aria-label="Submit manual event payload"
            >
              {submitState === 'submitting' || submitState === 'processing' ? (
                <>
                  <RefreshCw className="spin" size={16} />
                  <span>Processing Pipeline...</span>
                </>
              ) : submitState === 'success' ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Event Processed Successfully</span>
                </>
              ) : submitState === 'duplicate' ? (
                <>
                  <Copy size={16} />
                  <span>Duplicate Detected (Idempotent)</span>
                </>
              ) : submitState === 'failed' ? (
                <>
                  <AlertCircle size={16} />
                  <span>Transaction Rolled Back (Failed)</span>
                </>
              ) : submitState === 'rejected' ? (
                <>
                  <AlertCircle size={16} />
                  <span>Validation Failed (Rejected)</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Submit Manual Payload</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ──────────────── SHARED HTTP RESPONSE PREVIEW ──────────────── */}
      {lastResponse && (
        <div className={`response-preview-box status-border-${lastResponse.status} animate-fade-in`}>
          <div className="preview-header">
            <div className="preview-status-group">
              <span className="http-code-tag">
                {lastResponse.status === 'PROCESSED' || lastResponse.status === 'DUPLICATE'
                  ? 'HTTP 200 OK'
                  : lastResponse.status === 'REJECTED'
                  ? 'HTTP 400 Bad Request'
                  : 'HTTP 500 Rollback'}
              </span>
              <span className={`badge badge-${lastResponse.status}`}>
                {lastResponse.status}
              </span>
            </div>
            {lastResponse.latency_ms !== undefined && (
              <span className="preview-latency">
                <Clock size={11} /> {lastResponse.latency_ms}ms latency
              </span>
            )}
          </div>

          <div className="preview-body">
            {lastResponse.error && (
              <div className="preview-error">
                <strong>Error / Reason:</strong> {lastResponse.error}
              </div>
            )}
            {lastResponse.normalized_event && (
              <div className="preview-normalized">
                <span className="preview-label">Normalized Event:</span>
                <code>
                  {`{ client: "${lastResponse.normalized_event.client_id}", metric: "${lastResponse.normalized_event.metric}", amount: $${Number(lastResponse.normalized_event.amount).toFixed(2)} }`}
                </code>
              </div>
            )}
            {lastResponse.fingerprint && (
              <div className="preview-fingerprint">
                <span className="preview-label">Deterministic Fingerprint:</span>
                <code>{lastResponse.fingerprint.substring(0, 32)}...</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

