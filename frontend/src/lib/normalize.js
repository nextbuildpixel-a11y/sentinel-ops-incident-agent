/**
 * Defensive mapping from backend responses to view models.
 *
 * The backend response shape is not guaranteed, so instead of hardcoding one
 * schema we accept the common field-name variants (`root_cause` / `rootCause`,
 * `confidence` / `confidence_score`, ...) and degrade to `null` / `[]` rather
 * than crashing. Nothing here invents data: a field we cannot map is simply
 * reported as missing so the UI can show its empty state.
 *
 * If the backend later settles on one exact schema, these functions are the
 * only place that needs to change.
 */

/** Containers a payload might be nested under, e.g. `{ analysis: { ... } }`. */
const NESTED_KEYS = [
  'analysis',
  'diagnosis',
  'investigation',
  'incident',
  'result',
  'results',
  'data',
  'details',
  'payload',
  'ai_analysis',
  'aiAnalysis',
  'root_cause_analysis',
  'rootCauseAnalysis',
]

/** Dev-only diagnostics so we can see field names we failed to map. */
const devWarn = (...args) => {
  if (import.meta.env?.DEV) console.warn('[sentinelops]', ...args)
}

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Text and number lookups must ignore nested objects/arrays, or a container
 *  key (e.g. `analysis: { ... }`) would shadow the field we actually want. */
const isScalar = (value) => {
  const type = typeof value
  return type === 'string' || type === 'number' || type === 'boolean'
}

/** The payload itself plus any known nested containers, e.g. `{ analysis: { ... } }`. */
const collectSources = (raw) => {
  if (!isPlainObject(raw)) return []
  const sources = [raw]
  for (const key of NESTED_KEYS) {
    if (isPlainObject(raw[key])) sources.push(raw[key])
  }
  return sources
}

const isEmptyContainer = (value) =>
  (Array.isArray(value) && value.length === 0) || (isPlainObject(value) && Object.keys(value).length === 0)

/** First defined value among `keys`, looking at the payload and known containers. */
const pickFrom = (raw, keys) => {
  for (const source of collectSources(raw)) {
    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && value !== '') return value
    }
  }
  return undefined
}

/** Like `pickFrom`, but only accepts scalar values. */
const pickScalarFrom = (raw, keys) => {
  for (const source of collectSources(raw)) {
    for (const key of keys) {
      const value = source[key]
      if (isScalar(value) && value !== '') return value
    }
  }
  return undefined
}

const pickText = (raw, keys) => {
  const value = pickScalarFrom(raw, keys)
  if (value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  return String(value)
}

const pickNumber = (raw, keys) => {
  const value = pickScalarFrom(raw, keys)
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Always returns an array. Objects become their values (handles `{ key: line }` maps). */
const asArray = (value) => {
  if (Array.isArray(value)) return value
  if (isPlainObject(value)) return Object.values(value)
  return []
}

const pickArray = (raw, keys) => asArray(pickFrom(raw, keys))

/** Find a nested object, e.g. the deployment metadata block. */
const pickObject = (raw, keys) => {
  const value = pickFrom(raw, keys)
  return isPlainObject(value) ? value : null
}

/* ------------------------------------------------------------------ *
 * Small shared formatters
 * ------------------------------------------------------------------ */

const humanize = (key) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())

const formatValue = (value) => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (isPlainObject(value)) {
    const text = JSON.stringify(value)
    return text.length > 200 ? `${text.slice(0, 200)}…` : text
  }
  return String(value)
}

const FIELD_LABELS = {
  service: 'Service',
  app: 'Application',
  service_name: 'Service',
  version: 'Version',
  release: 'Release',
  commit_sha: 'Commit SHA',
  sha: 'Commit SHA',
  commit: 'Commit',
  branch: 'Branch',
  author: 'Author',
  environment: 'Environment',
  env: 'Environment',
  deployed_at: 'Deployed At',
  deploy_time: 'Deployed At',
  timestamp: 'Timestamp',
  changelog: 'Changelog',
  changes: 'Changes',
  rollback_to: 'Rollback Target',
  diff_url: 'Diff URL',
  pr_url: 'PR URL',
  ticket: 'Ticket',
  run_id: 'Run ID',
}

