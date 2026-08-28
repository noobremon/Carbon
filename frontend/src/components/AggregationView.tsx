import React, { useState, useEffect } from 'react';
import { AggregateResult, api } from '../api/client';
import {
  BarChart3,
  Filter,
  RefreshCw,
  Layers,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  X,
  PieChart,
  ArrowUpRight
} from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';
import { useToast } from './Toast';

export const AggregationView: React.FC = () => {
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const fetchAggregates = async () => {
    setLoading(true);
    try {
      const res = await api.getAggregates({
        client_id: clientId.trim() || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined
      });
      if (res.success) {
        setAggregates(res.aggregates);
      }
    } catch (err: any) {
      console.error('Error fetching aggregates:', err);
      showToast('error', 'Aggregation Error', 'Failed to retrieve persisted aggregate stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAggregates();
  }, [clientId, startDate, endDate]);

  const totalVolume = aggregates.reduce((sum, a) => sum + Number(a.total_amount), 0);
  const totalCount = aggregates.reduce((sum, a) => sum + Number(a.event_count), 0);

  const animatedTotalVolume = useCountUp(totalVolume, {
    decimals: 2,
    prefix: '$',
    duration: 600
  });

  const animatedTotalCount = useCountUp(totalCount, {
    decimals: 0,
    duration: 600
  });

  const maxClientVolume = Math.max(...aggregates.map(a => Number(a.total_amount)), 1);
  const maxClientCount = Math.max(...aggregates.map(a => Number(a.event_count)), 1);

  const handleClearFilters = () => {
    setClientId('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="analytics-view-container animate-fade-in" aria-label="Persisted Aggregation Analytics">
      {/* Analytics Header & Controls */}
      <div className="analytics-header">
        <div className="analytics-title-group">
          <BarChart3 size={20} className="text-primary" />
          <h3 className="analytics-title">Persisted Aggregation Metrics</h3>
        </div>
        <button
          className="btn-header-action"
          onClick={fetchAggregates}
          disabled={loading}
          aria-label="Refresh aggregate metrics"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="analytics-filter-card">
        <div className="filter-card-header">
          <div className="filter-title-row">
            <Filter size={15} className="text-muted" />
            <span className="filter-title">Filter Aggregation Query</span>
          </div>
          {(clientId || startDate || endDate) && (
            <button
              className="btn-clear-filters"
              onClick={handleClearFilters}
              aria-label="Clear active filters"
            >
              <X size={13} /> Clear Filters
            </button>
          )}
        </div>

        <div className="filter-inputs-grid">
          <div className="filter-input-group">
            <label htmlFor="filter-client-id" className="input-label">
              <Users size={13} /> Client ID
            </label>
            <input
              id="filter-client-id"
              type="text"
              className="filter-text-input"
              placeholder="e.g. client_A"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-start-date" className="input-label">
              <Calendar size={13} /> Start Date
            </label>
            <input
              id="filter-start-date"
              type="date"
              className="filter-text-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-end-date" className="input-label">
              <Calendar size={13} /> End Date
            </label>
            <input
              id="filter-end-date"
              type="date"
              className="filter-text-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="quick-filters-row">
          <span className="quick-label">Quick Client Filters:</span>
          {['client_A', 'client_B', 'client_C', 'client_DEMO_E'].map(c => (
            <button
              key={c}
              className={`chip-quick-filter ${clientId === c ? 'active' : ''}`}
              onClick={() => setClientId(clientId === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="analytics-kpi-grid">
        <div className="kpi-card kpi-volume">
          <div className="kpi-icon-box">
            <DollarSign size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Filtered Volume Total</span>
            <span className="kpi-value text-emerald">{animatedTotalVolume}</span>
          </div>
        </div>

        <div className="kpi-card kpi-count">
          <div className="kpi-icon-box">
            <Layers size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Aggregated Processed Events</span>
            <span className="kpi-value text-cyan">{animatedTotalCount}</span>
          </div>
        </div>

        <div className="kpi-card kpi-clients">
          <div className="kpi-icon-box">
            <Users size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Distinct Clients Represented</span>
            <span className="kpi-value text-primary">{aggregates.length}</span>
          </div>
        </div>
      </div>

      {/* Visual Client Breakdown Bars */}
      {aggregates.length > 0 && (
        <div className="client-distribution-card glass-card">
          <h4 className="dist-title">Volume & Event Distribution by Client</h4>
          <div className="dist-bars-list">
            {aggregates.map((item, idx) => {
              const amount = Number(item.total_amount);
              const volumePercent = totalVolume > 0 ? Math.round((amount / totalVolume) * 100) : 0;
              const countPercent = totalCount > 0 ? Math.round((item.event_count / totalCount) * 100) : 0;
              const barWidth = Math.max(Math.round((amount / maxClientVolume) * 100), 4);

              return (
                <div key={`${item.client_id}-${idx}`} className="dist-item-row">
                  <div className="dist-item-header">
                    <div className="dist-client-badge">
                      <Users size={13} />
                      <span className="dist-client-name">{item.client_id || 'All Clients'}</span>
                    </div>
                    <div className="dist-metrics-summary">
                      <span className="dist-events-count">{item.event_count} events ({countPercent}%)</span>
                      <strong className="dist-amount-total">${amount.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="dist-bar-track">
                    <div
                      className="dist-bar-fill"
                      style={{ width: `${barWidth}%` }}
                      title={`${item.client_id}: $${amount.toFixed(2)} (${volumePercent}% of total)`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aggregate Data Table */}
      {aggregates.length === 0 ? (
        <div className="analytics-empty-state">
          <Layers size={36} className="empty-icon text-muted" />
          <h4 className="empty-title">No persisted aggregate records found</h4>
          <p className="empty-desc">
            {clientId || startDate || endDate
              ? 'No processed events match the selected client ID or date range filters.'
              : 'Submit events via the Ingestion Console to generate canonical aggregate metrics.'}
          </p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="Client Aggregate Metrics Table">
            <thead>
              <tr>
                <th>Client Identifier</th>
                <th>Processed Event Count</th>
                <th>Aggregated Volume Total</th>
                <th>Average / Event</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a, idx) => {
                const amount = Number(a.total_amount);
                const avg = a.event_count > 0 ? amount / a.event_count : 0;

                return (
                  <tr key={`${a.client_id}-${idx}`}>
                    <td>
                      <span className="client-pill">{a.client_id || 'All Clients'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {a.event_count}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>
                      ${amount.toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: '#9ca3af' }}>
                      ${avg.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
