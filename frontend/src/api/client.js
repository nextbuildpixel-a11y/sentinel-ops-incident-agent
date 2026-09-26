/**
 * Minimal fetch wrapper for the SentinelOps backend.
 *
 * This is the ONLY place in the app that knows how to talk HTTP. Components
 * never call `fetch` directly - they go through `api/incidentService.js`.
 */

const DEFAULT_BASE_URL = 'http://localhost:8000/api'

// Strip trailing slashes so `${API_BASE_URL}/diagnose` never doubles up.
export const API_BASE_URL = String(
  import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL,
).replace(/\/+$/, '')

/** An HTTP or network failure, with enough detail to render in the UI. */
export class ApiError extends Error {
  constructor(message, { status = null, details = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.cause = cause
  }
}

/** FastAPI reports errors as `{ detail: ... }`; other backends may differ. */
function extractErrorDetail(payload) {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object') return null
  const candidates = [payload.detail, payload.error, payload.message]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    // FastAPI validation errors: detail is a list of objects.
    if (Array.isArray(candidate) && candidate.length) {
      return candidate
        .map((item) => (typeof item === 'string' ? item : item?.msg || JSON.stringify(item)))
        .join('; ')
    }
  }
  return null
}

/**
 * Combine a caller-supplied signal with a timeout so a hung AI call
 * cannot leave the dashboard spinning forever.
 */
function withTimeout(signal, timeoutMs) {
  const controller = new AbortController()
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null

  const onAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    },
  }
}

async function request(path, { method = 'GET', body, signal, timeoutMs = 60000 } = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const { signal: mergedSignal, cleanup } = withTimeout(signal, timeoutMs)

  let response
  try {
    response = await fetch(url, {
      method,
      signal: mergedSignal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // Distinguish "we cancelled" (user navigated away / hit reset) from a real failure.
    if (error?.name === 'AbortError') {
      throw new ApiError('Request was cancelled.', { cause: error })
    }
    throw new ApiError(
      `Could not reach the SentinelOps API at ${API_BASE_URL}. Is the backend running?`,
      { cause: error },
    )
  } finally {
    cleanup()
  }

  const rawText = await response.text()
  let payload = null
  if (rawText) {
    try {
      payload = JSON.parse(rawText)
    } catch {
      payload = rawText
    }
  }

  if (!response.ok) {
    const detail = extractErrorDetail(payload)
    throw new ApiError(detail || `Request failed with status ${response.status}.`, {
      status: response.status,
      details: payload,
    })
  }

  // An empty 2xx body is legitimate (e.g. a 204). Handlers treat null as "nothing to show".
  return payload ?? null
}

export { request }
