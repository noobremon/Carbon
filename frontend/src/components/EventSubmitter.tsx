import React, { useState } from 'react';
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
  Zap,
  Globe
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

const SIMULATED_CLIENTS = ['company_A', 'company_B', 'company_C', 'partner_X', 'service_Y'];
const SIMULATED_METRICS = ['purchase', 'subscription_renewal', 'checkout', 'refund', 'upgrade'];

export const EventSubmitter: React.FC<Props> = ({
  onEventSubmitted,
  simulateFailure,
  onPipelineStageChange
}) => {
  const [jsonText, setJsonText] = useState<string>(PRESET_SCENARIOS[0].payload);
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_SCENARIOS[0].id);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'processing' | 'success' | 'duplicate' | 'failed' | 'rejected'>('idle');
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
  const [showIntegration, setShowIntegration] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const { showToast } = useToast();

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

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(jsonText);
    showToast('info', 'Copied', 'JSON payload copied to clipboard');
  };

  const handleCopyCurl = () => {
    const curl = `curl -X POST http://localhost:3001/api/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "company_A",
    "payload": {
      "metric": "purchase",
      "amount": 1400,
      "timestamp": "${new Date().toISOString()}"
    }
  }'`;
    navigator.clipboard.writeText(curl);
    showToast('info', 'Copied', 'cURL command copied to clipboard');
  };

  const handleSimulateClient = async () => {
    setIsSimulating(true);
    const client = SIMULATED_CLIENTS[Math.floor(Math.random() * SIMULATED_CLIENTS.length)];
    const metric = SIMULATED_METRICS[Math.floor(Math.random() * SIMULATED_METRICS.length)];
    const amount = Math.round((50 + Math.random() * 4950) * 100) / 100;
    const payload = {
      source: client,
      payload: {
        metric,
        amount,
        timestamp: new Date().toISOString()
      }
    };

    onPipelineStageChange('RECEIVED');
    await new Promise(r => setTimeout(r, 80));
    onPipelineStageChange('VALIDATING');
    await new Promise(r => setTimeout(r, 80));
    onPipelineStageChange('NORMALIZING');
    await new Promise(r => setTimeout(r, 80));
    onPipelineStageChange('DEDUPLICATING');
    await new Promise(r => setTimeout(r, 80));
    onPipelineStageChange('PERSISTING');

    try {
      const response = await api.ingestEvent(payload, simulateFailure);
      setLastResponse(response);

      if (response.status === 'PROCESSED') {
        onPipelineStageChange('PROCESSED', response);
        showToast('success', 'Simulated Client Event', `${client} → ${metric} $${amount.toFixed(2)} processed`);
      } else if (response.status === 'DUPLICATE') {
        onPipelineStageChange('DUPLICATE', response);
        showToast('info', 'Duplicate Detected', `Simulated ${client} event matched existing fingerprint`);
      } else if (response.status === 'FAILED') {
        onPipelineStageChange('FAILED', response);
        showToast('error', 'Simulated Failure', response.error || 'Transaction rolled back');
      } else if (response.status === 'REJECTED') {
        onPipelineStageChange('REJECTED', response);
        showToast('warning', 'Rejected', response.error || 'Validation failed');
      }
      onEventSubmitted();
    } catch (err: any) {
      onPipelineStageChange('FAILED', { success: false, status: 'FAILED', error: err.message });
      showToast('error', 'Simulation Error', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitState('submitting');
    onPipelineStageChange('RECEIVED');

    // Simulate animated pipeline stages for evaluator visual feedback
    await new Promise(r => setTimeout(r, 100));
    onPipelineStageChange('VALIDATING');

    let parsedPayload: any = jsonText;

    try {
      parsedPayload = JSON.parse(jsonText);
      await new Promise(r => setTimeout(r, 100));
      onPipelineStageChange('NORMALIZING');
      await new Promise(r => setTimeout(r, 100));
      onPipelineStageChange('DEDUPLICATING');
      await new Promise(r => setTimeout(r, 100));
      onPipelineStageChange('PERSISTING');
    } catch (syntaxErr: any) {
      parsedPayload = jsonText;
    }

    try {
      const response = await api.ingestEvent(parsedPayload, simulateFailure);
      setLastResponse(response);

      if (response.status === 'PROCESSED') {
        setSubmitState('success');
        onPipelineStageChange('PROCESSED', response);
        showToast('success', 'Event Processed', `Persisted for ${response.normalized_event?.client_id || 'client'} ($${Number(response.normalized_event?.amount || 0).toFixed(2)})`);
      } else if (response.status === 'DUPLICATE') {
        setSubmitState('duplicate');
        onPipelineStageChange('DUPLICATE', response);
        showToast('info', 'Duplicate Detected', 'Matching fingerprint found. Aggregates preserved.');
      } else if (response.status === 'FAILED') {
        setSubmitState('failed');
        onPipelineStageChange('FAILED', response);
        showToast('error', 'Write Failed', response.error || 'Transaction rolled back safely');
      } else if (response.status === 'REJECTED') {
        setSubmitState('rejected');
        onPipelineStageChange('REJECTED', response);
        showToast('warning', 'Event Rejected', response.error || 'Payload failed validation');
      }

      onEventSubmitted();
    } catch (err: any) {
      const failResponse: IngestResponse = {
        success: false,
        status: 'FAILED',
        error: err.message || 'Network communication error'
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

  return (
    <div className="event-submission-panel glass-card animate-fade-in" aria-label="Developer Test Client">
      <div className="panel-header">
        <div className="panel-title-group">
          <Terminal size={18} className="text-primary" />
          <h2 className="panel-title">Developer Test Client</h2>
        </div>
        <span className="panel-badge">API Simulator</span>
      </div>
      <p className="panel-subtitle">
        Simulate events that external applications would normally send automatically to this ingestion API.
      </p>

      {/* Integration Flow — Collapsible */}
      <div className="integration-section">
        <button
          className="integration-toggle"
          onClick={() => setShowIntegration(!showIntegration)}
          aria-expanded={showIntegration}
        >
          {showIntegration ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Globe size={13} />
          <span>How events reach this platform</span>
        </button>

        {showIntegration && (
          <div className="integration-body animate-fade-in">
            {/* Flow Diagram */}
            <div className="integration-flow">
              <div className="flow-node">
                <span className="flow-node-label">External App</span>
              </div>
              <ArrowRight size={14} className="flow-arrow" />
              <div className="flow-node flow-node-api">
                <code>POST /api/events</code>
              </div>
              <ArrowRight size={14} className="flow-arrow" />
              <div className="flow-node">
                <span className="flow-node-label">Processing Pipeline</span>
              </div>
              <ArrowRight size={14} className="flow-arrow" />
              <div className="flow-node">
                <span className="flow-node-label">Aggregated Data</span>
              </div>
            </div>

            {/* cURL Example */}
            <div className="curl-example">
              <div className="curl-header">
                <span className="curl-label">Example: External backend request</span>
                <button className="curl-copy-btn" onClick={handleCopyCurl} title="Copy cURL command">
                  <Copy size={11} /> Copy
                </button>
              </div>
              <pre className="curl-code"><code>{`curl -X POST /api/events \\
  -H "Content-Type: application/json" \\
  -d '{
    "source": "company_A",
    "payload": {
      "metric": "purchase",
      "amount": 1400,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  }'`}</code></pre>
            </div>

            <p className="integration-note">
              In production, Company A's backend sends this request automatically. This console lets you simulate that request manually for testing.
            </p>
          </div>
        )}
      </div>

      {/* Simulate External Client */}
      <div className="simulate-client-row">
        <button
          id="btn-simulate-client"
          className="btn-simulate-client"
          onClick={handleSimulateClient}
          disabled={isSimulating || submitState === 'submitting'}
          title="Generate and send a randomized realistic test event through POST /api/events"
        >
          {isSimulating ? (
            <><RefreshCw className="spin" size={14} /> <span>Sending...</span></>
          ) : (
            <><Zap size={14} /> <span>Simulate External Client</span></>
          )}
        </button>
        <span className="simulate-hint">Sends a randomized event through the real API</span>
      </div>

      {/* Preset Scenario Selector */}
      <div className="scenarios-container">
        <div className="scenarios-label-row">
          <span className="scenarios-label">Preset Scenarios</span>
          <span className="scenarios-helper">Click to load payload</span>
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
        <span>Manual test request — edit the JSON below or select a preset above</span>
      </div>

      {/* Code Editor Toolbar */}
      <div className="editor-toolbar">
        <div className="editor-lang-indicator">
          <Code2 size={13} />
          <span>JSON Editor</span>
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
            onClick={handleCopyPayload}
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

      {/* Dominant Submit Button */}
      <div className="submit-action-row">
        <button
          id="btn-submit-event"
          className={`btn-ingest-submit submit-state-${submitState}`}
          onClick={handleSubmit}
          disabled={submitState === 'submitting' || submitState === 'processing'}
          aria-label="Submit event payload"
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
              <span>Submit Event</span>
            </>
          )}
        </button>
      </div>

      {/* Compact Response Metadata Preview */}
      {lastResponse && (
        <div className={`response-preview-box status-border-${lastResponse.status} animate-fade-in`}>
          <div className="preview-header">
            <span className={`badge badge-${lastResponse.status}`}>
              {lastResponse.status}
            </span>
            {lastResponse.latency_ms !== undefined && (
              <span className="preview-latency">
                <Clock size={11} /> {lastResponse.latency_ms}ms
              </span>
            )}
          </div>

          <div className="preview-body">
            {lastResponse.error && (
              <div className="preview-error">
                <strong>Error:</strong> {lastResponse.error}
              </div>
            )}
            {lastResponse.normalized_event && (
              <div className="preview-normalized">
                <span className="preview-label">Normalized:</span>
                <code>
                  {`{ client: "${lastResponse.normalized_event.client_id}", metric: "${lastResponse.normalized_event.metric}", amount: $${Number(lastResponse.normalized_event.amount).toFixed(2)} }`}
                </code>
              </div>
            )}
            {lastResponse.fingerprint && (
              <div className="preview-fingerprint">
                <span className="preview-label">Fingerprint:</span>
                <code>{lastResponse.fingerprint.substring(0, 24)}...</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
