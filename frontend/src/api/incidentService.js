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
 * POST /diagnose
 * Runs the AI investigation for the selected scenario.
 * AI analysis can be slow, so this gets a generous timeout.
 */
export function diagnose(scenario, { signal } = {}) {
  return request('/diagnose', {
    method: 'POST',
    body: { scenario },
    signal,
    timeoutMs: 120000,
  })
}

/**
 * POST /remediate
 * Triggers the fix. `approved: true` is the human-authorization flag the
 * backend requires before it will touch anything.
 */
export function remediate({ approved, signal } = {}) {
  return request('/remediate', {
    method: 'POST',
    body: { approved: approved === true },
    signal,
    timeoutMs: 120000,
  })
}
