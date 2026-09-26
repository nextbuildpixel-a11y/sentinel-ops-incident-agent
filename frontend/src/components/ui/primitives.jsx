import { AlertTriangle, Info } from 'lucide-react'

/**
 * Shared visual primitives.
 *
 * Design rules for the command-center look:
 *  - 1px subtle borders (`border-line`), no heavy drop shadows
 *  - compact uppercase micro-labels (`text-ink-faint`)
 *  - monospace for anything technical
 */

const cx = (...classes) => classes.filter(Boolean).join(' ')

/**
 * The standard panel. `accent` tints the header rule + icon for panels that
 * represent a distinct stage of the workflow (AI, human authorization).
 */
export const Card = ({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = '',
  bodyClassName = 'px-4 py-4',
  accent = 'brand',
}) => {
  const accents = {
    brand: { icon: 'text-brand', rule: 'from-brand/50' },
    warn: { icon: 'text-warn', rule: 'from-warn/50' },
    ok: { icon: 'text-ok', rule: 'from-ok/50' },
    bad: { icon: 'text-bad', rule: 'from-bad/50' },
    muted: { icon: 'text-ink-faint', rule: 'from-line-strong/50' },
  }
  const tone = accents[accent] ?? accents.brand

  return (
    <section
      className={cx(
        'relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface',
        className,
      )}
    >
      {(title || action) && (
        <header className="relative flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          {/* Accent hairline along the top of the header */}
          <span
            className={cx('absolute inset-x-0 -top-px h-px bg-gradient-to-r to-transparent', tone.rule)}
            aria-hidden="true"
          />
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && <Icon size={15} className={cx('mt-0.5 shrink-0', tone.icon)} aria-hidden="true" />}
            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {title}
              </h2>
              {subtitle && <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cx('min-w-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  )
}

const BADGE_TONES = {
  neutral: 'border-line bg-surface-raised text-ink-muted',
  brand: 'border-brand/30 bg-brand/10 text-brand-soft',
  emerald: 'border-ok/30 bg-ok/10 text-ok',
  amber: 'border-warn/30 bg-warn/10 text-warn',
  rose: 'border-bad/30 bg-bad/10 text-bad',
  slate: 'border-line bg-surface-raised text-ink-faint',
}

export const Badge = ({ tone = 'neutral', icon: Icon, children, className = '' }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
      BADGE_TONES[tone] ?? BADGE_TONES.neutral,
      className,
    )}
  >
    {Icon && <Icon size={10} aria-hidden="true" />}
    {children}
  </span>
)

export const Spinner = ({ size = 16, className = '' }) => (
  <svg
    className={cx('animate-spin', className)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    role="status"
    aria-label="Loading"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

/** Shimmering placeholder block used while a request is in flight. */
export const SkeletonLine = ({ className = '', style }) => (
  <div className={cx('relative overflow-hidden rounded bg-surface-raised', className)} style={style}>
    <div className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-line-strong/40 to-transparent" />
  </div>
)

export const ErrorBanner = ({ title = 'Something went wrong', message, onRetry, onDismiss, className = '' }) => (
  <div
    role="alert"
    className={cx(
      'flex items-start gap-3 rounded-md border border-bad/40 bg-bad/[0.08] px-4 py-3 text-sm',
      className,
    )}
  >
    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-bad" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-bad">{title}</p>
      {message && <p className="mt-1 text-xs leading-relaxed break-words text-ink-muted">{message}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-bad/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-bad transition-colors hover:bg-bad/15"
        >
          Retry
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded px-1.5 py-1 text-[11px] text-ink-faint transition-colors hover:text-ink"
        >
          Dismiss
        </button>
      )}
    </div>
  </div>
)

/** Shown whenever the backend returned nothing for a section. */
export const EmptyState = ({ message = 'No data returned by the backend.', icon: Icon = Info, className = '' }) => (
  <div
    className={cx(
      'flex items-start gap-2 rounded-md border border-dashed border-line px-3 py-4 text-xs leading-relaxed text-ink-faint',
      className,
    )}
  >
    <Icon size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>{message}</span>
  </div>
)

/** Compact technical micro-label. */
export const MicroLabel = ({ icon: Icon, children, className = '' }) => (
  <p className={cx('flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint', className)}>
    {Icon && <Icon size={11} className="shrink-0" aria-hidden="true" />}
    {children}
  </p>
)

/** Two-column label/value list for technical key-value data. */
export const KeyValueList = ({ items, className = '' }) => {
  if (!items?.length) return <EmptyState message="No metadata returned." />
  return (
    <dl className={cx('grid grid-cols-1 gap-x-5 gap-y-0 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <div
          key={item.key ?? item.label}
          className="flex items-baseline justify-between gap-3 border-b border-line/70 py-1.5"
        >
          <dt className="shrink-0 text-[11px] text-ink-faint">{item.label}</dt>
          <dd className="min-w-0 truncate text-right font-mono text-[11px] text-ink-muted" title={item.value}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { cx }
