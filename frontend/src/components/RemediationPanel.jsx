import { AlertTriangle, CheckCircle2, Lock, ShieldAlert, Terminal, Wrench } from 'lucide-react'
import { Badge, Card, EmptyState, ErrorBanner, MicroLabel, SkeletonLine, Spinner, cx } from './ui/primitives'

/**
 * The AI proposes; a human disposes.
 *
 * `diagnosis.action` / `diagnosis.rollback` come from the documented contract
 * (`data.diagnosis.remediation_action` / `.rollback_command`) via
 * `lib/contract.js`, falling back to the normalized `remediation` block.
 * Nothing is invented: a missing field renders an empty state.
 */
function readProposal(diagnosis) {
  const remediation = diagnosis?.remediation
  return {
    action: diagnosis?.action ?? remediation?.summary ?? remediation?.title ?? null,
    rollback: diagnosis?.rollback ?? remediation?.rollback ?? null,
    remediation,
  }
}

/** Monospace command block for the rollback command. */
export function CommandBlock({ command }) {
  if (!command) return null
  return (
    <div className="rounded-md border border-line bg-surface-base p-3">
      <MicroLabel icon={Terminal} className="mb-1.5">
        Rollback Command
      </MicroLabel>
      <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-ink">
        <span className="mr-2 select-none text-ink-faint" aria-hidden="true">
          $
        </span>
        {command}
      </pre>
    </div>
  )
}

/** Skeleton used while the diagnosis is still in flight. */
export function RemediationPanelSkeleton() {
  return (
    <Card title="Human Authorization" icon={ShieldAlert} accent="warn" bodyClassName="space-y-3">
      <SkeletonLine className="h-16 w-full" />
      <SkeletonLine className="h-2.5 w-24" />
      <SkeletonLine className="h-12 w-full" />
      <SkeletonLine className="h-9 w-full" />
    </Card>
  )
}

/**
 * Step 4: the proposed fix and the human gate.
 *
 * Nothing is sent to the backend until an operator explicitly approves.
 */
export function RemediationPanel({ diagnosis, onApprove, executing, error, onDismissError }) {
  const { action, rollback, remediation } = readProposal(diagnosis)
  const hasProposal = Boolean(action || remediation)
  const waiting = hasProposal && !executing

  return (
    <Card
      title="Human Authorization"
      subtitle={executing ? 'Executing in sandbox' : waiting ? 'Approval required' : 'No action proposed'}
      icon={ShieldAlert}
      accent="warn"
      bodyClassName="space-y-4"
      action={
        waiting ? (
          <Badge tone="amber" icon={Lock}>
            Locked
          </Badge>
        ) : null
      }
    >
      {error && <ErrorBanner title="Remediation failed" message={error} onRetry={onApprove} onDismiss={onDismissError} />}

      {!hasProposal && !executing && (
        <EmptyState
          icon={Wrench}
          message="No remediation was proposed by the backend, so there is nothing to approve."
        />
      )}

      {hasProposal && (
        <div className="space-y-4">
          {/* The authorization boundary */}
          {waiting ? (
            <div
              role="alert"
              className="rounded-md border border-warn/35 bg-warn/[0.07] px-3.5 py-3"
            >
              <p className="flex items-center gap-2 text-[13px] font-semibold text-warn">
                <ShieldAlert size={15} aria-hidden="true" />
                Human Authorization Required
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                The AI has identified a remediation action. A human must approve it before anything is
                executed against the system.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-brand/30 bg-brand/[0.06] px-3.5 py-3">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-soft">
                <Spinner size={14} />
                Executing in sandbox
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                Remediation is running against the isolated environment. Changes are applied only after this
                request completes.
              </p>
            </div>
          )}

          {/* PROPOSED REMEDIATION */}
          <div>
            <MicroLabel icon={Wrench} className="mb-1.5">
              Proposed Remediation
            </MicroLabel>
            {action ? (
              <p className="rounded-md border border-line bg-surface-raised/50 px-3 py-2.5 text-[13px] leading-relaxed text-ink">
                {action}
              </p>
            ) : (
              <p className="text-[11px] text-ink-faint">No remediation action returned by the backend.</p>
            )}

            {remediation?.steps?.length > 0 && (
              <ol className="mt-2.5 space-y-1.5">
                {remediation.steps.map((step, index) => (
                  <li key={index} className="flex gap-2 text-[11px] leading-relaxed text-ink-muted">
                    <span className="mt-px font-mono text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
                    <span className={cx('min-w-0 break-words', /[{};]/.test(step) && 'font-mono text-ink-muted')}>
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {(remediation?.risk || remediation?.estimatedDuration) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {remediation.risk && (
                  <Badge tone="amber" icon={AlertTriangle}>
                    Risk: {remediation.risk}
                  </Badge>
                )}
                {remediation.estimatedDuration && <Badge tone="slate">ETA: {remediation.estimatedDuration}</Badge>}
              </div>
            )}
          </div>

          {/* Approval action */}
          {waiting && (
            <button
              type="button"
              onClick={onApprove}
              className={cx(
                'group inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3',
                'text-sm font-semibold transition-all duration-200 active:scale-[0.985]',
              )}
              style={{ backgroundColor: 'var(--color-warn)', color: '#09090b' }}
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Approve &amp; Execute Fix
            </button>
          )}

          {rollback && <CommandBlock command={rollback} />}
        </div>
      )}
    </Card>
  )
}

export default RemediationPanel
