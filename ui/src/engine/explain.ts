import type { OJSJob } from './types'
import { parseDuration } from './duration'
import { formatDuration } from './duration'

/**
 * Format a retry interval for display. Falls back to the raw value when it is
 * not a valid ISO 8601 duration so malformed-but-parseable specs never throw
 * (explainJob runs on any parseable job, before schema validation).
 */
function describeInterval(iso: string): string {
  try {
    return formatDuration(parseDuration(iso))
  } catch {
    return iso
  }
}

/**
 * Generate a plain-English explanation of an OJS job spec.
 * No AI required — fully template-driven.
 */
export function explainJob(job: OJSJob): string[] {
  const lines: string[] = []

  // Basic identity
  lines.push(`This is a **${job.type}** job on the **${job.queue}** queue.`)

  // Args
  if (job.args && job.args.length > 0) {
    const argStr = job.args.map((a) => typeof a === 'string' ? `"${a}"` : String(a)).join(', ')
    lines.push(`It receives ${job.args.length} argument${job.args.length !== 1 ? 's' : ''}: ${argStr}.`)
  }

  // Priority
  if (job.priority !== undefined && job.priority !== 0) {
    lines.push(`Priority: **${job.priority}** (higher values are processed first).`)
  }

  // Timeout
  if (job.timeout !== undefined) {
    const timeout = typeof job.timeout === 'number' ? job.timeout : job.timeout.execution ?? 0
    if (timeout > 0) {
      lines.push(`Execution timeout: **${timeout}s**. The job will be killed if it runs longer.`)
    }
  }

  // Scheduling
  if (job.scheduled_at) {
    lines.push(`Scheduled for **${job.scheduled_at}**. The job won't execute until this time.`)
  }

  // Retry policy
  if (job.retry) {
    const r = job.retry
    const maxAttempts = r.max_attempts ?? 3
    const parts: string[] = [`up to **${maxAttempts}** attempts`]

    if (r.initial_interval) {
      parts.push(`starting with a **${describeInterval(r.initial_interval)}** delay`)
    }

    if (r.backoff_coefficient && r.backoff_coefficient > 1) {
      parts.push(`**${r.backoff_coefficient}x** exponential backoff`)
    }

    if (r.max_interval) {
      parts.push(`capped at **${describeInterval(r.max_interval)}**`)
    }

    if (r.jitter) {
      parts.push(`with jitter to prevent thundering herd`)
    }

    lines.push(`Retry policy: ${parts.join(', ')}.`)

    if (r.non_retryable_errors && r.non_retryable_errors.length > 0) {
      lines.push(`Non-retryable errors: ${r.non_retryable_errors.map((e) => `\`${e}\``).join(', ')}.`)
    }

    if (r.on_exhaustion === 'dead_letter') {
      lines.push(`On retry exhaustion, the job moves to a **dead letter queue** for manual inspection.`)
    }
  } else {
    lines.push(`No retry policy — the job runs exactly once.`)
  }

  // Unique policy
  if (job.unique) {
    const keys = job.unique.keys?.join(', ') ?? 'default keys'
    lines.push(`Uniqueness constraint on [${keys}]${job.unique.period ? ` within ${job.unique.period}` : ''}.`)
  }

  // Cron
  if (job.cron) {
    lines.push(`Recurring schedule: \`${job.cron.expression}\`${job.cron.timezone ? ` (${job.cron.timezone})` : ''}.`)
  }

  // Meta
  if (job.meta && Object.keys(job.meta).length > 0) {
    const metaKeys = Object.keys(job.meta).join(', ')
    lines.push(`Metadata: ${metaKeys}.`)
  }

  return lines
}

/**
 * Escape HTML metacharacters so untrusted text can be safely embedded in markup.
 * Must run before any intentional markup is added.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render a single explanation line to safe HTML. Explanation lines interpolate
 * user-controlled job fields (type, queue, args, cron expression, meta keys,
 * …), so the raw text is HTML-escaped first and only the intended **bold** and
 * `code` markers are then expanded. This prevents DOM XSS when the result is
 * assigned via dangerouslySetInnerHTML (e.g. from a shared deep link).
 */
export function explainLineToHtml(line: string): string {
  return escapeHtml(line)
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-0.5 rounded text-[10px]">$1</code>')
}
