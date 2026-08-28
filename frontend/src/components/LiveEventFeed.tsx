import React, { useState } from 'react';
import { RawEventEntity } from '../api/client';
import {
  Layers,
  CheckCircle2,
  AlertOctagon,
  Copy,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  events: RawEventEntity[];
  filterStatus?: 'ALL' | 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'FAILED' | 'FAILED_OR_REJECTED';
  onLoadExample?: () => void;
}

export const LiveEventFeed: React.FC<Props> = ({
  events,
  filterStatus = 'ALL',
  onLoadExample
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { showToast } = useToast();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast('info', 'Copied', `${label} copied to clipboard`);
  };

  const filteredEvents = events.filter(ev => {
    if (filterStatus === 'FAILED_OR_REJECTED') {
      if (ev.status !== 'FAILED' && ev.status !== 'REJECTED') return false;
    } else if (filterStatus !== 'ALL' && ev.status !== filterStatus) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchId = String(ev.id).includes(q);
      const matchClient = ev.client_id?.toLowerCase().includes(q);
      const matchMetric = ev.metric?.toLowerCase().includes(q);
      const matchError = ev.error_message?.toLowerCase().includes(q);
      const matchFingerprint = ev.fingerprint?.toLowerCase().includes(q);
      return matchId || matchClient || matchMetric || matchError || matchFingerprint;
    }
    return true;
  });

  const getStatusBadge = (status: RawEventEntity['status']) => {
    switch (status) {
      case 'PROCESSED':
        return (
          <span className="badge badge-PROCESSED">
            <CheckCircle2 size={11} /> Processed
          </span>
        );
      case 'DUPLICATE':
        return (
          <span className="badge badge-DUPLICATE">
            <Copy size={11} /> Duplicate
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-FAILED">
            <AlertOctagon size={11} /> Failed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-REJECTED">
            <XCircle size={11} /> Rejected
          </span>
        );
      default:
        return <span className="badge badge-RECEIVED">{status}</span>;
    }
  };

  return (
    <div className="event-feed-container animate-fade-in" aria-label="Event Ingestion Audit Feed">
      {/* Feed Toolbar */}
      <div className="feed-toolbar">
        <div className="feed-search-wrapper">
          <Search size={14} className="feed-search-icon" />
          <input
            id="input-search-feed"
            type="text"
            className="feed-search-input"
            placeholder="Search by client, metric, ID, fingerprint..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Filter events by keyword"
          />
          {searchTerm && (
            <button
              className="feed-clear-search"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="feed-counter">
          <span className="counter-label">Showing:</span>
          <span className="counter-val">{filteredEvents.length} of {events.length}</span>
        </div>
      </div>

      {/* Events Table / Empty State */}
      {filteredEvents.length === 0 ? (
        <div className="feed-empty-state">
          <div className="empty-icon-circle">
            <Layers size={22} />
          </div>
          <h4 className="empty-title">
            {events.length === 0 ? 'No events yet' : 'No matching events found'}
          </h4>
          <p className="empty-desc">
            {events.length === 0
              ? 'Submit an event using the Ingestion Console to begin monitoring the pipeline.'
              : `No events recorded matching "${filterStatus === 'FAILED_OR_REJECTED' ? 'Failed/Rejected' : filterStatus}" or your search term.`}
          </p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="Raw Ingestion and Processed Events Table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '120px' }}>Status</th>
                <th>Client</th>
                <th>Metric / Amount</th>
                <th>Timestamp</th>
                <th>Payload / Error Trace</th>
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(ev => {
                const isExpanded = expandedId === ev.id;
                const receivedDate = new Date(ev.received_at).toLocaleTimeString();
                const eventTimestamp = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : receivedDate;

                return (
                  <React.Fragment key={ev.id}>
                    <tr
                      className={`feed-row status-row-${ev.status} ${isExpanded ? 'row-expanded' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="cell-id">
                        <span className="id-badge">#{ev.id}</span>
                      </td>

                      <td className="cell-status">
                        {getStatusBadge(ev.status)}
                      </td>

                      <td className="cell-client">
                        {ev.client_id ? (
                          <span className="client-pill">{ev.client_id}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="cell-amount">
                        <div className="amount-col">
                          {ev.amount !== undefined ? (
                            <span className="amount-val">${Number(ev.amount).toFixed(2)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                          {ev.metric && <span className="metric-tag">{ev.metric}</span>}
                        </div>
                      </td>

                      <td className="cell-timestamp">
                        <div className="time-col">
                          <span className="time-primary">{eventTimestamp}</span>
                          <span className="time-received">Recv: {receivedDate}</span>
                        </div>
                      </td>

                      <td className="cell-payload">
                        {ev.error_message ? (
                          <div className="error-pill" title={ev.error_message}>
                            <AlertOctagon size={12} />
                            <span>{ev.error_message}</span>
                          </div>
                        ) : (
                          <div className="payload-snippet">
                            <code>{JSON.stringify(ev.raw_payload).substring(0, 45)}...</code>
                          </div>
                        )}
                      </td>

                      <td className="cell-expand">
                        <button
                          className="btn-expand"
                          aria-label={isExpanded ? 'Collapse payload' : 'Expand payload'}
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Details Drawer */}
                    {isExpanded && (
                      <tr className="drawer-row">
                        <td colSpan={7}>
                          <div className="event-drawer-content animate-fade-in">
                            <div className="drawer-grid">
                              {/* Metadata Column */}
                              <div className="drawer-meta-col">
                                <h5 className="drawer-section-title">Audit Metadata</h5>
                                <div className="meta-list">
                                  <div className="meta-item">
                                    <span className="meta-label">Record ID:</span>
                                    <span className="meta-val">#{ev.id}</span>
                                  </div>
                                  <div className="meta-item">
                                    <span className="meta-label">Ingest Status:</span>
                                    <span className="meta-val">{getStatusBadge(ev.status)}</span>
                                  </div>
                                  <div className="meta-item">
                                    <span className="meta-label">Client ID:</span>
                                    <span className="meta-val">{ev.client_id || 'N/A'}</span>
                                  </div>
                                  <div className="meta-item">
                                    <span className="meta-label">Normalized Amount:</span>
                                    <span className="meta-val">{ev.amount !== undefined ? `$${Number(ev.amount).toFixed(2)}` : 'N/A'}</span>
                                  </div>
                                  <div className="meta-item">
                                    <span className="meta-label">Received At:</span>
                                    <span className="meta-val">{new Date(ev.received_at).toISOString()}</span>
                                  </div>
                                  {ev.timestamp && (
                                    <div className="meta-item">
                                      <span className="meta-label">Event Timestamp:</span>
                                      <span className="meta-val">{ev.timestamp}</span>
                                    </div>
                                  )}
                                  {ev.fingerprint && (
                                    <div className="meta-item meta-item-fingerprint">
                                      <span className="meta-label">SHA-256 Fingerprint:</span>
                                      <div className="fingerprint-copy-row">
                                        <code>{ev.fingerprint}</code>
                                        <button
                                          className="btn-mini-copy"
                                          onClick={e => {
                                            e.stopPropagation();
                                            handleCopy(ev.fingerprint!, 'Fingerprint');
                                          }}
                                          title="Copy Fingerprint"
                                        >
                                          <Copy size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Raw Payload Column */}
                              <div className="drawer-payload-col">
                                <div className="drawer-code-header">
                                  <h5 className="drawer-section-title">Raw Ingest Payload</h5>
                                  <button
                                    className="btn-mini-copy"
                                    onClick={e => {
                                      e.stopPropagation();
                                      handleCopy(JSON.stringify(ev.raw_payload, null, 2), 'Raw Payload');
                                    }}
                                    title="Copy Raw Payload"
                                  >
                                    <Copy size={11} /> Copy JSON
                                  </button>
                                </div>
                                <pre className="drawer-code-block">
                                  {typeof ev.raw_payload === 'string'
                                    ? ev.raw_payload
                                    : JSON.stringify(ev.raw_payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
