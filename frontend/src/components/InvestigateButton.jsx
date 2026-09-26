import { useEffect, useState } from 'react'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Spinner, cx } from './ui/primitives'

/**
 * Conceptual stages of an AI investigation.
 *
 * These are a visual activity indicator only. The backend returns a single
 * response with no progress information, so nothing here is real progress
 * and no percentages are ever shown.
 */
const STAGES = [
  'Collecting telemetry',
  'Correlating logs',
  'Analyzing deployment history',
  'Generating root-cause hypothesis',
]

/** Step 2: fire POST /diagnose. The primary action of the console. */
export function InvestigateButton({ onClick, disabled, loading, hasResult }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!loading) {
      setStage(0)
      return undefined
    }
    const timer = setInterval(() => setStage((current) => (current + 1) % STAGES.length), 1600)
    return () => clearInterval(timer)
  }, [loading])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={cx(
            'group inline-flex items-center gap-2.5 rounded-md px-5 py-2.5 text-sm font-semibold',
            'transition-all duration-200',
            'disabled:cursor-not-allowed',
            loading
              ? 'border border-line bg-surface-raised text-ink-faint'
              : 'bg-brand text-surface-base hover:bg-brand-soft active:scale-[0.985]',
          )}
        >
          {loading ? (
            <Spinner size={15} />
          ) : hasResult ? (
            <RotateCcw size={15} aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}
          {loading
            ? 'Analyzing incident…'
            : hasResult
              ? 'Re-run AI Investigation'
              : 'Run AI Investigation'}
        </button>

        <p className="max-w-md text-[11px] leading-relaxed text-ink-faint">
          {loading
            ? 'The AI agent is correlating telemetry, logs and deployment history.'
            : 'Correlates telemetry, logs and deployment history via POST /diagnose.'}
        </p>
      </div>

      {/* Staged analysis indicator - presentation only, not real progress */}
      {loading && (
        <div
          className="animate-fade-in-up rounded-md border border-brand/25 bg-brand/[0.05] p-3.5"
          role="status"
          aria-live="polite"
        >
          <p className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-brand-soft uppercase">
            <Spinner size={11} />
            Analyzing incident
          </p>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {STAGES.map((label, index) => {
              const active = index === stage
              return (
                <li
                  key={label}
                  className={cx(
                    'flex items-center gap-2 text-[11px] transition-colors duration-500',
                    active ? 'text-ink' : 'text-ink-faint/70',
                  )}
                >
                  <span
                    className={cx(
                      'h-1 w-1 shrink-0 rounded-full transition-colors duration-500',
                      active ? 'bg-brand' : 'bg-line-strong',
                    )}
                    aria-hidden="true"
                  />
                  {label}
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}

export default InvestigateButton
