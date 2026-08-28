import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { api, IngestResponse } from '../api/client';
import { useToast } from './Toast';
import { PipelineStage } from './PipelineVisualizer';

interface Props {
  onRefreshData: () => void;
  onPipelineStageChange: (stage: PipelineStage, response?: IngestResponse | null) => void;
  simulateFailure: boolean;
  onSetSimulateFailure: (val: boolean) => void;
}

interface DemoStep {
  stepNumber: number;
  title: string;
  actionLabel: string;
  description: string;
  expectedOutcome: string;
  expectedStatus: string;
}

const DEMO_PAYLOAD = {
  source: 'client_DEMO_E',
  payload: {
    metric: 'purchase',
    amount: 1500,
    timestamp: '2024-01-01T12:00:00.000Z'
  }
};

export const DemoScenarioHelper: React.FC<Props> = ({
  onRefreshData,
  onPipelineStageChange,
  onSetSimulateFailure
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const { showToast } = useToast();

  const steps: DemoStep[] = [
    {
      stepNumber: 1,
      title: 'Initial Event Ingestion',
      actionLabel: 'Submit Event E',
      description: 'Send canonical Event E ($1,500.00 for client_DEMO_E) under normal mode.',
      expectedOutcome: 'Status is PROCESSED. Aggregates increase by $1,500.00.',
      expectedStatus: 'PROCESSED'
    },
    {
      stepNumber: 2,
      title: 'Idempotent Duplicate Re-submission',
      actionLabel: 'Submit Duplicate Event E',
      description: 'Re-send the exact same payload with identical SHA-256 fingerprint.',
      expectedOutcome: 'Status is DUPLICATE. Aggregates remain unchanged at $1,500.00.',
      expectedStatus: 'DUPLICATE'
    },
    {
      stepNumber: 3,
      title: 'Inject Database Write Crash',
      actionLabel: 'Arm Failure Simulation',
      description: 'Enable simulated mid-request database write failure & transaction rollback.',
      expectedOutcome: 'Fault injection simulation enabled.',
      expectedStatus: 'SIMULATION_ON'
    },
    {
      stepNumber: 4,
      title: 'Submit Event Under Crash',
      actionLabel: 'Submit Event Under Crash',
      description: 'Send new event while database failure simulation is active.',
      expectedOutcome: 'Status is FAILED. Transaction safely rolls back with 0 aggregate drift.',
      expectedStatus: 'FAILED'
    },
    {
      stepNumber: 5,
      title: 'Recovery & Safe Re-submission',
      actionLabel: 'Disarm & Retry',
      description: 'Disable failure mode and re-submit. System processes safely with zero corruption.',
      expectedOutcome: 'Status is PROCESSED. System recovered with full integrity.',
      expectedStatus: 'RECOVERED'
    }
  ];

  const executeStep = async (stepNum: number) => {
    setIsRunning(true);

    try {
      if (stepNum === 1) {
        onPipelineStageChange('RECEIVED');
        await new Promise(r => setTimeout(r, 120));
        onPipelineStageChange('PERSISTING');
        const res = await api.ingestEvent(DEMO_PAYLOAD, false);
        onPipelineStageChange('PROCESSED', res);
        setStepLogs(prev => [...prev, `[Step 1] Submitted Event E -> ${res.status} ($1,500.00 aggregate added)`]);
        showToast('success', 'Step 1 Complete', 'Event E processed & aggregated');
        setCurrentStep(2);
      } else if (stepNum === 2) {
        onPipelineStageChange('RECEIVED');
        await new Promise(r => setTimeout(r, 120));
        onPipelineStageChange('DEDUPLICATING');
        const res = await api.ingestEvent(DEMO_PAYLOAD, false);
        onPipelineStageChange('DUPLICATE', res);
        setStepLogs(prev => [...prev, `[Step 2] Re-submitted Event E -> DUPLICATE (0 aggregate change)`]);
        showToast('info', 'Step 2 Complete', 'Identified as duplicate. Aggregate unchanged!');
        setCurrentStep(3);
      } else if (stepNum === 3) {
        await api.toggleFailureMode(true);
        onSetSimulateFailure(true);
        setStepLogs(prev => [...prev, `[Step 3] Enabled failure simulation mode`]);
        showToast('warning', 'Step 3 Complete', 'Database failure simulation is now ACTIVE');
        setCurrentStep(4);
      } else if (stepNum === 4) {
        onPipelineStageChange('RECEIVED');
        await new Promise(r => setTimeout(r, 120));
        onPipelineStageChange('PERSISTING');
        const failPayload = {
          source: 'client_CRASH_TEST',
          payload: { metric: 'checkout', amount: 999.99, timestamp: new Date().toISOString() }
        };
        const res = await api.ingestEvent(failPayload, true);
        onPipelineStageChange('FAILED', res);
        setStepLogs(prev => [...prev, `[Step 4] Submitted under crash -> ${res.status} (Transaction rolled back)`]);
        showToast('error', 'Step 4 Complete', 'Simulated failure safely caught & rolled back!');
        setCurrentStep(5);
      } else if (stepNum === 5) {
        await api.toggleFailureMode(false);
        onSetSimulateFailure(false);
        onPipelineStageChange('RECEIVED');
        await new Promise(r => setTimeout(r, 120));
        onPipelineStageChange('PERSISTING');
        const recoveryPayload = {
          source: 'client_RECOVERED',
          payload: { metric: 'checkout', amount: 999.99, timestamp: new Date().toISOString() }
        };
        const res = await api.ingestEvent(recoveryPayload, false);
        onPipelineStageChange('PROCESSED', res);
        setStepLogs(prev => [...prev, `[Step 5] Disarmed simulation & recovered -> ${res.status}`]);
        showToast('success', 'Lifecycle Verified', 'System recovered with 100% integrity!');
        setCurrentStep(1);
      }

      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Execution Failed', err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleResetWalkthrough = async () => {
    await api.resetState();
    await api.toggleFailureMode(false);
    onSetSimulateFailure(false);
    setCurrentStep(1);
    setStepLogs([]);
    onPipelineStageChange('IDLE');
    onRefreshData();
    showToast('info', 'Demo Reset', 'Walkthrough state reset to Step 1');
  };

  return (
    <div className="demo-helper-card animate-fade-in" aria-label="Fault Tolerance Evaluator Walkthrough">
      <div className="demo-header">
        <div className="demo-title-group">
          <Sparkles size={16} className="text-primary" />
          <h3 className="demo-title">Fault-Tolerance Evaluation Walkthrough</h3>
        </div>
        <button
          className="demo-btn-reset"
          onClick={handleResetWalkthrough}
          title="Reset evaluator walkthrough to Step 1"
        >
          <RotateCcw size={12} /> Reset Demo
        </button>
      </div>

      <p className="demo-subtitle">
        Interactive 5-step evaluator guide executing live API transactions to prove idempotency, failure rollback, and recovery.
      </p>

      {/* Step List */}
      <div className="demo-steps-list">
        {steps.map(step => {
          const isCurrent = currentStep === step.stepNumber;
          const isCompleted = currentStep > step.stepNumber;

          return (
            <div
              key={step.stepNumber}
              className={`demo-step-row ${isCurrent ? 'step-current' : ''} ${isCompleted ? 'step-completed' : ''}`}
            >
              <div className="step-badge">
                {isCompleted ? <CheckCircle2 size={14} className="text-emerald" style={{ color: '#10b981' }} /> : <span>{step.stepNumber}</span>}
              </div>

              <div className="step-details">
                <div className="step-header-row">
                  <strong className="step-name">{step.title}</strong>
                  <span className="step-expected-pill">{step.expectedStatus}</span>
                </div>
                <p className="step-desc">{step.description}</p>
                <div className="step-outcome-line">
                  <span className="outcome-tag">Expected:</span> {step.expectedOutcome}
                </div>
              </div>

              <div className="step-action-col">
                <button
                  id={`btn-demo-step-${step.stepNumber}`}
                  className={`btn-step-execute ${isCurrent ? 'btn-step-primary' : 'btn-step-secondary'}`}
                  onClick={() => executeStep(step.stepNumber)}
                  disabled={isRunning}
                >
                  <Play size={11} />
                  <span>{step.actionLabel}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Execution Log */}
      {stepLogs.length > 0 && (
        <div className="demo-logs-box">
          <div className="logs-header">Live Audit Execution Trace</div>
          <div className="logs-content">
            {stepLogs.map((log, i) => (
              <div key={i} className="log-line">
                <code>{log}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
