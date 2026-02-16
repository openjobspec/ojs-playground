import { describe, it, expect } from 'vitest'
import {
  createRateLimitState,
  checkRateLimit,
  consumeRateLimit,
  releaseRateLimit,
  simulateRateLimitBatch,
} from '../ratelimit'
import type { RateLimitPolicy } from '../types'

describe('rate limiting', () => {
  it('allows when under concurrency limit', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 5, on_limit: 'wait' }
    const state = createRateLimitState(policy, 0)

    const result = checkRateLimit(state, policy, 0)
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('allow')
  })

  it('blocks when concurrency limit reached', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 2, on_limit: 'wait' }
    const state = createRateLimitState(policy, 0)

    consumeRateLimit(state)
    consumeRateLimit(state)

    const result = checkRateLimit(state, policy, 0)
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('wait')
    expect(result.reason).toContain('Concurrency limit')
  })

  it('releases concurrency slot', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 1, on_limit: 'wait' }
    const state = createRateLimitState(policy, 0)

    consumeRateLimit(state)
    expect(checkRateLimit(state, policy, 0).allowed).toBe(false)

    releaseRateLimit(state)
    expect(checkRateLimit(state, policy, 0).allowed).toBe(true)
  })

  it('enforces rate window limit', () => {
    const policy: RateLimitPolicy = { key: 'test', rate: { limit: 3, period: 'PT1M' }, on_limit: 'drop' }
    const state = createRateLimitState(policy, 0)

    consumeRateLimit(state)
    consumeRateLimit(state)
    consumeRateLimit(state)

    const result = checkRateLimit(state, policy, 1000)
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('drop')
    expect(result.reason).toContain('Rate limit')
  })

  it('resets rate window after period expires', () => {
    const policy: RateLimitPolicy = { key: 'test', rate: { limit: 2, period: 'PT1S' }, on_limit: 'wait' }
    const state = createRateLimitState(policy, 0)

    consumeRateLimit(state)
    consumeRateLimit(state)
    expect(checkRateLimit(state, policy, 500).allowed).toBe(false)

    // After 1 second window expires
    expect(checkRateLimit(state, policy, 1500).allowed).toBe(true)
  })

  it('uses drop action when on_limit is drop', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 0, on_limit: 'drop' }
    const state = createRateLimitState(policy, 0)

    const result = checkRateLimit(state, policy, 0)
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('drop')
  })

  it('uses reschedule action', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 0, on_limit: 'reschedule' }
    const state = createRateLimitState(policy, 0)

    const result = checkRateLimit(state, policy, 0)
    expect(result.action).toBe('reschedule')
  })

  it('simulateRateLimitBatch returns events for all jobs', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 3, on_limit: 'wait' }
    const events = simulateRateLimitBatch(policy, 10, 100)

    expect(events).toHaveLength(10)
    expect(events[0]!.action).toBe('allow')
  })

  it('simulateRateLimitBatch shows drops when concurrency exhausted', () => {
    const policy: RateLimitPolicy = { key: 'test', concurrency: 2, on_limit: 'drop' }
    const events = simulateRateLimitBatch(policy, 5, 50)

    const dropped = events.filter((e) => e.action === 'drop')
    expect(dropped.length).toBeGreaterThan(0)
  })
})
