import { Check, Link2, Quote, Sparkles, TriangleAlert } from 'lucide-react'
import { Card, EmptyState, ErrorBanner, SkeletonLine, cx } from './ui/primitives'
import { ConfidenceMeter } from './ConfidenceMeter'

/** Placeholder shown while POST /diagnose is in flight. */
function DiagnosisSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonLine className="h-2.5 w-24" />
      <SkeletonLine className="h-14 w-full" />
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonLine className="h-16" />
        <SkeletonLine className="h-16" />
        <SkeletonLine className="h-16" />
      </div>
      <SkeletonLine className="h-3 w-32" />
      <SkeletonLine className="h-9 w-full" />
      <SkeletonLine className="h-3 w-28" />
      <div className="space-y-2">
        <SkeletonLine className="h-10" />
        <SkeletonLine className="h-10" />
        <SkeletonLine className="h-10" />
      </div>
    </div>
  )
}

/**
 * Supporting evidence. The backend sends an array of strings, but the
 * normalizer also supports richer objects, so both shapes render cleanly.
 */
function EvidenceList({ evidence }) {
  if (!evidence.length) {
    return <EmptyState icon={Link2} message="The AI returned no supporting evidence for this root cause." />
  }

  return (
    <ul className="space-y-1.5">
      {evidence.map((item, index) => (
        <li
          key={item.title ?? item.detail ?? index}
          className="flex items-start gap-2.5 rounded-md border border-line bg-surface-raised/40 px-3 py-2.5"
        >
          <span
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ok/10 text-ok"
            aria-hidden="true"
          >
            <Check size={10} strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            {item.title && <p className="text-[13px] leading-snug font-medium text-ink">{item.title}</p>}
            {item.detail && (
              <p className={cx('text-xs leading-relaxed text-ink-muted', item.title && 'mt-1')}>{item.detail}</p>
            )}
            {(item.source || item.confidence !== null) && (
              <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-ink-faint">
                {item.source && <span>src: {item.source}</span>}
                {item.confidence !== null && <span>conf: {item.confidence}%</span>}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * The centrepiece: what the AI concluded, and how sure it is.
 * Renders only what `normalizeDiagnosis` mapped from the real response.
 */
export function DiagnosisPanel({ diagnosis, loading, error, onRetry }) {
  return (
    <Card
      title="AI Investigation"
      subtitle={loading ? 'Analysis in progress' : diagnosis?.raw ? 'Analysis complete' : 'Awaiting run'}
      icon={Sparkles}
      accent="brand"
      bodyClassName="space-y-5"
      className="h-full"
    >
      {error && <ErrorBanner title="Investigation failed" message={error} onRetry={onRetry} />}

      {loading && <DiagnosisSkeleton />}

      {!loading && !error && !diagnosis && (
        <EmptyState icon={Sparkles} message="No analysis yet. Select a scenario and run the AI investigation." />
      )}

      {!loading && diagnosis && (
        <div className="animate-fade-in-up space-y-5">
          {/* ROOT CAUSE - the primary result */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-bad uppercase">
              <TriangleAlert size={11} aria-hidden="true" />
              Root Cause
            </p>
            {diagnosis.rootCause ? (
              <p className="border-l-2 border-bad/60 pl-3.5 text-xl leading-snug font-semibold text-ink">
                {diagnosis.rootCause}
              </p>
            ) : (
              <p className="border-l-2 border-line-strong pl-3.5 text-sm text-ink-faint">
                The backend did not return a root cause for this incident.
              </p>
            )}
          </div>

          <ConfidenceMeter value={diagnosis.confidence} />

          {/* SUMMARY */}
          {diagnosis.summary && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
                Investigation Summary
              </p>
              <p className="text-[13px] leading-relaxed text-ink-muted">{diagnosis.summary}</p>
            </div>
          )}

          {/* EVIDENCE */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
              <Quote size={11} aria-hidden="true" />
              Supporting Evidence
              {diagnosis.evidence.length > 0 && (
                <span className="font-mono font-normal tracking-normal text-ink-faint/70 normal-case">
                  {diagnosis.evidence.length}
                </span>
              )}
            </p>
            <EvidenceList evidence={diagnosis.evidence} />
          </div>
        </div>
      )}
    </Card>
  )
}

export default DiagnosisPanel
