import type { BackoffStrategy, RetryAttempt, RetryPolicy } from './types'
import { DEFAULT_RETRY_POLICY } from './constants'
import { parseDuration } from './duration'

/**
 * Simple seeded PRNG (mulberry32) for deterministic simulation.
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Merge a partial retry policy with defaults.
 */
export function mergeRetryPolicy(partial?: RetryPolicy): Required<RetryPolicy> {
  return { ...DEFAULT_RETRY_POLICY, ...partial }
}

/**
 * Compute the raw delay in ms for a given retry number (1-indexed).
 *
 * Formulas (from ojs-retry.md):
 * - none (constant): initial_interval
 * - linear: initial_interval * n
 * - exponential: initial_interval * backoff_coefficient^(n-1)
 * - polynomial: initial_interval * n^backoff_coefficient
 */
export function computeDelay(
  retryNumber: number,
  policy: Required<RetryPolicy>,
  strategy: BackoffStrategy,
): number {
  const base = parseDuration(policy.initial_interval)
  const coeff = policy.backoff_coefficient

  switch (strategy) {
    case 'none':
      return base
    case 'linear':
      return base * retryNumber
    case 'exponential':
      return base * Math.pow(coeff, retryNumber - 1)
    case 'polynomial':
      return base * Math.pow(retryNumber, coeff)
  }
}

/**
 * Apply jitter: multiply delay by random(0.5, 1.5).
 */
export function applyJitter(delay: number, rng: () => number): number {
  const factor = 0.5 + rng()  // rng() returns [0, 1) → factor is [0.5, 1.5)
  return delay * factor
}

/**
 * Compute the full retry schedule.
 *
 * Returns an array of RetryAttempt objects with timing info for each retry.
 * failOnAttempts: 1-indexed attempts that will fail (used by simulation).
 */
export function computeRetrySchedule(
  policy: RetryPolicy | undefined,
  strategy: BackoffStrategy,
  failOnAttempts: number[],
  seed?: number,
): RetryAttempt[] {
  const merged = mergeRetryPolicy(policy)
  const maxInterval = parseDuration(merged.max_interval)
  const rng = mulberry32(seed ?? 42)

  const maxRetries = merged.max_attempts - 1 // max_attempts includes initial
  const failSet = new Set(failOnAttempts)

  const schedule: RetryAttempt[] = []
  let cumulativeTime = 0

  for (let retryNum = 1; retryNum <= maxRetries; retryNum++) {
    // Only add retry if the corresponding attempt failed
    const attemptThatFailed = retryNum // retry N happens after attempt N fails
    if (!failSet.has(attemptThatFailed)) break

    const rawDelay = computeDelay(retryNum, merged, strategy)
    const cappedDelay = Math.min(rawDelay, maxInterval)

    let finalDelay: number
    let jitteredDelay: number

    if (merged.jitter) {
      jitteredDelay = applyJitter(cappedDelay, rng)
      finalDelay = Math.min(jitteredDelay, maxInterval) // post-jitter cap
    } else {
      jitteredDelay = cappedDelay
      finalDelay = cappedDelay
    }

    cumulativeTime += finalDelay

    schedule.push({
      retryNumber: retryNum,
      rawDelay,
      cappedDelay,
      jitteredDelay,
      finalDelay,
      cumulativeTime,
    })
  }

  return schedule
}
