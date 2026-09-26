import { Badge, cx } from './ui/primitives'
import { Gauge } from 'lucide-react'

const toneFor = (value) => {
  if (value >= 80) return { bar: 'bg-ok', text: 'text-ok', badge: 'emerald', word: 'High' }
  if (value >= 50) return { bar: 'bg-warn', text: 'text-warn', badge: 'amber', word: 'Moderate' }
  return { bar: 'bg-bad', text: 'text-bad', badge: 'rose', word: 'Low' }
}

/**
 * Confidence as reported by the backend (`diagnosis.confidence_score`).
 *
 * `value` arrives already scaled to 0-100 by the normalizer, so 0.97 is
 * rendered as 97%. If the backend omitted the score we say so rather than
 * inventing one.
 */
export function ConfidenceMeter({ value }) {
  if (value === null || value === undefined) {
    return (
      <div className="rounded-md border border-dashed border-line px-3 py-3 text-[11px] leading-relaxed text-ink-faint">
        No confidence score returned by the backend.
      </div>
    )
  }

  const tone = toneFor(value)

  return (
    <div className="rounded-md border border-line bg-surface-raised/40 p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
          <Gauge size={11} aria-hidden="true" />
          Confidence
        </span>
        <Badge tone={tone.badge}>{tone.word}</Badge>
      </div>

      <div className="flex items-end gap-4">
        <span className={cx('font-mono text-4xl leading-none font-semibold tracking-tight', tone.text)}>
          {value}
          <span className="ml-0.5 text-lg align-super">%</span>
        </span>

        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="AI confidence"
        >
          <div
            className={cx('h-full rounded-full transition-[width] duration-700 ease-out', tone.bar)}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default ConfidenceMeter
