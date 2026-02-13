import { describe, it, expect } from 'vitest'
import { computeDelay, computeRetrySchedule, mergeRetryPolicy } from '../retry'
import type { RetryPolicy } from '../types'
import { DEFAULT_RETRY_POLICY } from '../constants'

describe('mergeRetryPolicy', () => {
  it('returns defaults when no policy provided', () => {
    expect(mergeRetryPolicy()).toEqual(DEFAULT_RETRY_POLICY)
  })

  it('merges partial policy with defaults', () => {
    const result = mergeRetryPolicy({ max_attempts: 5 })
    expect(result.max_attempts).toBe(5)
    expect(result.initial_interval).toBe('PT1S')
    expect(result.backoff_coefficient).toBe(2.0)
  })
})

describe('computeDelay', () => {
  const policy = mergeRetryPolicy()

  it('constant (none): returns initial_interval', () => {
    expect(computeDelay(1, policy, 'none')).toBe(1000)
    expect(computeDelay(2, policy, 'none')).toBe(1000)
    expect(computeDelay(5, policy, 'none')).toBe(1000)
  })

  it('linear: initial_interval * n', () => {
    expect(computeDelay(1, policy, 'linear')).toBe(1000)
    expect(computeDelay(2, policy, 'linear')).toBe(2000)
    expect(computeDelay(3, policy, 'linear')).toBe(3000)
  })

  it('exponential: initial_interval * coefficient^(n-1)', () => {
    expect(computeDelay(1, policy, 'exponential')).toBe(1000)
    expect(computeDelay(2, policy, 'exponential')).toBe(2000)
    expect(computeDelay(3, policy, 'exponential')).toBe(4000)
    expect(computeDelay(4, policy, 'exponential')).toBe(8000)
  })

  it('polynomial: initial_interval * n^coefficient', () => {
    expect(computeDelay(1, policy, 'polynomial')).toBe(1000) // 1^2 = 1
    expect(computeDelay(2, policy, 'polynomial')).toBe(4000) // 2^2 = 4
    expect(computeDelay(3, policy, 'polynomial')).toBe(9000) // 3^2 = 9
  })

  it('respects custom initial_interval', () => {
    const custom = mergeRetryPolicy({ initial_interval: 'PT5S' })
    expect(computeDelay(1, custom, 'none')).toBe(5000)
    expect(computeDelay(2, custom, 'exponential')).toBe(10000)
  })
})

describe('computeRetrySchedule', () => {
  it('generates schedule for exponential backoff', () => {
    const policy: RetryPolicy = {
      max_attempts: 4,
      initial_interval: 'PT1S',
      backoff_coefficient: 2.0,
      max_interval: 'PT5M',
      jitter: false,
    }

    const schedule = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 42)
    expect(schedule).toHaveLength(3)

    expect(schedule[0]!.rawDelay).toBe(1000)
    expect(schedule[1]!.rawDelay).toBe(2000)
    expect(schedule[2]!.rawDelay).toBe(4000)
  })

  it('caps delay at max_interval', () => {
    const policy: RetryPolicy = {
      max_attempts: 5,
      initial_interval: 'PT1S',
      backoff_coefficient: 2.0,
      max_interval: 'PT3S',
      jitter: false,
    }

    const schedule = computeRetrySchedule(policy, 'exponential', [1, 2, 3, 4], 42)
    expect(schedule[0]!.cappedDelay).toBe(1000)
    expect(schedule[1]!.cappedDelay).toBe(2000)
    expect(schedule[2]!.cappedDelay).toBe(3000) // capped from 4000
  })

  it('applies jitter within bounds', () => {
    const policy: RetryPolicy = {
      max_attempts: 4,
      initial_interval: 'PT10S',
      backoff_coefficient: 1.0,
      max_interval: 'PT5M',
      jitter: true,
    }

    const schedule = computeRetrySchedule(policy, 'none', [1, 2, 3], 42)
    for (const attempt of schedule) {
      // Jitter should be within [0.5, 1.5) of capped delay
      expect(attempt.jitteredDelay).toBeGreaterThanOrEqual(attempt.cappedDelay * 0.5)
      expect(attempt.jitteredDelay).toBeLessThan(attempt.cappedDelay * 1.5)
    }
  })

  it('is deterministic with same seed', () => {
    const policy: RetryPolicy = { max_attempts: 4, jitter: true }
    const a = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 123)
    const b = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 123)
    expect(a).toEqual(b)
  })

  it('differs with different seeds', () => {
    const policy: RetryPolicy = { max_attempts: 4, jitter: true }
    const a = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 1)
    const b = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 2)
    expect(a[0]!.jitteredDelay).not.toBe(b[0]!.jitteredDelay)
  })

  it('stops when attempt does not fail', () => {
    const policy: RetryPolicy = { max_attempts: 5, jitter: false }
    // Only attempt 1 fails, attempt 2 succeeds
    const schedule = computeRetrySchedule(policy, 'exponential', [1], 42)
    expect(schedule).toHaveLength(1)
  })

  it('tracks cumulative time', () => {
    const policy: RetryPolicy = {
      max_attempts: 4,
      initial_interval: 'PT1S',
      backoff_coefficient: 2.0,
      jitter: false,
    }

    const schedule = computeRetrySchedule(policy, 'exponential', [1, 2, 3], 42)
    expect(schedule[0]!.cumulativeTime).toBe(1000)
    expect(schedule[1]!.cumulativeTime).toBe(3000) // 1000 + 2000
    expect(schedule[2]!.cumulativeTime).toBe(7000) // 1000 + 2000 + 4000
  })
})
