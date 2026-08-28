import React from 'react';
import { CheckCircle2, Copy, AlertOctagon, XCircle, DollarSign, TrendingUp } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

interface MetricProps {
  processedCount: number;
  duplicateCount: number;
  failedCount: number;
  rejectedCount: number;
  totalVolume: number;
  totalEvents: number;
}

interface StatCardProps {
  title: string;
  countVal: number;
  isCurrency?: boolean;
  icon: React.ReactNode;
  accentColor: string;
  bgGradient: string;
  badgeClass: string;
  description: string;
  subStat?: string;
}

const SingleMetricCard: React.FC<StatCardProps> = ({
  title,
  countVal,
  isCurrency = false,
  icon,
  accentColor,
  bgGradient,
  badgeClass,
  description,
  subStat
}) => {
  const animatedValue = useCountUp(countVal, {
    decimals: isCurrency ? 2 : 0,
    prefix: isCurrency ? '$' : '',
    duration: 700
  });

  return (
    <div className={`metric-card ${badgeClass} animate-fade-in`}>
      <div className="metric-card-inner">
        <div className="metric-card-top">
          <div className="metric-icon-box" style={{ background: bgGradient, color: accentColor }}>
            {icon}
          </div>
          <span className="metric-title">{title}</span>
        </div>

        <div className="metric-value-row">
          <span className="metric-number" style={{ color: accentColor }}>
            {animatedValue}
          </span>
          {subStat && <span className="metric-substat">{subStat}</span>}
        </div>

        <p className="metric-description">{description}</p>
      </div>
      <div className="metric-card-glow" style={{ background: accentColor }} />
    </div>
  );
};

export const MetricCards: React.FC<MetricProps> = ({
  processedCount,
  duplicateCount,
  failedCount,
  rejectedCount,
  totalVolume,
  totalEvents
}) => {
  const processedPercent = totalEvents > 0 ? Math.round((processedCount / totalEvents) * 100) : 0;
  const duplicatePercent = totalEvents > 0 ? Math.round((duplicateCount / totalEvents) * 100) : 0;

  return (
    <section className="metrics-grid-container" aria-label="System Metrics Summary">
      <div className="metrics-grid">
        {/* Total Processed Volume */}
        <SingleMetricCard
          title="Processed Volume"
          countVal={totalVolume}
          isCurrency={true}
          icon={<DollarSign size={20} />}
          accentColor="#10b981"
          bgGradient="rgba(16, 185, 129, 0.15)"
          badgeClass="card-processed"
          description="Sum of canonical purchase amounts persisted in aggregations"
        />

        {/* Processed Events */}
        <SingleMetricCard
          title="Processed"
          countVal={processedCount}
          icon={<CheckCircle2 size={20} />}
          accentColor="#34d399"
          bgGradient="rgba(52, 211, 153, 0.15)"
          badgeClass="card-processed"
          subStat={totalEvents > 0 ? `${processedPercent}%` : undefined}
          description="Normalized & atomically committed to aggregate store"
        />

        {/* Duplicates Handled */}
        <SingleMetricCard
          title="Duplicate"
          countVal={duplicateCount}
          icon={<Copy size={20} />}
          accentColor="#06b6d4"
          bgGradient="rgba(6, 182, 212, 0.15)"
          badgeClass="card-duplicate"
          subStat={totalEvents > 0 ? `${duplicatePercent}%` : undefined}
          description="Idempotent SHA-256 fingerprint hit (aggregates unaffected)"
        />

        {/* Failed Events */}
        <SingleMetricCard
          title="Failed"
          countVal={failedCount}
          icon={<AlertOctagon size={20} />}
          accentColor="#f43f5e"
          bgGradient="rgba(244, 63, 94, 0.15)"
          badgeClass="card-failed"
          description="Simulated DB failure or crash; transaction rolled back"
        />

        {/* Rejected Events */}
        <SingleMetricCard
          title="Rejected"
          countVal={rejectedCount}
          icon={<XCircle size={20} />}
          accentColor="#f59e0b"
          bgGradient="rgba(245, 158, 11, 0.15)"
          badgeClass="card-rejected"
          description="Malformed JSON syntax or missing mandatory schema fields"
        />
      </div>
    </section>
  );
};
