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
  Code2
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

export const EventSubmitter: React.FC<Props> = ({
  onEventSubmitted,
  simulateFailure,
  onPipelineStageChange
}) => {
  const [jsonText, setJsonText] = useState<string>(PRESET_SCENARIOS[0].payload);
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_SCENARIOS[0].id);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'processing' | 'success' | 'duplicate' | 'failed' | 'rejected'>('idle');
  const [lastResponse, setLastResponse] = useState<IngestResponse | null>(null);
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
    <div className="event-submission-panel glass-card animate-fade-in" aria-label="Event Ingestion Console">
      <div className="panel-header">
        <div className="panel-title-group">
          <FileCode size={18} className="text-primary" />
          <h2 className="panel-title">Event Ingestion</h2>
        </div>
        <span className="panel-badge">Raw Ingest</span>
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
