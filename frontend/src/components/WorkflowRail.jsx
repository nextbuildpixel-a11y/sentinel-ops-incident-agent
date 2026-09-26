import { PHASES } from '../hooks/useIncidentWorkflow'
import { cx } from './ui/primitives'

/**
 * Visual progress through the operator workflow.
 *
 * IMPORTANT: every step here is derived from the FRONTEND workflow phase. It
 * is not backend incident evidence and is labelled as such, so it can never be
 * mistaken for an incident timeline supplied by the API.
 */
const STEPS = [
  { phase: PHASES.READY, label: 'Incident' },
  { phase: PHASES.INVESTIGATING, label: 'Investigate' },
  { phase: PHASES.AWAITING_AUTHORIZATION, label: 'Analysis' },
  { phase: PHASES.EXECUTING, label: 'Authorize' },
  { phase: PHASES.COMPLETED, label: 'Remediate' },
]

/** Position of the current phase on the rail. */
function stepIndex(phase) {
  if (phase === PHASES.IDLE) return -1
  if (phase === PHASES.READY) return 0
  if (phase === PHASES.INVESTIGATING) return 1
  if (phase === PHASES.AWAITING_AUTHORIZATION) return 2
  if (phase === PHASES.EXECUTING) return 3
  if (phase === PHASES.COMPLETED) return 4
  return -1
}

export function WorkflowRail({ phase }) {
  const current = stepIndex(phase)
  const progress = current < 0 ? 0 : (current / (STEPS.length - 1)) * 100

  return (
    <div className="rounded-md border border-line bg-surface px-3.5 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">Operator Workflow</p>
        <p className="font-mono text-[10px] text-ink-faint/70">ui state · not api data</p>
      </div>

      <div className="relative">
        {/* Track */}
        <span className="absolute top-[7px] right-0 left-0 h-px bg-line" aria-hidden="true" />
        {/* Fill */}
        <span
          className="absolute top-[7px] left-0 h-px bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />

        <ol className="relative flex justify-between">
          {STEPS.map((step, index) => {
            const done = current > index
            const active = current === index

            return (
              <li key={step.phase} className="flex min-w-0 flex-col items-center gap-1.5">
                <span
                  className={cx(
                    'h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-surface transition-colors duration-300',
                    done
                      ? 'border-brand bg-brand'
                      : active
                        ? 'border-brand bg-surface animate-pulse-ring'
                        : 'border-line-strong bg-surface',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cx(
                    'truncate text-[10px] font-medium tracking-wide transition-colors',
                    active ? 'text-ink' : done ? 'text-brand-soft' : 'text-ink-faint',
                  )}
                >
                  {step.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default WorkflowRail
