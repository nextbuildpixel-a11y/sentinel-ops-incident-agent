import { HeartPulse } from 'lucide-react'
import { cx } from './ui/primitives'

const HEALTH = {
  healthy: { label: 'System Operational', text: 'text-ok', dot: 'bg-ok' },
  degraded: { label: 'System Degraded', text: 'text-warn', dot: 'bg-warn' },
  critical: { label: 'System Critical', text: 'text-bad', dot: 'bg-bad' },
  unknown: { label: 'Status Unknown', text: 'text-ink-faint', dot: 'bg-ink-faint' },
}

/**
 * Compact system-state strip.
 *
 * `health.status` comes from the backend when it reports one, and is
 * otherwise derived from the workflow stage (see useIncidentWorkflow). We
 * never assert a healthy state that has not been reported or derived.
 */
export function SystemHealthBanner({ health }) {
  const config = HEALTH[health?.status] ?? HEALTH.unknown
  const isImpaired = health?.status === 'degraded' || health?.status === 'critical'

  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border px-3 py-2',
        isImpaired ? 'border-warn/25 bg-warn/[0.05]' : 'border-line bg-surface',
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {isImpaired && (
          <span className={cx('absolute inset-0 animate-pulse-ring rounded-full', config.dot)} />
        )}
        <span className={cx('relative h-2 w-2 rounded-full', config.dot)} />
      </span>

      <HeartPulse size={13} className={cx('shrink-0', config.text)} aria-hidden="true" />
      <span className={cx('text-[11px] font-semibold tracking-[0.12em] uppercase', config.text)}>
        {config.label}
      </span>

      <span className="ml-auto font-mono text-[10px] text-ink-faint">
        {health?.source === 'backend' ? 'reported by api' : 'derived from workflow'}
      </span>
    </div>
  )
}

export default SystemHealthBanner