/**
 * Turn an arbitrary object into ordered `{ label, value }` rows so unknown
 * fields still render instead of silently disappearing.
 */
export function toFieldList(source, { order = [], skip = [], limit = 24 } = {}) {
  if (!isPlainObject(source)) return []
  const entries = Object.entries(source).filter(
    ([key, value]) =>
      !skip.includes(key) && value !== undefined && value !== null && value !== '' && !isEmptyContainer(value),
  )
  const rank = (key) => {
    const index = order.findIndex((candidate) => candidate.toLowerCase() === key.toLowerCase())
    return index === -1 ? order.length : index
  }
  entries.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  return entries.slice(0, limit).map(([key, value]) => ({
    key,
    label: FIELD_LABELS[key] || humanize(key),
    value: formatValue(value),
  }))
}

/* ------------------------------------------------------------------ *
 * Field normalizers
 * ------------------------------------------------------------------ */

/**
 * Confidence to an integer percentage. Accepts `0.87`, `"0.87"`, `87`, `"87%"`.
 * Assumption: a value in (0, 1] is a fraction, anything larger is already a percent.
 */
export function normalizeConfidence(value) {
  let number = value
  if (typeof number === 'string') number = parseFloat(number.replace('%', ''))
  if (typeof number !== 'number' || !Number.isFinite(number)) return null
  const percent = number > 0 && number <= 1 ? number * 100 : number
  return Math.max(0, Math.min(100, Math.round(percent)))
}

/** Map whatever severity label the backend uses onto a known set. */
export function normalizeSeverity(value) {
  const text = typeof value === 'string' ? value.toLowerCase().trim() : ''
  if (!text) return null
  if (/sev(erity)?[-_ ]?1|critical|outage|fatal|emergency|p1/.test(text)) return 'critical'
  if (/sev(erity)?[-_ ]?2|high|major|p2/.test(text)) return 'high'
  if (/sev(erity)?[-_ ]?3|medium|moderate|p3/.test(text)) return 'medium'
  if (/sev(erity)?[-_ ]?4|low|minor|p4/.test(text)) return 'low'
  return text
}

/** Normalize a health/status string to a value the UI knows how to colour. */
export function normalizeHealth(value) {
  const text = isPlainObject(value) ? pickText(value, ['status', 'state', 'health']) : value
  if (typeof text !== 'string') return null
  const lowered = text.toLowerCase()
  if (/healthy|ok|passing|operational|normal|up|green|resolved|recovered/.test(lowered)) return 'healthy'
  if (/degrad|warn|partial|yellow|unstable|at[-_ ]?risk/.test(lowered)) return 'degraded'
  if (/critical|down|unhealthy|fail|error|red|outage|breach/.test(lowered)) return 'critical'
  return lowered
}

const toText = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isPlainObject(value)) {
    const text = pickText(value, ['message', 'description', 'detail', 'text', 'summary', 'name'])
    if (text) return text
  }
  return null
}

/** One telemetry/log line, keeping the original payload available for the terminal view. */
const normalizeLogEntry = (entry) => {
  if (typeof entry === 'string') return { timestamp: null, level: null, message: entry, raw: entry }
  if (isPlainObject(entry)) {
    return {
      timestamp: pickText(entry, ['timestamp', 'ts', 'time', '@timestamp', 'datetime', 'date']),
      level: pickText(entry, ['level', 'severity', 'log_level', 'logLevel', 'lvl']),
      message:
        toText(entry) ??
        pickText(entry, ['message', 'msg', 'body', 'line', 'text', 'event', 'error', 'stack']),
      raw: typeof entry.raw === 'string' ? entry.raw : JSON.stringify(entry),
    }
  }
  return { timestamp: null, level: null, message: String(entry), raw: String(entry) }
}

