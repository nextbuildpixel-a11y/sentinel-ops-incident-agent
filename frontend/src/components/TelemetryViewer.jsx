import { useMemo, useState } from 'react'
import { Radio, Terminal } from 'lucide-react'
import { Card, EmptyState, SkeletonLine, cx } from './ui/primitives'

/**
 * Colour a log line by scanning its own text. The contract sends plain
 * strings, so severity is *inferred* from the wording - we never invent a
 * level field that the backend did not send.
 */
const LEVEL_TONES = [
  { match: /fatal|critical|emerg|panic/i, className: 'text-bad', label: 'error' },
  { match: /\berr(or)?\b|exception|failed|failure|timeout|exhaust/i, className: 'text-bad/90', label: 'error' },
  { match: /warn/i, className: 'text-warn', label: 'warn' },
  { match: /info|notice|debug|trace/i, className: 'text-ink-muted', label: 'info' },
]

const toneFor = (text) => LEVEL_TONES.find((entry) => entry.match.test(text)) ?? { className: 'text-ink-muted', label: 'info' }

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warn', label: 'Warnings' },
]

/**
 * Left panel: raw telemetry exactly as the backend returned it.
 * Read-only by design - this is evidence, not something to edit.
 */
export function TelemetryViewer({ logs, loading }) {
  const [filter, setFilter] = useState('all')

  const counts = useMemo(() => {
    const result = { all: logs.length, error: 0, warn: 0 }
    for (const entry of logs) {
      const tone = toneFor(entry.message ?? '')
      if (tone.label === 'error') result.error += 1
      else if (tone.label === 'warn') result.warn += 1
    }
    return result
  }, [logs])

  const visible = useMemo(
    () => logs.filter((entry) => filter === 'all' || toneFor(entry.message ?? '').label === filter),
    [logs, filter],
  )

  return (
    <Card
      title="Live Logs"
      subtitle={loading ? 'Collecting' : logs.length ? `${logs.length} lines` : undefined}
      icon={Terminal}
      accent="muted"
      bodyClassName="space-y-2.5"
      action={
        !loading && logs.length > 0 ? (
          <div className="flex gap-1">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={cx(
                  'rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase transition-colors',
                  filter === option.id
                    ? 'border-brand/40 bg-brand/10 text-brand-soft'
                    : 'border-line text-ink-faint hover:text-ink-muted',
                )}
              >
                {option.label}
                <span className="ml-1 font-mono">{counts[option.id]}</span>
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {loading && (
        <div className="space-y-2 px-4 py-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-3" style={{ width: `${45 + ((index * 17) % 50)}%` }} />
          ))}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="px-4 py-4">
          <EmptyState icon={Terminal} message="No log lines returned by the backend for this incident." />
        </div>
      )}

      {!loading && logs.length > 0 && visible.length === 0 && (
        <div className="px-4 py-4">
          <EmptyState message="No lines match this filter." />
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="max-h-[22rem] overflow-auto border-t border-line bg-surface-base">
          <pre className="px-3 py-2.5 font-mono text-[11px] leading-relaxed">
            {visible.map((entry, index) => {
              const tone = toneFor(entry.message ?? entry.raw ?? '')
              return (
                <div key={index} className="flex gap-2.5 py-px hover:bg-surface-raised/60">
                  {/* Line number is a display affordance, not backend data */}
                  <span className="w-6 shrink-0 text-right text-ink-faint/50 select-none" aria-hidden="true">
                    {index + 1}
                  </span>
                  {entry.timestamp && <span className="shrink-0 text-ink-faint">{entry.timestamp}</span>}
                  {entry.level && <span className={cx('w-12 shrink-0 uppercase', tone.className)}>{entry.level}</span>}
                  <span className={cx('min-w-0 flex-1 break-words whitespace-pre-wrap', tone.className)}>
                    {entry.message ?? entry.raw}
                  </span>
                </div>
              )
            })}
          </pre>
        </div>
      )}
    </Card>
  )
}

/**
 * Deployment history. The contract sends an array of strings - we render them
 * verbatim and do not assume object entries.
 */
export function DeploymentHistory({ entries, loading }) {
  return (
    <Card
      title="Deployment History"
      subtitle={!loading && entries.length ? `${entries.length} entries` : undefined}
      icon={Radio}
      accent="muted"
      bodyClassName="space-y-2"
    >
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonLine key={index} className="h-9" />
          ))}
        </div>
      )}

      {!loading && entries.length === 0 && (
        <EmptyState icon={Radio} message="No deployment history returned by the backend." />
      )}

      {!loading && entries.length > 0 && (
        <ol className="space-y-1.5">
          {entries.map((entry) => (
            <li
              key={entry.key}
              className="flex items-start gap-2.5 rounded-md border border-line bg-surface-raised/40 px-2.5 py-2"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
              <span
                className={cx(
                  'min-w-0 flex-1 text-[11px] leading-relaxed break-words',
                  entry.mono ? 'text-ink-muted' : 'text-ink-muted',
                )}
              >
                {entry.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export default TelemetryViewer
