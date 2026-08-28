import React, { useState } from 'react';
import { Send, FileCode, CheckCircle2, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  onEventSubmitted: () => void;
  simulateFailure: boolean;
}

const PRESETS = {
  cleanEventE: JSON.stringify(
    {
      source: "client_A",
      payload: {
        metric: "purchase",
        amount: "1200",
        timestamp: "2024/01/01"
      }
    },
    null,
    2
  ),
  messyAliases: JSON.stringify(
    {
      client: "client_B",
      payload: {
        action: "checkout",
        price: "$450.75",
        date: "2024-01-01T12:00:00Z",
        campaign: "summer_sale"
      }
    },
    null,
    2
  ),
  corruptedInput: JSON.stringify(
    {
      source: "client_C",
      payload: {
        amount: "not_a_valid_number"
      }
    },
    null,
    2
  )
};

export const EventSubmitter: React.FC<Props> = ({ onEventSubmitted, simulateFailure }) => {
  const [jsonText, setJsonText] = useState<string>(PRESETS.cleanEventE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);

    try {
      let parsedPayload: any;
      try {
        parsedPayload = JSON.parse(jsonText);
      } catch (err: any) {
        setResult({
          success: false,
          status: 'REJECTED',
          error: `Invalid JSON syntax: ${err.message}`
        });
        setLoading(false);
        return;
      }

      const res = await api.ingestEvent(parsedPayload, simulateFailure);
      setResult(res);
      onEventSubmitted();
    } catch (err: any) {
      setResult({
        success: false,
        status: 'FAILED',
        error: `Server processing error: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <FileCode size={20} color="#6366f1" />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Event Ingestion Console</h2>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '12px' }}>
        Select a preset test scenario or edit raw JSON input below:
      </p>

      <div className="preset-grid">
        <button
          id="preset-clean-e"
          className="btn-preset"
          onClick={() => setJsonText(PRESETS.cleanEventE)}
        >
          📄 Event E (Client A)
        </button>
        <button
          id="preset-duplicate-e"
          className="btn-preset"
          onClick={() => setJsonText(PRESETS.cleanEventE)}
        >
          🔁 Duplicate Event E
        </button>
        <button
          id="preset-messy-aliases"
          className="btn-preset"
          onClick={() => setJsonText(PRESETS.messyAliases)}
        >
          🔀 Messy Field Aliases
        </button>
        <button
          id="preset-corrupted"
          className="btn-preset"
          onClick={() => setJsonText(PRESETS.corruptedInput)}
        >
          ❌ Corrupted / Malformed
        </button>
      </div>

      <textarea
        id="raw-json-editor"
        className="editor-box"
        value={jsonText}
        onChange={e => setJsonText(e.target.value)}
        placeholder="Paste raw JSON event payload here..."
      />

      <button
        id="btn-submit-event"
        className="btn-primary"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
        {loading ? 'Ingesting Payload...' : 'Submit Raw Event'}
      </button>

      {/* Response Feedback Container */}
      {result && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            borderRadius: '10px',
            background: result.success
              ? result.status === 'DUPLICATE'
                ? 'rgba(6, 182, 212, 0.15)'
                : 'rgba(16, 185, 129, 0.15)'
              : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${
              result.success
                ? result.status === 'DUPLICATE'
                  ? 'rgba(6, 182, 212, 0.4)'
                  : 'rgba(16, 185, 129, 0.4)'
                : 'rgba(239, 68, 68, 0.4)'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            {result.success ? (
              <CheckCircle2 size={18} color={result.status === 'DUPLICATE' ? '#06b6d4' : '#10b981'} />
            ) : (
              <AlertCircle size={18} color="#ef4444" />
            )}
            <strong style={{ fontSize: '0.9rem' }}>
              Status Response: <span className={`badge badge-${result.status}`}>{result.status}</span>
            </strong>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#e5e7eb', fontFamily: 'var(--font-mono)' }}>
            {result.message || result.error || JSON.stringify(result)}
          </p>

          {result.fingerprint && (
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
              Fingerprint: <span className="code-inline">{result.fingerprint.substring(0, 16)}...</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
