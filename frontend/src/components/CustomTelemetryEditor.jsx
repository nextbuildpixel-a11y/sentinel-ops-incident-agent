import { useState, useId } from 'react'
import { Code2, FileText, Sparkles, Trash2, CheckCircle2, AlertCircle, Copy, HelpCircle } from 'lucide-react'
import { cx } from './ui/primitives'

export const SAMPLE_REDIS_JSON = {
  incident_id: 'INC-8094',
  title: 'Redis Cache Cluster Partition & Auth Latency Spike',
  service: 'session-auth-service',
  severity: 'CRITICAL',
  timestamp: '2026-09-26T11:20:00Z',
  deployment_history: [
    {
      version: 'v3.0.2',
      timestamp: '2026-09-26T11:10:00Z',
      author: 'devops.jason',
      commit: 'fix(cache): enable strict TLS and reduce redis connect timeout to 50ms',
    },
  ],
  metrics: [
    { timestamp: '11:11:00', cpu_percent: 18, redis_connections_active: 45, p99_latency_ms: 12 },
    { timestamp: '11:13:00', cpu_percent: 42, redis_connections_active: 12, p99_latency_ms: 850 },
    { timestamp: '11:15:00', cpu_percent: 88, redis_connections_active: 2, p99_latency_ms: 4200 },
    { timestamp: '11:18:00', cpu_percent: 96, redis_connections_active: 0, p99_latency_ms: 5000 },
  ],
  logs: [
    { timestamp: '11:10:15', level: 'INFO', message: 'Deployed session-auth-service version v3.0.2 with strict TLS redis client.' },
    { timestamp: '11:12:30', level: 'WARN', message: 'Redis cluster node 10.0.4.12:6379 handshake failed: TLS Certificate Hostname Mismatch' },
    { timestamp: '11:14:02', level: 'ERROR', message: 'Redis::ConnectionTimeout: Failed to connect to redis-cluster-primary:6379 after 50ms' },
    { timestamp: '11:16:45', level: 'ERROR', message: 'SessionCacheUnavailable: Unable to authenticate incoming JWT tokens, fallback degraded mode active' },
    { timestamp: '11:18:10', level: 'ERROR', message: 'HTTP 504 GatewayTimeout on /api/v1/auth/session' },
  ],
}

export const SAMPLE_KAFKA_JSON = {
  incident_id: 'INC-8095',
  title: 'Kafka Consumer Group Rebalance Storm & Pipeline Lag Spike',
  service: 'order-event-consumer',
  severity: 'CRITICAL',
  timestamp: '2026-09-26T12:00:00Z',
  deployment_history: [
    {
      version: 'v1.4.0',
      timestamp: '2026-09-26T11:50:00Z',
      author: 'pipeline.sam',
      commit: 'perf: reduce max.poll.interval.ms to 3000ms and batch size to 500',
    },
  ],
  metrics: [
    { timestamp: '11:51:00', consumer_lag: 150, rebalances_total: 0, cpu_percent: 25 },
    { timestamp: '11:54:00', consumer_lag: 4200, rebalances_total: 8, cpu_percent: 78 },
    { timestamp: '11:57:00', consumer_lag: 18500, rebalances_total: 24, cpu_percent: 95 },
    { timestamp: '12:00:00', consumer_lag: 45000, rebalances_total: 42, cpu_percent: 99 },
  ],
  logs: [
    { timestamp: '11:50:10', level: 'INFO', message: 'order-event-consumer v1.4.0 started with tight poll timeout (3000ms)' },
    { timestamp: '11:52:45', level: 'WARN', message: 'Kafka::CommitFailedException: Commit cannot be completed since group has rebalanced' },
    { timestamp: '11:54:12', level: 'ERROR', message: 'ConsumerPollTimeout: Processing batch exceeded max.poll.interval.ms (3000ms), evicting member' },
    { timestamp: '11:56:30', level: 'ERROR', message: 'ConsumerGroupRebalanceStorm: 42 rebalances triggered in last 5 minutes. Event ingestion stalled.' },
    { timestamp: '11:59:15', level: 'ERROR', message: 'OrderProcessingBackpressure: Consumer lag exceeded 40,000 messages on topic orders.v1' },
  ],
}

