import { useMemo } from 'react'
import { Radar, RotateCcw, Satellite, ShieldCheck, Waypoints, Layers, Terminal } from 'lucide-react'
import { useIncidentWorkflow, PHASES } from './hooks/useIncidentWorkflow'
import { API_BASE_URL } from './api/client'
import { buildDiagnosisView } from './lib/contract'
import { Badge, ErrorBanner, cx } from './components/ui/primitives'
import { IncidentBanner } from './components/IncidentBanner'
import { ScenarioSelector } from './components/ScenarioSelector'
import { CustomTelemetryEditor } from './components/CustomTelemetryEditor'
import { InvestigateButton } from './components/InvestigateButton'
import { SystemHealthBanner } from './components/SystemHealthBanner'
import { WorkflowRail } from './components/WorkflowRail'
import { DiagnosisPanel } from './components/DiagnosisPanel'
import { TelemetryViewer, DeploymentHistory } from './components/TelemetryViewer'
import { toHistoryEntries } from './lib/contract'
import { RemediationPanel, RemediationPanelSkeleton } from './components/RemediationPanel'
import { RemediationResult } from './components/RemediationResult'

const PHASE_LABELS = {
  [PHASES.IDLE]: { label: 'Standby', tone: 'slate', icon: Satellite },
  [PHASES.READY]: { label: 'Ready', tone: 'brand', icon: Waypoints },
  [PHASES.INVESTIGATING]: { label: 'Investigating', tone: 'brand', icon: Radar },
  [PHASES.AWAITING_AUTHORIZATION]: { label: 'Awaiting authorization', tone: 'amber', icon: ShieldCheck },
  [PHASES.EXECUTING]: { label: 'Executing', tone: 'brand', icon: Radar },
  [PHASES.COMPLETED]: { label: 'Complete', tone: 'emerald', icon: ShieldCheck },
}

export default function App() {
  const workflow = useIncidentWorkflow()
  const {
    phase,
    mode,
    switchMode,
    scenario,
    customTelemetry,
    updateCustomTelemetry,
    diagnosis,
    remediationResult,
    investigationError,
    remediationError,
    health,
    remediationSucceeded,
    isInvestigating,
    isExecuting,
    selectScenario,
    runInvestigation,
    approveAndExecute,
    dismissRemediationError,
    reset,
  } = workflow

  const phaseConfig = PHASE_LABELS[phase] ?? PHASE_LABELS[PHASES.IDLE]
  const hasResults = Boolean(diagnosis)
  const controlsLocked = isInvestigating || isExecuting

  // Merge the documented backend contract into the normalized view model.
  const view = useMemo(() => buildDiagnosisView(diagnosis), [diagnosis])
  const historyEntries = useMemo(() => toHistoryEntries(view?.deploymentHistory ?? []), [view])

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Ambient accent wash */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(6,182,212,0.07),transparent)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
        {/* ================= HEADER ================= */}
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-brand/25 bg-brand/10 text-brand">
              <Radar size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm leading-tight font-semibold tracking-[0.02em] text-ink">
                SENTINELOPS
                <span className="ml-2 text-ink-faint">// INCIDENT COMMANDER</span>
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                AI-assisted root cause analysis with human-authorized remediation
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={phaseConfig.tone} icon={phaseConfig.icon}>
              {phaseConfig.label}
            </Badge>
            {hasResults && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <RotateCcw size={11} aria-hidden="true" />
                New incident
              </button>
            )}
          </div>
        </header>

        <main className="space-y-3.5">
          {/* ================= SYSTEM STATE + INCIDENT ================= */}
          <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <IncidentBanner
              phase={phase}
              scenario={scenario}
              mode={mode}
              customTitle={view?.service ? `Custom Service (${view.service})` : undefined}
            />
            <div className="lg:w-72">
              <SystemHealthBanner health={health} />
            </div>
          </div>

          {/* ================= SCENARIO + PRIMARY CTA ================= */}
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-semibold tracking-[0.14em] text-ink-muted uppercase">
                  Incident Ingestion Mode
                </h2>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="inline-flex rounded-lg border border-line bg-surface-base p-1 text-xs">
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => switchMode('preset')}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all',
                    mode === 'preset'
                      ? 'bg-brand/15 text-brand shadow-sm font-semibold'
                      : 'text-ink-muted hover:text-ink',
                    controlsLocked && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Layers size={13} aria-hidden="true" />
                  Preset Scenarios
                </button>

                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => switchMode('custom')}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all',
                    mode === 'custom'
                      ? 'bg-brand/15 text-brand shadow-sm font-semibold'
                      : 'text-ink-muted hover:text-ink',
                    controlsLocked && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Terminal size={13} aria-hidden="true" />
                  Custom Telemetry Input
                </button>
              </div>
            </div>

            {mode === 'preset' ? (
              <ScenarioSelector selected={scenario} onSelect={selectScenario} disabled={controlsLocked} />
            ) : (
              <CustomTelemetryEditor
                value={customTelemetry}
                onChange={updateCustomTelemetry}
                disabled={controlsLocked}
              />
            )}

            <div className="mt-4 border-t border-line pt-4">
              <InvestigateButton
                onClick={runInvestigation}
                disabled={mode === 'preset' ? !scenario : !customTelemetry.trim()}
                loading={isInvestigating}
                hasResult={hasResults}
              />
            </div>
          </section>

          <WorkflowRail phase={phase} />

          {investigationError && (
            <ErrorBanner
              title="Could not run the investigation"
              message={investigationError}
              onRetry={scenario ? runInvestigation : undefined}
            />
          )}

          {/* ================= COMMAND CENTER =================
              Desktop: telemetry | AI intelligence | remediation
              Mobile:  AI diagnosis -> telemetry -> remediation
          */}
          {(isInvestigating || hasResults) && (
            <div className="grid items-start gap-3.5 lg:grid-cols-3">
              {/* LEFT — raw telemetry */}
              <div className="order-2 flex min-w-0 flex-col gap-3.5 lg:order-1">
                <TelemetryViewer logs={view?.logs ?? []} loading={isInvestigating} />
                <DeploymentHistory entries={historyEntries} loading={isInvestigating} />
              </div>

              {/* CENTER — AI intelligence (visually dominant) */}
              <div className="order-1 min-w-0 lg:order-2">
                <DiagnosisPanel
                  diagnosis={view}
                  loading={isInvestigating}
                  error={null}
                  onRetry={scenario ? runInvestigation : undefined}
                />
              </div>

              {/* RIGHT — human authorization + remediation */}
              <div className="order-3 flex min-w-0 flex-col gap-3.5">
                {isInvestigating ? (
                  <RemediationPanelSkeleton />
                ) : (
                  <RemediationPanel
                    diagnosis={view}
                    onApprove={approveAndExecute}
                    executing={isExecuting}
                    error={remediationError}
                    onDismissError={dismissRemediationError}
                  />
                )}

                <RemediationResult
                  result={remediationResult}
                  succeeded={remediationSucceeded}
                  health={health}
                  rollback={view?.rollback}
                />
              </div>
            </div>
          )}
        </main>

        {/* ================= FOOTER ================= */}
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] text-ink-faint">
          <span>api: {API_BASE_URL}</span>
          <span>analysis, telemetry and audit data are returned live by the backend</span>
        </footer>
      </div>
    </div>
  )
}
