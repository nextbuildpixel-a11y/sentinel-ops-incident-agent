import { Database, MemoryStick, ShieldAlert } from 'lucide-react'
import { SCENARIOS } from '../api/incidentService'
import { cx } from './ui/primitives'

const ICONS = {
  db_pool_exhausted: Database,
  memory_leak_oom: MemoryStick,
}

/**
 * Step 1 of the workflow: pick which incident the AI should investigate.
 * Locked while a request is in flight so results can never be mismatched.
 */
export function ScenarioSelector({ selected, onSelect, disabled }) {
  return (
    <div role="radiogroup" aria-label="Incident scenario" className="grid gap-2 sm:grid-cols-2">
      {SCENARIOS.map((scenario) => {
        const Icon = ICONS[scenario.id] ?? ShieldAlert
        const isSelected = selected === scenario.id

        return (
          <button
            key={scenario.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(scenario.id)}
            className={cx(
              'group relative flex items-start gap-3 overflow-hidden rounded-md border p-3 text-left',
              'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45',
              isSelected
                ? 'border-brand/45 bg-brand/[0.07]'
                : 'border-line bg-surface-raised/40 hover:border-line-strong hover:bg-surface-raised',
            )}
          >
            {/* Selection marker */}
            <span
              className={cx(
                'absolute inset-y-0 left-0 w-[2px] transition-colors duration-200',
                isSelected ? 'bg-brand' : 'bg-transparent',
              )}
              aria-hidden="true"
            />

            <span
              className={cx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors duration-200',
                isSelected
                  ? 'border-brand/30 bg-brand/10 text-brand-soft'
                  : 'border-line bg-surface text-ink-faint group-hover:text-ink-muted',
              )}
            >
              <Icon size={15} aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={cx(
                  'block text-[13px] leading-snug font-semibold',
                  isSelected ? 'text-ink' : 'text-ink-muted group-hover:text-ink',
                )}
              >
                {scenario.label}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-ink-faint">{scenario.summary}</span>
              <span className="mt-1.5 block font-mono text-[10px] text-ink-faint/70">{scenario.id}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default ScenarioSelector
