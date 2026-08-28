import React from 'react';
import { CheckCircle2, Copy, AlertOctagon, XCircle, DollarSign } from 'lucide-react';
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
  iconBg: string;
  isPrimary?: boolean;
  description: string;
  subStat?: string;
}

const SingleMetricCard: React.FC<StatCardProps> = ({
  title,
  countVal,
  isCurrency = false,
  icon,
  accentColor,
  iconBg,
  isPrimary = false,
  description,
  subStat
}) => {
  const animatedValue = useCountUp(countVal, {
    decimals: isCurrency ? 2 : 0,
    prefix: isCurrency ? '$' : '',
    duration: 600
  });

  return (
    <div className={`metric-card ${isPrimary ? 'card-primary' : ''} animate-fade-in`}>
      <div className="metric-card-inner">
        <div className="metric-card-top">
          <span className="metric-title">{title}</span>
          <div className="metric-icon-box" style={{ background: iconBg, color: accentColor }}>
            {icon}
          </div>
        </div>

        <div className="metric-value-row">
          <span className="metric-number" style={{ color: accentColor }}>
            {animatedValue}
          </span>
          {subStat && <span className="metric-substat">{subStat}</span>}
        </div>

        <p className="metric-description">{description}</p>
      </div>
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
        {/* Total Processed Volume (Primary Dominant Card) */}
        <SingleMetricCard
          title="Processed Volume"
          countVal={totalVolume}
          isCurrency={true}
          icon={<DollarSign size={16} />}
          accentColor="#10b981"
          iconBg="rgba(16, 185, 129, 0.12)"
          isPrimary={true}
          description="Sum of canonical purchase amounts persisted in aggregations"
        />

        {/* Processed Events */}
        <SingleMetricCard
          title="Processed"
          countVal={processedCount}
          icon={<CheckCircle2 size={16} />}
          accentColor="#34d399"
          iconBg="rgba(52, 211, 153, 0.12)"
          subStat={totalEvents > 0 ? `${processedPercent}%` : undefined}
          description="Normalized & atomically committed to database"
        />

        {/* Duplicates Handled */}
        <SingleMetricCard
          title="Duplicate"
          countVal={duplicateCount}
          icon={<Copy size={16} />}
          accentColor="#06b6d4"
          iconBg="rgba(6, 182, 212, 0.12)"
          subStat={totalEvents > 0 ? `${duplicatePercent}%` : undefined}
          description="Idempotent SHA-256 fingerprint hit (aggregates unaffected)"
        />

        {/* Failed Events */}
        <SingleMetricCard
          title="Failed"
          countVal={failedCount}
          icon={<AlertOctagon size={16} />}
          accentColor="#f43f5e"
          iconBg="rgba(244, 63, 94, 0.12)"
          description="Simulated write crash; transaction rolled back"
        />

        {/* Rejected Events */}
        <SingleMetricCard
          title="Rejected"
          countVal={rejectedCount}
          icon={<XCircle size={16} />}
          accentColor="#f59e0b"
          iconBg="rgba(245, 158, 11, 0.12)"
          description="Malformed JSON syntax or missing schema fields"
        />
      </div>
    </section>
  );
};