/** Raw logs may be a blob of text, an array of lines, or an array of log objects. */
export function normalizeLogs(value) {
  let source = value
  if (isPlainObject(source)) {
    const nested = pickArray(source, ['logs', 'lines', 'entries', 'output', 'stream', 'telemetry'])
    if (nested.length) source = nested
  }
  if (typeof source === 'string') {
    return source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ timestamp: null, level: null, message: line, raw: line }))
  }
  if (Array.isArray(source)) return source.map(normalizeLogEntry)
  return []
}

const normalizeTimelineEntry = (entry) => {
  if (typeof entry === 'string') return { timestamp: null, title: entry, description: null, actor: null }
  if (!isPlainObject(entry)) return null
  const title = pickText(entry, ['title', 'event', 'message', 'name', 'label', 'summary', 'action'])
  const description = pickText(entry, ['description', 'detail', 'details', 'body', 'reason', 'note'])
  if (!title && !description) return null
  return {
    timestamp: pickText(entry, ['timestamp', 'time', 'ts', 'at', 'date', 'created_at', 'detected_at']),
    title: title || description,
    description: title ? description : null,
    actor: pickText(entry, ['actor', 'source', 'system', 'component', 'service', 'user', 'author']),
  }
}

export function normalizeTimeline(value) {
  return asArray(value)
    .map(normalizeTimelineEntry)
    .filter(Boolean)
}

const normalizeEvidenceEntry = (entry) => {
  if (typeof entry === 'string') return { title: null, detail: entry, source: null, confidence: null }
  if (!isPlainObject(entry)) return null
  const detail =
    pickText(entry, ['detail', 'description', 'evidence', 'excerpt', 'snippet', 'log', 'message', 'value']) ??
    null
  const title = pickText(entry, ['title', 'name', 'label', 'claim', 'finding', 'key'])
  if (!title && !detail) return null
  return {
    title,
    detail,
    source: pickText(entry, ['source', 'log_source', 'logSource', 'reference', 'ref', 'origin', 'file']),
    confidence: normalizeConfidence(
      pickFrom(entry, ['confidence', 'confidence_score', 'confidenceScore', 'score', 'weight']),
    ),
  }
}

export function normalizeEvidence(value) {
  if (isPlainObject(value)) {
    // e.g. { connection_wait_time: "...", heap_used: "..." } -> list of rows
    const asRows = Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([key, v]) => ({ title: FIELD_LABELS[key] || humanize(key), detail: formatValue(v), source: null, confidence: null }))
    if (asRows.length && !('title' in value) && !('detail' in value)) return asRows
  }
  return asArray(value)
    .map(normalizeEvidenceEntry)
    .filter(Boolean)
}

/** Remediation can arrive as a block or be spread across top-level fields. */
export function normalizeRemediation(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'string') {
    return { title: null, summary: raw, description: null, steps: [], risk: null, rollback: null, estimatedDuration: null, requiresApproval: true }
  }
  if (!isPlainObject(raw)) return null

  const summary = pickText(raw, ['summary', 'description', 'action', 'recommendation', 'detail', 'details', 'message', 'text'])
  const steps = pickArray(raw, ['steps', 'actions', 'commands', 'plan', 'procedure', 'instructions'])
    .map((step) => {
      if (typeof step === 'string') return step
      if (isPlainObject(step)) {
        return (
          pickText(step, ['step', 'command', 'action', 'description', 'detail', 'instruction', 'text']) ??
          formatValue(step)
        )
      }
      return String(step)
    })
    .filter(Boolean)

  const title = pickText(raw, ['title', 'name', 'label', 'headline', 'fix'])

  // Nothing recognisable? Don't render a misleading empty recommendation.
  if (!title && !summary && !steps.length) return null

  return {
    title,
    summary,
    description: pickText(raw, ['description', 'detail', 'details', 'rationale', 'explanation']),
    steps,
    risk: pickText(raw, ['risk', 'risk_level', 'riskLevel', 'impact', 'blast_radius', 'severity']),
    rollback: pickText(raw, ['rollback', 'rollback_plan', 'rollbackPlan', 'revert', 'undo']),
    estimatedDuration:
      pickText(raw, ['estimated_duration', 'estimatedDuration', 'eta', 'duration', 'duration_ms']) ??
      pickNumber(raw, ['duration_ms', 'durationMs'])?.toString() ??
      null,
    requiresApproval: true,
  }
}

