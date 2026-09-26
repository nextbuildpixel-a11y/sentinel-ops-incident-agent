import { CheckCircle2, ClipboardList, ScrollText, ShieldCheck, XCircle } from 'lucide-react'
import { Badge, Card, EmptyState, KeyValueList, MicroLabel, cx } from './ui/primitives'
import { CommandBlock } from './RemediationPanel'

/** Audit trail, shown only when the backend actually returns one. */
function AuditBlock({ audit }) {
  if (!audit) return null

  return (
    <div className="rounded-md border border-line bg-surface-raised/40 p-3">
      <MicroLabel icon={ScrollText} className="mb-2">
        Audit Trail
        {audit.id && <span className="font-mono tracking-normal normal-case">· {audit.id}</span>}
      </MicroLabel>
      {audit.actor && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <ShieldCheck size={12} className="text-ok" aria-hidden="true" />
          Approved by <span className="font-mono text-ink">{audit.actor}</span>
        </p>
      )}
      <KeyValueList items={audit.rows} />
    </div>
  )
}

/**
 * Step 6: what the backend reported after remediation, plus the audit trail.
 *
 * `success` is null when the backend sent no recognizable success field - in
 * that case we say so rather than claiming the fix worked.
 */
export function RemediationResult({ result, succeeded, health, rollback }) {
  if (!result) return null

  const unknown = succeeded === null
  const healthy = health?.status === 'healthy'
  const passed = !unknown && succeeded

  const tone = unknown ? 'amber' : passed ? 'emerald' : 'rose'
  const Icon = passed ? CheckCircle2 : XCircle
  const headline = unknown
    ? 'Remediation completed (unconfirmed)'
    : passed
      ? 'Remediation completed'
      : 'Remediation did not succeed'

  return (
    <Card
      title="Remediation Result"
      subtitle={result.finishedAt ?? undefined}
      icon={Icon}
      accent={passed ? 'ok' : unknown ? 'warn' : 'bad'}
      bodyClassName="space-y-3.5"
      className="animate-fade-in-up"
      action={
        <Badge tone={tone} icon={passed && healthy ? ShieldCheck : undefined}>
          {unknown ? 'Unconfirmed' : healthy ? 'Healthy' : passed ? 'Applied' : 'Failed'}
        </Badge>
      }
    >
      <div
        className={cx(
          'flex items-start gap-2.5 rounded-md border px-3.5 py-3',
          unknown
            ? 'border-warn/30 bg-warn/[0.06]'
            : passed
              ? 'border-ok/30 bg-ok/[0.06]'
              : 'border-bad/30 bg-bad/[0.06]',
        )}
      >
        <Icon
          size={16}
          className={cx(
            'mt-0.5 shrink-0',
            unknown ? 'text-warn' : passed ? 'text-ok' : 'text-bad',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p
            className={cx(
              'text-[13px] font-semibold',
              unknown ? 'text-warn' : passed ? 'text-ok' : 'text-bad',
            )}
          >
            {headline}
          </p>
          {result.message && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{result.message}</p>}
          {result.summary && result.summary !== result.message && (
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{result.summary}</p>
          )}
          {unknown && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              The response contained no recognizable success field, so the outcome is shown as unconfirmed.
            </p>
          )}
        </div>
      </div>

      {result.changes.length > 0 && (
        <div>
          <MicroLabel icon={ClipboardList} className="mb-1.5">
            Changes Applied
          </MicroLabel>
          <ul className="space-y-1">
            {result.changes.map((change, index) => (
              <li key={index} className="flex gap-2 text-[11px] leading-relaxed text-ink-muted">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
                <span className="min-w-0 break-words">{change}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!result.changes.length && !result.message && !result.summary && (
        <EmptyState message="The backend returned an empty remediation result." />
      )}

      {result.fields.length > 0 && <KeyValueList items={result.fields} />}

      {rollback && <CommandBlock command={rollback} />}

      <AuditBlock audit={result.audit} />
    </Card>
  )
}

export default RemediationResult
