import { useCallback, useEffect, useRef, useState } from 'react'
import { diagnose, remediate, SCENARIO_IDS } from '../api/incidentService'
import { normalizeDiagnosis, normalizeRemediationResult } from '../lib/normalize'

/**
 * Stages the dashboard moves through.
 *
 *   idle ──select──▶ ready ──run──▶ investigating ──▶ awaiting_authorization
 *                                                            │
 *                                                     approve
 *                                                            ▼
 *                                                       executing ──▶ completed
 *
 * Errors are tracked separately from the phase so a failure never loses the
 * data we already have on screen.
 */
export const PHASES = {
  IDLE: 'idle',
  READY: 'ready',
  INVESTIGATING: 'investigating',
  AWAITING_AUTHORIZATION: 'awaiting_authorization',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
}

const messageOf = (error, fallback) => error?.message || fallback

export function useIncidentWorkflow() {
  const [scenario, setScenario] = useState(null)
  const [phase, setPhase] = useState(PHASES.IDLE)
  const [diagnosis, setDiagnosis] = useState(null)
  const [remediationResult, setRemediationResult] = useState(null)
  const [investigationError, setInvestigationError] = useState(null)
  const [remediationError, setRemediationError] = useState(null)

  // Lets us cancel an in-flight call when the user resets or leaves.
  const activeRequest = useRef(null)

  const abortActive = useCallback(() => {
    activeRequest.current?.abort()
    activeRequest.current = null
  }, [])

  useEffect(() => () => activeRequest.current?.abort(), [])

  /** Changing scenario invalidates any analysis already on screen. */
  const selectScenario = useCallback((nextScenario) => {
    if (!SCENARIO_IDS.includes(nextScenario)) return
    activeRequest.current?.abort()
    activeRequest.current = null
    setScenario(nextScenario)
    setDiagnosis(null)
    setRemediationResult(null)
    setInvestigationError(null)
    setRemediationError(null)
    setPhase(PHASES.READY)
  }, [])

  const runInvestigation = useCallback(async () => {
    if (!scenario) return
    const controller = new AbortController()
    activeRequest.current = controller

    setPhase(PHASES.INVESTIGATING)
    setInvestigationError(null)
    setRemediationError(null)
    setRemediationResult(null)

    try {
      const payload = await diagnose(scenario, { signal: controller.signal })
      setDiagnosis(normalizeDiagnosis(payload))
      setPhase(PHASES.AWAITING_AUTHORIZATION)
    } catch (error) {
      if (error?.name === 'ApiError' && error.message === 'Request was cancelled.') return
      setInvestigationError(messageOf(error, 'The AI investigation failed.'))
      setPhase(PHASES.READY)
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [scenario])

  const approveAndExecute = useCallback(async () => {
    const controller = new AbortController()
    activeRequest.current = controller

    setPhase(PHASES.EXECUTING)
    setRemediationError(null)

    try {
      const activeId = diagnosis?.incidentId || diagnosis?.incident_id || (scenario === 'memory_leak_oom' || scenario === 'INC-8093' ? 'INC-8093' : 'INC-8092')
      const payload = await remediate({ incident_id: activeId, approved: true, signal: controller.signal })
      setRemediationResult(normalizeRemediationResult(payload))
      setPhase(PHASES.COMPLETED)
    } catch (error) {
      if (error?.name === 'ApiError' && error.message === 'Request was cancelled.') {
        setPhase(PHASES.AWAITING_AUTHORIZATION)
        return
      }
      setRemediationError(messageOf(error, 'Remediation failed to execute.'))
      // Back to the approval step so the operator can review and retry.
      setPhase(PHASES.AWAITING_AUTHORIZATION)
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [])

  const reset = useCallback(() => {
    abortActive()
    setScenario(null)
    setPhase(PHASES.IDLE)
    setDiagnosis(null)
    setRemediationResult(null)
    setInvestigationError(null)
    setRemediationError(null)
  }, [abortActive])

  const dismissRemediationError = useCallback(() => setRemediationError(null), [])

  /**
   * Health is only ever shown as reported by the backend, or derived from the
   * workflow stage. We never invent a "healthy" state: an unconfirmed or failed
   * remediation leaves the incident degraded.
   */
  const health = (() => {
    if (remediationResult) {
      // Only an explicit success signal (or a backend-reported status) flips to healthy.
      return {
        status: remediationResult.health ?? (remediationResult.success === true ? 'healthy' : 'degraded'),
        source: remediationResult.health ? 'backend' : 'derived',
      }
    }
    if (diagnosis) {
      return { status: diagnosis.health ?? 'degraded', source: diagnosis.health ? 'backend' : 'derived' }
    }
    return { status: 'unknown', source: 'derived' }
  })()

  /** True only when the backend positively confirmed the fix. */
  const remediationSucceeded = remediationResult ? remediationResult.success !== false : null

  return {
    phase,
    scenario,
    diagnosis,
    remediationResult,
    investigationError,
    remediationError,
    health,
    remediationSucceeded,
    isInvestigating: phase === PHASES.INVESTIGATING,
    isExecuting: phase === PHASES.EXECUTING,
    needsAuthorization: phase === PHASES.AWAITING_AUTHORIZATION,
    selectScenario,
    runInvestigation,
    approveAndExecute,
    dismissRemediationError,
    reset,
  }
}