/** Audit trail, returned by the backend after remediation. */
export function normalizeAudit(raw) {
  if (!isPlainObject(raw)) return null
  const rows = toFieldList(raw, {
    order: [
      'id',
      'reference',
      'request_id',
      'actor',
      'approved_by',
      'action',
      'approved_at',
      'executed_at',
      'timestamp',
      'sandbox',
      'sandbox_id',
      'duration_ms',
      'signature',
      'notes',
    ],
  })
  if (!rows.length) return null
  return {
    id: pickText(raw, ['id', 'audit_id', 'auditId', 'reference', 'request_id', 'requestId', 'trace_id']),
    actor: pickText(raw, ['actor', 'approved_by', 'approvedBy', 'user', 'operator', 'requested_by']),
    rows,
  }
}

const SUCCESS_TOKENS = /^(ok|success|successful|succeeded|complete|completed|done|remediated|recovered|healthy|resolved|passed|executed)$/i
const FAILURE_TOKENS = /(fail|error|unhealthy|degraded|rejected|abort|rollback|rolled_back|timeout|timed_out|partial|denied|invalid|unsuccessful)/i

/**
 * Did the backend report the fix as successful?
 * Returns `null` when the response carries no recognizable signal, so the
 * caller can decide how to present it rather than guessing silently.
 */