export const SAMPLE_RAW_LOGS = `12:01:05 INFO  checkout-gateway v2.9.1 initialized pool size=32
12:04:12 WARN  upstream connection slow: postgres-primary latency 1400ms
12:06:40 ERROR DB::ConnectionAcquireTimeout: Timed out waiting for connection after 5000ms
12:07:15 ERROR HTTP 500 InternalServerError returned on /api/v2/charge
12:08:00 ERROR ConnectionPoolStarvation: active=32 max=32 queue=150. Rejecting traffic.`

export function CustomTelemetryEditor({ value, onChange, disabled }) {
  const textareaId = useId()
  const [copied, setCopied] = useState(false)

  // Detect format & parse stats
  let parsedJson = null
  let jsonError = null
  const trimmed = (value || '').trim()

  if (trimmed) {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedJson = JSON.parse(trimmed)
      } catch (err) {
        jsonError = err.message
      }
    }
  }

  const lineCount = trimmed ? trimmed.split('\n').length : 0
  const charCount = (value || '').length

  const handleCopy = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface-raised/40 p-3.5">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-brand/10 text-brand">
            <Code2 size={13} aria-hidden="true" />
          </span>
          <label htmlFor={textareaId} className="text-xs font-semibold text-ink">
            Custom Telemetry & Raw Incident Payload
          </label>
        </div>

        {/* Preset quick-load buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-ink-faint">Load Sample:</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(JSON.stringify(SAMPLE_REDIS_JSON, null, 2))}
            className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
          >
            <Sparkles size={10} className="text-brand" />
            Redis Timeout
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(JSON.stringify(SAMPLE_KAFKA_JSON, null, 2))}
            className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
          >
            <Sparkles size={10} className="text-brand" />
            Kafka Lag
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(SAMPLE_RAW_LOGS)}
            className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-raised hover:text-ink"
          >
            <FileText size={10} />
            Raw Logs
          </button>

          {value && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[10px] font-medium text-ink-faint transition-colors hover:border-warn/40 hover:bg-warn/10 hover:text-warn"
              title="Clear input"
            >
              <Trash2 size={10} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Editor textarea */}
      <div className="relative">
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Paste your JSON telemetry payload or raw log stream here...\n\nExample JSON:\n{\n  "service": "payment-api",\n  "logs": [{"level": "ERROR", "message": "Connection refused"}],\n  "metrics": [{"cpu_percent": 95}]\n}`}
          rows={9}
          spellCheck={false}
          className={cx(
            'w-full resize-y rounded border bg-[#0a0f18] px-3.5 py-3 font-mono text-[12px] leading-relaxed text-[#d1d5db]',
            'placeholder:text-ink-faint/50 focus:outline-none focus:ring-1 focus:ring-brand/40',
            disabled && 'opacity-50 cursor-not-allowed',
            jsonError ? 'border-warn/50' : parsedJson ? 'border-brand/40' : 'border-line'
          )}
        />

        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2.5 right-2.5 rounded bg-surface/80 p-1 text-ink-faint hover:text-ink"
            title="Copy content"
          >
            <Copy size={12} />
          </button>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2">
          {parsedJson ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 size={12} />
              Valid Structured JSON
              {parsedJson.service && (
                <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[10px] text-emerald-300">
                  service: {parsedJson.service}
                </span>
              )}
            </span>
          ) : jsonError ? (
            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
              <AlertCircle size={12} />
              JSON syntax warning (treated as raw text stream)
            </span>
          ) : trimmed ? (
            <span className="inline-flex items-center gap-1 text-sky-400 font-medium">
              <FileText size={12} />
              Plaintext Log Stream (auto-extracted by AI)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-ink-faint">
              <HelpCircle size={12} />
              Accepts structured JSON or arbitrary error log dumps
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px] text-ink-faint">
          <span>{lineCount} lines</span>
          <span>{charCount} chars</span>
        </div>
      </div>
    </div>
  )
}
