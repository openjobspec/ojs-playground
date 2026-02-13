const DURATION_RE = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

/**
 * Parse an ISO 8601 duration string into milliseconds.
 * Supports: PT1S, PT5M, PT1H, PT0.5S, P1D, etc.
 */
export function parseDuration(iso: string): number {
  const match = DURATION_RE.exec(iso)
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration: ${iso}`)
  }

  const years = parseInt(match[1] ?? '0', 10)
  const months = parseInt(match[2] ?? '0', 10)
  const weeks = parseInt(match[3] ?? '0', 10)
  const days = parseInt(match[4] ?? '0', 10)
  const hours = parseInt(match[5] ?? '0', 10)
  const minutes = parseInt(match[6] ?? '0', 10)
  const seconds = parseFloat(match[7] ?? '0')

  // Approximate: 1 year = 365 days, 1 month = 30 days
  const totalSeconds =
    years * 365 * 86400 +
    months * 30 * 86400 +
    weeks * 7 * 86400 +
    days * 86400 +
    hours * 3600 +
    minutes * 60 +
    seconds

  return Math.round(totalSeconds * 1000)
}

/**
 * Format milliseconds into a human-readable string.
 * Examples: "1s", "5m 30s", "1h 2m 3s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`

  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Convert milliseconds to an ISO 8601 duration string.
 * Examples: 1000 -> "PT1S", 300000 -> "PT5M"
 */
export function toIsoDuration(ms: number): string {
  const totalSeconds = ms / 1000

  if (totalSeconds < 60) {
    return Number.isInteger(totalSeconds)
      ? `PT${totalSeconds}S`
      : `PT${totalSeconds}S`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let result = 'PT'
  if (hours > 0) result += `${hours}H`
  if (minutes > 0) result += `${minutes}M`
  if (seconds > 0) {
    result += Number.isInteger(seconds) ? `${seconds}S` : `${seconds}S`
  }

  return result
}