export function detectSuccess(raw) {
  if (!isPlainObject(raw)) return null

  for (const key of ['success', 'ok', 'succeeded', 'executed', 'applied', 'fixed', 'healthy']) {
    const value = raw[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string' && SUCCESS_TOKENS.test(value.trim())) return true
    if (typeof value === 'string' && FAILURE_TOKENS.test(value)) return false
  }

  const status = pickText(raw, ['status', 'state', 'outcome', 'result', 'phase'])
  if (status) {
    if (FAILURE_TOKENS.test(status)) return false
    if (SUCCESS_TOKENS.test(status.trim())) return true
  }

  const message = pickText(raw, ['message', 'summary', 'detail', 'description', 'note'])
  if (message && FAILURE_TOKENS.test(message)) return false

  return null
}

/* ------------------------------------------------------------------ *
 * Top-level view models
 * ------------------------------------------------------------------ */

export function normalizeDiagnosis(raw) {
  if (!isPlainObject(raw)) {
    return {
      raw,
      incidentId: null,
      title: null,
      summary: null,
      severity: null,
      status: null,
      startedAt: null,
      service: null,
      rootCause: null,
      confidence: null,
      evidence: [],
      logs: [],
      deployment: null,
      timeline: [],
      remediation: null,
      audit: null,
      health: null,
    }
  }

  const rootCause =
    pickText(raw, [
      'root_cause',
      'rootCause',
      'root_cause_analysis',
      'rootCauseAnalysis',
      'cause',
      'diagnosis',
      'explanation',
      'reason',
      'analysis',
      'summary',
    ]) ?? null

  if (!rootCause) {
    devWarn('Could not map a root cause field. Response keys:', Object.keys(raw))
  }

  const evidence = normalizeEvidence(
    pickFrom(raw, ['evidence', 'supporting_evidence', 'supportingEvidence', 'proof', 'signals', 'findings', 'indicators']),
  )
  if (!evidence.length) {
    devWarn('Could not map an evidence list. Response keys:', Object.keys(raw))
  }

  const logs = normalizeLogs(
    pickFrom(raw, ['telemetry', 'logs', 'log', 'raw_logs', 'rawLogs', 'log_output', 'logOutput', 'output', 'stdout_stderr', 'events']),
  )
  if (!logs.length) {
    devWarn('Could not map telemetry/logs. Response keys:', Object.keys(raw))
  }

  const timeline = normalizeTimeline(
    pickFrom(raw, ['timeline', 'incident_timeline', 'incidentTimeline', 'history', 'events_log', 'chronology', 'steps']),
  )

  const remediation = normalizeRemediation(
    pickFrom(raw, ['remediation', 'remediation_plan', 'remediationPlan', 'fix', 'recommended_fix', 'recommendedFix', 'recommendation', 'runbook']),
  )

  const confidence = normalizeConfidence(
    pickFrom(raw, ['confidence', 'confidence_score', 'confidenceScore', 'certainty', 'probability', 'score']),
  )
  if (confidence === null) {
    devWarn('Could not map a confidence value. Response keys:', Object.keys(raw))
  }

  return {
    raw,
    incidentId: pickText(raw, ['incident_id', 'incidentId', 'id', 'case_id', 'ticket', 'alert_id']),
    title: pickText(raw, ['title', 'name', 'summary', 'headline', 'incident_title']),
    summary: pickText(raw, ['summary', 'description', 'overview', 'abstract']),
    severity: normalizeSeverity(pickFrom(raw, ['severity', 'priority', 'urgency', 'level', 'sev'])),
    status: pickText(raw, ['status', 'state']),
    startedAt: pickText(raw, ['started_at', 'startedAt', 'detected_at', 'detectedAt', 'created_at', 'timestamp', 'started']),
    service: pickText(raw, ['service', 'service_name', 'serviceName', 'app', 'application', 'component', 'target']),
    rootCause,
    confidence,
    evidence,
    logs,
    deployment: pickObject(raw, [
      'deployment',
      'deploy',
      'deploy_metadata',
      'deployMetadata',
      'deployment_metadata',
      'deploymentMetadata',
      'release',
      'change',
    ]),
    timeline,
    remediation,
    audit: normalizeAudit(pickFrom(raw, ['audit', 'audit_trail', 'auditTrail', 'audit_log'])),
    health: normalizeHealth(pickFrom(raw, ['health', 'health_status', 'healthStatus', 'system_health', 'systemHealth'])),
  }
}

export function normalizeRemediationResult(raw) {
  if (!isPlainObject(raw)) {
    return { raw, success: null, message: null, summary: null, audit: null, health: null, changes: [], finishedAt: null, fields: [] }
  }

  const success = detectSuccess(raw)
  if (success === null) {
    devWarn('Remediation response had no recognizable success field. Response keys:', Object.keys(raw))
  }

  const changes = pickArray(raw, ['changes', 'actions_applied', 'actionsApplied', 'applied', 'results', 'steps', 'commands_executed'])
    .map((change) => toText(change))
    .filter(Boolean)

  return {
    raw,
    success,
    message: pickText(raw, ['message', 'detail', 'description', 'error', 'reason']),
    summary: pickText(raw, ['summary', 'outcome', 'result', 'note', 'status_message']),
    audit: normalizeAudit(pickFrom(raw, ['audit', 'audit_trail', 'auditTrail', 'audit_log', 'audit_log_id'])),
    health: normalizeHealth(pickFrom(raw, ['health', 'health_status', 'healthStatus', 'post_remediation_health', 'system_health'])),
    changes,
    finishedAt: pickText(raw, ['executed_at', 'executedAt', 'completed_at', 'completedAt', 'finished_at', 'timestamp']),
    fields: toFieldList(raw, {
      skip: ['audit', 'audit_trail', 'auditTrail', 'audit_log', 'changes', 'steps', 'raw'],
      order: ['success', 'status', 'message', 'summary', 'executed_at', 'duration_ms'],
    }),
  }
}
