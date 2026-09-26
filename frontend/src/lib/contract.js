import { normalizeConfidence, normalizeEvidence, normalizeLogs } from './normalize'

/**
 * Read-only view over the documented backend response contract.
 *
 * WHY THIS EXISTS
 * ---------------
 * `lib/normalize.js` maps a response by descending one level into a known
 * container. The real contract nests two levels deep:
 *
 *   data.diagnosis.root_cause
 *   data.diagnosis.confidence_score
 *   data.diagnosis.summary
 *   data.diagnosis.supporting_evidence
 *   data.diagnosis.remediation_action
 *   data.diagnosis.rollback_command
 *   data.raw_telemetry.logs
 *   data.raw_telemetry.deployment_history
 *
 * so the shared normalizer cannot see those fields. Rather than change that
 * logic, this module reads the documented path directly and reuses the
 * normalizer's own helpers to shape the values into the exact view models the
 * existing components already expect.
 *
 * It is presentation-only: no network calls, no state, no business logic.
 * Every field falls back to null/[] so a missing value renders an empty state
 * rather than inventing data.
 */

const CONTRACT_ROOT_KEYS = ['data', 'result', 'results', 'payload']

/** Locate the documented `data` envelope, tolerating an unwrapped response. */
function unwrap(root) {
  if (!root || typeof root !== 'object') return {}
  for (const key of CONTRACT_ROOT_KEYS) {
    const value = root[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  }
  return root
}

const asText = (value) => (typeof value === 'string' && value.trim() ? value : null)

const asList = (value) => (Array.isArray(value) ? value : [])

/** Pull the documented fields out of the raw response. */
export function readContract(diagnosis) {
  const root = diagnosis?.raw
  const data = unwrap(root)
  const dx = data.diagnosis && typeof data.diagnosis === 'object' ? data.diagnosis : data
  const telemetry = data.raw_telemetry && typeof data.raw_telemetry === 'object' ? data.raw_telemetry : {}

  return {
    rootCause: asText(dx.root_cause),
    confidence: typeof dx.confidence_score === 'number' ? dx.confidence_score : null,
    summary: asText(dx.summary),
    evidence: asList(dx.supporting_evidence),
    action: asText(dx.remediation_action),
    rollback: asText(dx.rollback_command),
    logs: asList(telemetry.logs),
    deploymentHistory: asList(telemetry.deployment_history),
  }
}

/**
 * Deployment history entries. The contract sends plain strings; if a richer
 * object ever arrives we still render something readable instead of "[object
 * Object]".
 */
export function toHistoryEntries(entries) {
  return entries
    .map((entry, index) => {
      if (typeof entry === 'string') return { key: `${index}-${entry}`, text: entry }
      if (entry && typeof entry === 'object') {
        const text =
          asText(entry.message) ??
          asText(entry.summary) ??
          asText(entry.description) ??
          asText(entry.change) ??
          asText(entry.version) ??
          null
        const detail = Object.entries(entry)
          .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
          .map(([key, value]) => `${key}=${value}`)
          .join('  ')
        return { key: `${index}-${detail || text}`, text: text ?? detail, mono: !text }
      }
      return { key: `${index}`, text: String(entry) }
    })
    .filter((entry) => entry.text)
}

/**
 * Merge the normalized view model with the documented contract fields.
 *
 * Normalized values win when present, so behaviour is unchanged for any
 * response shape that already worked; the contract path is the fallback.
 */
export function buildDiagnosisView(diagnosis) {
  if (!diagnosis) return null

  const contract = readContract(diagnosis)

  const evidence = diagnosis.evidence?.length
    ? diagnosis.evidence
    : normalizeEvidence(contract.evidence)

  const logs = diagnosis.logs?.length ? diagnosis.logs : normalizeLogs(contract.logs)

  return {
    ...diagnosis,
    rootCause: diagnosis.rootCause ?? contract.rootCause,
    summary: diagnosis.summary ?? contract.summary,
    confidence: diagnosis.confidence ?? normalizeConfidence(contract.confidence),
    evidence,
    logs,
    action: contract.action ?? diagnosis.remediation?.summary ?? diagnosis.remediation?.title ?? null,
    rollback: contract.rollback ?? diagnosis.remediation?.rollback ?? null,
    deploymentHistory: contract.deploymentHistory,
  }
}
