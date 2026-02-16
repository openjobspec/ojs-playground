/**
 * Cron expression parser and next-run calculator.
 *
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Also supports common aliases: @yearly, @monthly, @weekly, @daily, @hourly
 */

export interface CronField {
  label: string
  min: number
  max: number
  names?: string[]
}

export const CRON_FIELDS: CronField[] = [
  { label: 'Minute', min: 0, max: 59 },
  { label: 'Hour', min: 0, max: 23 },
  { label: 'Day of Month', min: 1, max: 31 },
  { label: 'Month', min: 1, max: 12, names: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] },
  { label: 'Day of Week', min: 0, max: 6, names: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
]

export const CRON_ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export interface CronParseResult {
  valid: boolean
  error?: string
  fields?: number[][]
  description?: string
}

function expandField(field: string, min: number, max: number, names?: string[]): number[] | string {
  let f = field.toUpperCase()
  if (names) {
    for (let i = 0; i < names.length; i++) {
      f = f.replace(new RegExp(names[i]!, 'g'), String(min + i))
    }
  }

  if (f === '*') {
    const vals: number[] = []
    for (let i = min; i <= max; i++) vals.push(i)
    return vals
  }

  const values = new Set<number>()

  for (const part of f.split(',')) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part)
    let range: string
    let step = 1

    if (stepMatch) {
      range = stepMatch[1]!
      step = parseInt(stepMatch[2]!, 10)
      if (step < 1) return `Invalid step value: ${step}`
    } else {
      range = part
    }

    if (range === '*') {
      for (let i = min; i <= max; i += step) values.add(i)
    } else if (range.includes('-')) {
      const [startStr, endStr] = range.split('-')
      const start = parseInt(startStr!, 10)
      const end = parseInt(endStr!, 10)
      if (isNaN(start) || isNaN(end)) return `Invalid range: ${range}`
      if (start < min || end > max || start > end) return `Range out of bounds: ${range}`
      for (let i = start; i <= end; i += step) values.add(i)
    } else {
      const val = parseInt(range, 10)
      if (isNaN(val) || val < min || val > max) return `Value out of bounds: ${range} (${min}-${max})`
      values.add(val)
    }
  }

  return Array.from(values).sort((a, b) => a - b)
}

export function parseCron(expression: string): CronParseResult {
  const trimmed = expression.trim()

  if (trimmed.startsWith('@')) {
    const resolved = CRON_ALIASES[trimmed.toLowerCase()]
    if (!resolved) return { valid: false, error: `Unknown alias: ${trimmed}` }
    return parseCron(resolved)
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5) {
    return { valid: false, error: `Expected 5 fields, got ${parts.length}` }
  }

  const fields: number[][] = []
  for (let i = 0; i < 5; i++) {
    const result = expandField(parts[i]!, CRON_FIELDS[i]!.min, CRON_FIELDS[i]!.max, CRON_FIELDS[i]!.names)
    if (typeof result === 'string') {
      return { valid: false, error: `${CRON_FIELDS[i]!.label}: ${result}` }
    }
    fields.push(result)
  }

  return {
    valid: true,
    fields,
    description: describeCron(parts),
  }
}

function describeCron(parts: string[]): string {
  const [minute, hour, dom, month, dow] = parts as [string, string, string, string, string]
  const segments: string[] = []

  if (minute === '0' && hour === '0' && dom === '1' && month === '1' && dow === '*') {
    return 'Once a year (January 1st at midnight)'
  }
  if (minute === '0' && hour === '0' && dom === '1' && month === '*' && dow === '*') {
    return 'Once a month (1st at midnight)'
  }
  if (minute === '0' && hour === '0' && dom === '*' && month === '*' && dow === '0') {
    return 'Once a week (Sunday at midnight)'
  }
  if (minute === '0' && hour === '0' && dom === '*' && month === '*' && dow === '*') {
    return 'Once a day at midnight'
  }
  if (minute === '0' && hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return 'Once an hour at minute 0'
  }

  if (minute !== '*') segments.push(`at minute ${minute}`)
  if (hour !== '*') segments.push(`at hour ${hour}`)
  if (dom !== '*') segments.push(`on day ${dom} of month`)
  if (month !== '*') segments.push(`in month ${month}`)
  if (dow !== '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayNum = parseInt(dow, 10)
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      segments.push(`on ${dayNames[dayNum]}`)
    } else {
      segments.push(`on day-of-week ${dow}`)
    }
  }

  return segments.length > 0 ? segments.join(', ') : 'Every minute'
}

/**
 * Compute the next N run times from a parsed cron expression.
 */
export function getNextRuns(expression: string, count: number, from?: Date): Date[] | null {
  const parsed = parseCron(expression)
  if (!parsed.valid || !parsed.fields) return null

  const [minutes, hours, doms, months, dows] = parsed.fields as [number[], number[], number[], number[], number[]]
  const runs: Date[] = []
  const start = from ? new Date(from) : new Date()

  // Advance by 1 minute to avoid returning `from` itself
  start.setSeconds(0, 0)
  start.setMinutes(start.getMinutes() + 1)

  const current = new Date(start)
  const maxIterations = 366 * 24 * 60 // 1 year of minutes as safety limit

  for (let i = 0; i < maxIterations && runs.length < count; i++) {
    const m = current.getMinutes()
    const h = current.getHours()
    const d = current.getDate()
    const mo = current.getMonth() + 1
    const dw = current.getDay()

    if (
      minutes.includes(m) &&
      hours.includes(h) &&
      doms.includes(d) &&
      months.includes(mo) &&
      dows.includes(dw)
    ) {
      runs.push(new Date(current))
    }

    current.setMinutes(current.getMinutes() + 1)
  }

  return runs
}

export interface CronPreset {
  label: string
  expression: string
  description: string
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every minute', expression: '* * * * *', description: 'Run every minute' },
  { label: 'Every 5 minutes', expression: '*/5 * * * *', description: 'Run every 5 minutes' },
  { label: 'Every 15 minutes', expression: '*/15 * * * *', description: 'Run every 15 minutes' },
  { label: 'Every hour', expression: '0 * * * *', description: 'Run at the start of every hour' },
  { label: 'Every 6 hours', expression: '0 */6 * * *', description: 'Run every 6 hours' },
  { label: 'Daily at midnight', expression: '0 0 * * *', description: 'Run once a day at midnight' },
  { label: 'Daily at 9am', expression: '0 9 * * *', description: 'Run once a day at 9:00 AM' },
  { label: 'Weekdays at 9am', expression: '0 9 * * 1-5', description: 'Run Mon-Fri at 9:00 AM' },
  { label: 'Weekly (Sunday)', expression: '0 0 * * 0', description: 'Run every Sunday at midnight' },
  { label: 'Monthly', expression: '0 0 1 * *', description: 'Run on the 1st of every month at midnight' },
]
