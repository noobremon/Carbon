import React from 'react';
import {
  Inbox,
  FileCheck,
  Cpu,
  Fingerprint,
  Database,
  CheckCircle2,
  Copy,
  AlertOctagon,
  XCircle,
  Clock
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
  num: string;
  title: string;
  desc: string;
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
  const isIdle = currentStage === 'IDLE';

  const steps: StepDef[] = [
    {
      num: '01',
      title: 'Receive',
      desc: 'Raw audit preserved',
      icon: <Inbox size={18} />
    },
    {
      num: '02',
      title: 'Validate',
      desc: 'Schema & required fields',
      icon: <FileCheck size={18} />
    },
    {
      num: '03',
      title: 'Normalize',
      desc: 'Canonical data',
      icon: <Cpu size={18} />
    },
    {
      num: '04',
      title: 'Fingerprint',
      desc: 'Deterministic SHA-256',
      icon: <Fingerprint size={18} />
    },
    {
      num: '05',
      title: 'Persist',
      desc: 'Atomic transaction',
      icon: <Database size={18} />
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
      return 'skipped';
    }

    if (currentStage === 'FAILED') {
      if (stepIndex <= 3) return 'completed';
      if (stepIndex === 4) return 'failed';
      return 'failed';
    }

    if (currentStage === 'PROCESSED') {
      return 'completed';
    }

    // Active intermediate stages
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
    <section className="pipeline-card glass-card animate-fade-in" aria-label="Event Processing Pipeline Execution">
      <div className="pipeline-header">
        <div className="pipeline-title-group">
          <Cpu size={16} className="text-primary" />
          <h3 className="pipeline-title">Deterministic Processing Pipeline</h3>
        </div>

        <div className="pipeline-meta">
          {latencyMs !== undefined && latencyMs > 0 && (
            <span className="pipeline-latency-pill">
              <Clock size={11} /> {latencyMs}ms latency
            </span>
          )}
          {finalStatus && (
            <span className={`badge badge-${finalStatus}`}>
              {finalStatus}
            </span>
          )}
        </div>
      </div>

      {/* 5-Stage Pipeline Stepper */}
      <div className="pipeline-stepper">
        {steps.map((step, idx) => {
          const state = getStepState(idx);

          return (
            <React.Fragment key={step.num}>
              <div className={`stepper-stage stage-${state}`}>
                {/* Icon circle */}
                <div className="stage-icon-circle">
                  <span className="stage-icon">{step.icon}</span>
                </div>
                {/* Labels below icon */}
                <div className="stage-labels">
                  <span className="stage-title">{step.num}. {step.title}</span>
                  <span className="stage-desc">{step.desc}</span>
                </div>
              </div>
              {/* Connector between steps (not after the last) */}
              {idx < steps.length - 1 && (
                <div className={`stepper-connector connector-${getStepState(idx) === 'completed' && getStepState(idx + 1) !== 'idle' ? 'active' : 'idle'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Terminal Outcome Banner */}
      {!isIdle && finalStatus && (
        <div className={`pipeline-outcome-banner outcome-${finalStatus} animate-fade-in`}>
          <div className="outcome-icon-side">
            {finalStatus === 'PROCESSED' && <CheckCircle2 size={18} className="text-emerald" />}
            {finalStatus === 'DUPLICATE' && <Copy size={18} className="text-cyan" />}
            {finalStatus === 'FAILED' && <AlertOctagon size={18} className="text-rose" />}
            {finalStatus === 'REJECTED' && <XCircle size={18} className="text-amber" />}
          </div>

          <div className="outcome-text-side">
            <div className="outcome-header-line">
              <span className="outcome-status-title">
                {finalStatus === 'PROCESSED' && 'Canonical event persisted successfully'}
                {finalStatus === 'DUPLICATE' && 'Duplicate event detected (idempotent skip)'}
                {finalStatus === 'FAILED' && 'Transaction rolled back (zero aggregate mutation)'}
                {finalStatus === 'REJECTED' && 'Payload rejected by validation'}
              </span>
              {fingerprint && (
                <span className="outcome-fingerprint">
                  FP: <code>{fingerprint.substring(0, 16)}...</code>
                </span>
              )}
            </div>

            <p className="outcome-detail">
              {finalStatus === 'PROCESSED' && (
                <>Event for client <code>{clientId || 'unknown'}</code> (${Number(amount || 0).toFixed(2)}) processed through pipeline and committed to aggregates.</>
              )}
              {finalStatus === 'DUPLICATE' && (
                <>Existing SHA-256 fingerprint matched in store. Re-aggregation skipped to guarantee exactly-once semantics.</>
              )}
              {finalStatus === 'FAILED' && (
                <span>
                  Simulated database write crash caught mid-request. Raw audit record preserved with status <code>FAILED</code>.
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
    </section>
  );
};
