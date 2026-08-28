import React from 'react';
import {
  Inbox,
  CheckCircle,
  FileCheck,
  Cpu,
  Fingerprint,
  Database,
  CheckCircle2,
  Copy,
  AlertOctagon,
  XCircle,
  RotateCcw,
  Clock,
  ArrowRight
} from 'lucide-react';

export type PipelineStage =
  | 'IDLE'
  | 'RECEIVED'
  | 'VALIDATING'
  | 'NORMALIZING'
  | 'DEDUPLICATING'
  | 'PERSISTING'
  | 'PROCESSED'
  | 'DUPLICATE'
  | 'FAILED'
  | 'REJECTED';

interface Props {
  currentStage: PipelineStage;
  finalStatus?: 'PROCESSED' | 'DUPLICATE' | 'FAILED' | 'REJECTED' | null;
  latencyMs?: number;
  fingerprint?: string;
  errorMessage?: string;
  clientId?: string;
  amount?: number;
}

interface StepDef {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

export const PipelineVisualizer: React.FC<Props> = ({
  currentStage,
  finalStatus,
  latencyMs,
  fingerprint,
  errorMessage,
  clientId,
  amount
}) => {
  // Determine step states based on currentStage and finalStatus
  const isIdle = currentStage === 'IDLE';

  // Standard steps
  const steps: StepDef[] = [
    {
      id: 'RECEIVED',
      label: '1. Ingest Raw',
      sublabel: 'Audit Log Preserved',
      icon: <Inbox size={16} />
    },
    {
      id: 'VALIDATING',
      label: '2. Validate Schema',
      sublabel: 'Syntax & Required Fields',
      icon: <FileCheck size={16} />
    },
    {
      id: 'NORMALIZING',
      label: '3. Normalize',
      sublabel: 'UTC Time & Currency',
      icon: <Cpu size={16} />
    },
    {
      id: 'DEDUPLICATING',
      label: '4. Fingerprint',
      sublabel: 'Deterministic SHA-256',
      icon: <Fingerprint size={16} />
    },
    {
      id: 'PERSISTING',
      label: '5. Atomic Persist',
      sublabel: 'ACID Transaction Commit',
      icon: <Database size={16} />
    }
  ];

  const getStepState = (stepIndex: number): 'idle' | 'active' | 'completed' | 'failed' | 'skipped' => {
    if (isIdle) return 'idle';

    if (currentStage === 'REJECTED') {
      if (stepIndex === 0) return 'completed';
      if (stepIndex === 1) return 'failed';
      return 'skipped';
    }

    if (currentStage === 'DUPLICATE') {
      if (stepIndex <= 3) return 'completed';
      return 'skipped'; // Persistence skipped because duplicate already exists
    }

    if (currentStage === 'FAILED') {
      if (stepIndex <= 3) return 'completed';
      if (stepIndex === 4) return 'failed'; // Persistence failed -> Rollback
      return 'failed';
    }

    if (currentStage === 'PROCESSED') {
      return 'completed';
    }

    // Active in-progress states
    const stageMap: Record<string, number> = {
      RECEIVED: 0,
      VALIDATING: 1,
      NORMALIZING: 2,
      DEDUPLICATING: 3,
      PERSISTING: 4
    };

    const currentIdx = stageMap[currentStage] ?? 0;
    if (stepIndex < currentIdx) return 'completed';
    if (stepIndex === currentIdx) return 'active';
    return 'idle';
  };

  return (
    <div className="pipeline-container glass-card animate-fade-in" aria-label="Event Processing Pipeline Execution">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Cpu size={18} className="text-primary" />
          <h3 className="pipeline-title">Deterministic Processing Pipeline</h3>
        </div>

        <div className="pipeline-meta">
          {latencyMs !== undefined && latencyMs > 0 && (
            <span className="pipeline-latency-pill">
              <Clock size={12} /> {latencyMs}ms Latency
            </span>
          )}
          {finalStatus && (
            <span className={`badge badge-${finalStatus} animate-fade-in`}>
              Outcome: {finalStatus}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Step Track */}
      <div className="pipeline-track">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          const isLast = idx === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div className={`pipeline-node node-${state}`}>
                <div className="node-icon-circle">
                  {state === 'completed' && <CheckCircle size={16} className="text-emerald" />}
                  {state === 'failed' && <AlertOctagon size={16} className="text-rose" />}
                  {state === 'skipped' && <span className="skip-dash">—</span>}
                  {(state === 'active' || state === 'idle') && step.icon}
                </div>
                <div className="node-info">
                  <span className="node-label">{step.label}</span>
                  <span className="node-sublabel">{step.sublabel}</span>
                </div>
              </div>

              {!isLast && (
                <div className={`pipeline-connector conn-${state}`}>
                  <div className="connector-progress-line" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Terminal Outcome Banner */}
      {!isIdle && finalStatus && (
        <div className={`pipeline-outcome-banner outcome-${finalStatus} animate-fade-in`}>
          <div className="outcome-icon-side">
            {finalStatus === 'PROCESSED' && <CheckCircle2 size={22} className="text-emerald" />}
            {finalStatus === 'DUPLICATE' && <Copy size={22} className="text-cyan" />}
            {finalStatus === 'FAILED' && <AlertOctagon size={22} className="text-rose" />}
            {finalStatus === 'REJECTED' && <XCircle size={22} className="text-amber" />}
          </div>

          <div className="outcome-text-side">
            <div className="outcome-header-line">
              <strong className="outcome-status-title">
                {finalStatus === 'PROCESSED' && '✅ Canonical Event Atomically Committed'}
                {finalStatus === 'DUPLICATE' && '🔁 Idempotent Duplicate Safely Detected'}
                {finalStatus === 'FAILED' && '💥 Transaction Aborted & Rolled Back (Zero Aggregate Mutation)'}
                {finalStatus === 'REJECTED' && '❌ Malformed/Invalid Payload Rejected'}
              </strong>
              {fingerprint && (
                <span className="outcome-fingerprint">
                  FP: <code>{fingerprint.substring(0, 16)}...</code>
                </span>
              )}
            </div>

            <p className="outcome-detail">
              {finalStatus === 'PROCESSED' && (
                <>Event for client <code>{clientId || 'unknown'}</code> (${Number(amount || 0).toFixed(2)}) processed through full pipeline and aggregated.</>
              )}
              {finalStatus === 'DUPLICATE' && (
                <>Existing fingerprint matches in database. Storage insertion skipped to maintain exact-once aggregation semantics.</>
              )}
              {finalStatus === 'FAILED' && (
                <span>
                  Simulated database write crash triggered rollback. Raw event preserved in audit log with status <code>FAILED</code>.
                </span>
              )}
              {finalStatus === 'REJECTED' && (
                <span>
                  Validation or syntax error: {errorMessage || 'Invalid event schema'}.
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
