import { useEffect, useState } from 'react'
import { Boxes, ShieldCheck } from 'lucide-react'
import { Spinner } from './ui/primitives'

/**
 * Generic UI phases shown while POST /remediate is in flight.
 * These are presentation only - no result is implied by them.
 */
const STAGES = [
  'Dispatching remediation agent…',
  'Applying changes in isolated sandbox…',
  'Verifying post-fix health checks…',
]

/** Step 5: full-screen blocking state while the fix executes. */
export function ExecutionOverlay({ open }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (!open) {
      setStage(0)
      return undefined
    }
    const timer = setInterval(() => {
      setStage((current) => (current + 1) % STAGES.length)
    }, 1800)
    return () => clearInterval(timer)
  }, [open])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md animate-fade-in-up rounded-xl border border-cyan-500/30 bg-slate-900 p-6 text-center shadow-2xl shadow-cyan-500/10">
        <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-cyan-500/30" aria-hidden="true" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-300">
            <Spinner size={22} />
          </span>
        </div>

        <p className="text-base font-semibold text-slate-100">Executing in sandbox...</p>
        <p className="mt-1.5 text-xs text-slate-500">{STAGES[stage]}</p>

        {/* Indeterminate progress bar */}
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/3 animate-[sweep_1.6s_ease-in-out_infinite] rounded-full bg-cyan-500" />
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
          <ShieldCheck size={12} aria-hidden="true" />
          Changes are applied in an isolated environment and will be reported back.
        </p>
      </div>
    </div>
  )
}

/** Inline variant for the header strip. */
export function ExecutingChip() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
      <Spinner size={12} />
      <Boxes size={12} aria-hidden="true" />
      Executing in sandbox...
    </span>
  )
}

export default ExecutionOverlay
