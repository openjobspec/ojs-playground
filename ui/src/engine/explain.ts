import type { OJSJob } from './types'
import { parseDuration } from './duration'
import { formatDuration } from './duration'

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
      const ms = parseDuration(r.initial_interval)
      parts.push(`starting with a **${formatDuration(ms)}** delay`)
    }

    if (r.backoff_coefficient && r.backoff_coefficient > 1) {
      parts.push(`**${r.backoff_coefficient}x** exponential backoff`)
    }

    if (r.max_interval) {
      const ms = parseDuration(r.max_interval)
      parts.push(`capped at **${formatDuration(ms)}**`)
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
