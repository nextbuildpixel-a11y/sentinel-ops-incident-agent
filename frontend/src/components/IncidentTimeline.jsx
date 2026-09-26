import { History } from 'lucide-react'
import { Card, EmptyState, SkeletonLine, cx } from './ui/primitives'

/** Vertical incident timeline. */
export function IncidentTimeline({ timeline, loading }) {
  return (
    <Card
      title="Incident Timeline"
      icon={History}
      subtitle={!loading && timeline.length ? `${timeline.length} events` : undefined}
      bodyClassName="space-y-2"
    >
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-3">
              <SkeletonLine className="h-3 w-3 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine className="h-3.5" style={{ width: `${50 + ((index * 17) % 35)}%` }} />
                <SkeletonLine className="h-2.5" style={{ width: `${35 + ((index * 11) % 30)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && timeline.length === 0 && (
        <EmptyState icon={History} message="No timeline events returned by the backend." />
      )}

      {!loading && timeline.length > 0 && (
        <ol className="relative space-y-3.5 pl-1">
          {/* Connecting rail */}
          <span className="absolute left-[5px] top-1.5 h-[calc(100%-12px)] w-px bg-slate-800" aria-hidden="true" />
          {timeline.map((event, index) => (
            <li key={`${event.timestamp ?? 'event'}-${index}`} className="relative flex gap-3 pl-5">
              <span
                className={cx(
                  'absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900',
                  index === 0 ? 'bg-rose-500' : index === timeline.length - 1 ? 'bg-cyan-400' : 'bg-slate-600',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {event.timestamp && <span className="font-mono text-[10px] text-slate-500">{event.timestamp}</span>}
                  {event.actor && <span className="text-[10px] text-slate-600">• {event.actor}</span>}
                </div>
                <p className="text-sm leading-snug text-slate-200">{event.title}</p>
                {event.description && event.description !== event.title && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{event.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

export default IncidentTimeline
