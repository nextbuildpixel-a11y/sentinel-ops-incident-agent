import { Activity, CircleDot, Database, MemoryStick, ShieldAlert } from 'lucide-react'
import { PHASES } from '../hooks/useIncidentWorkflow'
import { SCENARIOS } from '../api/incidentService'
import { Badge, cx } from './ui/primitives'

const SCENARIO_ICONS = {
  db_pool_exhausted: Database,
  memory_leak_oom: MemoryStick,
}

/**
 * Investigation status, derived purely from the frontend workflow phase.
 * The backend contract has no severity or timestamp field, so we never
 * invent one - this banner reflects real client state only.
 */
const PHASE_STATE = {
  [PHASES.IDLE]: { label: 'No active incident', hint: 'Select a scenario to begin', tone: 'slate', live: false },
  [PHASES.READY]: { label: 'Incident detected', hint: 'Awaiting AI investigation', tone: 'amber', live: true },
  [PHASES.INVESTIGATING]: { label: 'Incident detected', hint: 'AI investigation in progress', tone: 'amber', live: true },
  [PHASES.AWAITING_AUTHORIZATION]: {
    label: 'Analysis complete',
    hint: 'Awaiting human authorization',
    tone: 'brand',
    live: true,
  },
  [PHASES.EXECUTING]: { label: 'Remediation executing', hint: 'Fix running in sandbox', tone: 'brand', live: true },
  [PHASES.COMPLETED]: { label: 'Remediation complete', hint: 'Fix applied to system', tone: 'emerald', live: false },
}

/** Strong incident header. Severity styling is scoped to the badge, never the page. */
export function IncidentBanner({ phase, scenario }) {
  const state = PHASE_STATE[phase] ?? PHASE_STATE[PHASES.IDLE]
  const meta = SCENARIOS.find((item) => item.id === scenario)
  const Icon = meta ? (SCENARIO_ICONS[meta.id] ?? ShieldAlert) : ShieldAlert
  const isIncident = state.live

  return (
    <section
      aria-label="Active incident"
      className={cx(
        'relative overflow-hidden rounded-lg border bg-surface',
        isIncident ? 'border-warn/25' : 'border-line',
      )}
    >
      {/* Left severity rail - the only strong colour cue */}
      <span
        className={cx(
          'absolute inset-y-0 left-0 w-[3px]',
          isIncident ? 'bg-warn' : 'bg-line-strong',
        )}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4 pr-4 pl-5 sm:pl-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span
            className={cx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border',
              isIncident ? 'border-warn/30 bg-warn/10 text-warn' : 'border-line bg-surface-raised text-ink-faint',
            )}
          >
            <Icon size={18} aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={state.tone} icon={isIncident ? CircleDot : Activity}>
                {state.label}
              </Badge>
              {meta && <span className="font-mono text-[10px] text-ink-faint">{meta.id}</span>}
            </div>
            <h2
              className={cx(
                'mt-1.5 text-base leading-tight font-semibold text-ink',
                !meta && 'text-ink-faint',
              )}
            >
              {meta ? meta.label : 'No scenario selected'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">{state.hint}</p>
          </div>
        </div>

        {meta && (
          <p className="max-w-[22rem] shrink-0 text-xs leading-relaxed text-ink-muted lg:text-right">
            {meta.summary}
          </p>
        )}
      </div>
    </section>
  )
}

export default IncidentBanner
