/**
 * Every backend endpoint the dashboard uses lives here.
 *
 * Components import these functions and never construct URLs themselves, so
 * the frontend only has to be updated in one place if a route ever changes.
 */

import { request } from './client'

/** The incident scenarios the backend can investigate. */
export const SCENARIOS = [
  {
    id: 'db_pool_exhausted',
    label: 'DB Connection Pool Exhausted',
    summary: 'Requests queueing behind a saturated connection pool.',
  },
  {
    id: 'memory_leak_oom',
    label: 'Memory Leak / OOM',
    summary: 'Resident memory climbing until the container is killed.',
  },
]

/** Ids only - handy for validation without importing the whole list. */
export const SCENARIO_IDS = SCENARIOS.map((scenario) => scenario.id)

/**
 * GET /incidents
 * Lists all available scenarios from backend.
 */
export function getIncidents({ signal } = {}) {
  return request('/incidents', {
    method: 'GET',
    signal,
  })
}

/**
 * POST /diagnose
 * Runs the AI investigation for the selected scenario.
 */
export function diagnose(scenario, { signal } = {}) {
  const scenarioKey = typeof scenario === 'object' ? scenario?.id || scenario?.incident_id : scenario
  const incident_id = scenarioKey === 'memory_leak_oom' || scenarioKey === 'INC-8093' ? 'INC-8093' : 'INC-8092'
  return request('/diagnose', {
    method: 'POST',
    body: { scenario: scenarioKey, incident_id },
    signal,
    timeoutMs: 120000,
  })
}

/**
 * POST /remediate
 * Triggers the fix. `approved: true` is the human-authorization flag the
 * backend requires before it will touch anything.
 */
export function remediate({ incident_id, approved, signal } = {}) {
  return request('/remediate', {
    method: 'POST',
    body: {
      incident_id: incident_id || 'INC-8092',
      approved: approved === true,
      operator: 'sre-lead',
    },
    signal,
    timeoutMs: 120000,
  })
}

/**
 * GET /audit-trail
 * Retrieves chronological audit history from backend.
 */
export function getAuditTrail({ signal } = {}) {
  return request('/audit-trail', {
    method: 'GET',
    signal,
  })
}
