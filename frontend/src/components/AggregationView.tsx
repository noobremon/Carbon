import React, { useState, useEffect } from 'react';
import { AggregateResult, api } from '../api/client';
import { BarChart3, Filter, RefreshCw, Layers, DollarSign } from 'lucide-react';

export const AggregationView: React.FC = () => {
  const [aggregates, setAggregates] = useState<AggregateResult[]>([]);
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAggregates = async () => {
    setLoading(true);
    try {
      const res = await api.getAggregates({
        client_id: clientId || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate).toISOString() : undefined
      });
      if (res.success) {
        setAggregates(res.aggregates);
      }
    } catch (err) {
      console.error('Error fetching aggregates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAggregates();
  }, [clientId, startDate, endDate]);

  const totalVolume = aggregates.reduce((sum, a) => sum + Number(a.total_amount), 0);
  const totalCount = aggregates.reduce((sum, a) => sum + Number(a.event_count), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={20} color="#6366f1" />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Persisted Aggregation Metrics</h3>
        </div>
        <button className="btn-preset" onClick={fetchAggregates} style={{ padding: '6px 12px' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Stats
        </button>
      </div>

      {/* Filters bar */}
      <div className="filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Filter size={16} color="#9ca3af" />
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filters:</span>
        </div>
        <input
          id="filter-client-id"
          type="text"
          className="input-field"
          placeholder="Filter by Client ID (e.g. client_A)"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
        />
        <input
          id="filter-start-date"
          type="date"
          className="input-field"
          title="Start Date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        <input
          id="filter-end-date"
          type="date"
          className="input-field"
          title="End Date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
        {(clientId || startDate || endDate) && (
          <button
            className="btn-preset"
            onClick={() => {
              setClientId('');
              setStartDate('');
              setEndDate('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Aggregate Cards */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="glass-card stat-card">
          <div className="stat-lbl">Total Processed Volume</div>
          <div className="stat-val" style={{ color: '#34d399' }}>
            ${totalVolume.toFixed(2)}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-lbl">Total Processed Events</div>
          <div className="stat-val" style={{ color: '#60a5fa' }}>
            {totalCount}
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      {aggregates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
          <p>No processed aggregate records found for specified filter.</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>Processed Event Count</th>
                <th>Total Volume Amount</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a, idx) => (
                <tr key={`${a.client_id}-${idx}`}>
                  <td>
                    <span className="code-inline" style={{ color: '#60a5fa' }}>
                      {a.client_id || 'All Clients'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {a.event_count}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: 700 }}>
                    ${Number(a.total_amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
