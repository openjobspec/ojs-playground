/**
 * Rate limiting simulation engine.
 *
 * Implements three rate limit strategies from ojs-rate-limiting.md:
 * - Concurrency: max active jobs at once
 * - Rate (window): max job starts per time period
 * - Throttle: even spacing between job starts
 */

import type { RateLimitPolicy } from './types'
import { parseDuration } from './duration'

export interface RateLimitState {
  key: string
  concurrency: { active: number; limit: number }
  rate: { currentCount: number; limit: number; windowMs: number; windowResetsAt: number }
  throttle: { limit: number; periodMs: number; nextAllowedAt: number }
  waitingCount: number
}

export interface RateLimitCheckResult {
  allowed: boolean
  reason?: string
  waitMs?: number
  action: 'allow' | 'wait' | 'reschedule' | 'drop'
}

export function createRateLimitState(policy: RateLimitPolicy, now: number = Date.now()): RateLimitState {
  const rateWindowMs = policy.rate ? parseDuration(policy.rate.period) : 60000
  const throttlePeriodMs = policy.throttle ? parseDuration(policy.throttle.period) : 1000

  return {
    key: policy.key,
    concurrency: {
      active: 0,
      limit: policy.concurrency ?? Infinity,
    },
    rate: {
      currentCount: 0,
      limit: policy.rate?.limit ?? Infinity,
      windowMs: rateWindowMs,
      windowResetsAt: now + rateWindowMs,
    },
    throttle: {
      limit: policy.throttle?.limit ?? Infinity,
      periodMs: throttlePeriodMs,
      nextAllowedAt: now,
    },
    waitingCount: 0,
  }
}

export function checkRateLimit(
  state: RateLimitState,
  policy: RateLimitPolicy,
  now: number = Date.now(),
): RateLimitCheckResult {
  const onLimit = policy.on_limit ?? 'wait'

  // Reset window if expired
  if (now >= state.rate.windowResetsAt) {
    state.rate.currentCount = 0
    state.rate.windowResetsAt = now + state.rate.windowMs
  }

  // Check concurrency
  if (state.concurrency.active >= state.concurrency.limit) {
    return {
      allowed: false,
      reason: `Concurrency limit reached (${state.concurrency.active}/${state.concurrency.limit})`,
      action: onLimit,
    }
  }

  // Check rate window
  if (state.rate.currentCount >= state.rate.limit) {
    const waitMs = state.rate.windowResetsAt - now
    return {
      allowed: false,
      reason: `Rate limit reached (${state.rate.currentCount}/${state.rate.limit} per window)`,
      waitMs,
      action: onLimit,
    }
  }

  // Check throttle
  if (now < state.throttle.nextAllowedAt) {
    const waitMs = state.throttle.nextAllowedAt - now
    return {
      allowed: false,
      reason: `Throttled (next allowed in ${waitMs}ms)`,
      waitMs,
      action: onLimit,
    }
  }

  // All checks passed
  return { allowed: true, action: 'allow' }
}

export function consumeRateLimit(state: RateLimitState): void {
  state.concurrency.active++
  state.rate.currentCount++
  if (state.throttle.limit < Infinity) {
    state.throttle.nextAllowedAt = Date.now() + state.throttle.periodMs / state.throttle.limit
  }
}

export function releaseRateLimit(state: RateLimitState): void {
  state.concurrency.active = Math.max(0, state.concurrency.active - 1)
}

/**
 * Run a batch simulation showing rate limit effects on N jobs.
 */
export interface RateLimitSimEvent {
  jobIndex: number
  time: number
  action: 'allow' | 'wait' | 'reschedule' | 'drop'
  reason?: string
  waitMs?: number
}

export function simulateRateLimitBatch(
  policy: RateLimitPolicy,
  jobCount: number,
  intervalMs: number = 100,
): RateLimitSimEvent[] {
  const events: RateLimitSimEvent[] = []
  const state = createRateLimitState(policy, 0)
  let time = 0

  for (let i = 0; i < jobCount; i++) {
    const result = checkRateLimit(state, policy, time)

    events.push({
      jobIndex: i,
      time,
      action: result.action,
      reason: result.reason,
      waitMs: result.waitMs,
    })

    if (result.allowed) {
      consumeRateLimit(state)
      // Simulate job completing after some time to free concurrency
      if (i > 2 && state.concurrency.active > 0) {
        releaseRateLimit(state)
      }
    }

    time += intervalMs
  }

  return events
}

export const RATE_LIMIT_PRESETS: { label: string; policy: RateLimitPolicy }[] = [
  {
    label: 'API Gateway (10 req/s)',
    policy: { key: 'api-gateway', rate: { limit: 10, period: 'PT1S' }, on_limit: 'wait' },
  },
  {
    label: 'Stripe API (25 concur.)',
    policy: { key: 'stripe-api', concurrency: 25, on_limit: 'wait' },
  },
  {
    label: 'Email (100/min, drop)',
    policy: { key: 'email-provider', rate: { limit: 100, period: 'PT1M' }, on_limit: 'drop' },
  },
  {
    label: 'Webhook (5 concur., 1/s throttle)',
    policy: { key: 'webhook-delivery', concurrency: 5, throttle: { limit: 1, period: 'PT1S' }, on_limit: 'reschedule' },
  },
  {
    label: 'Batch import (3 concur.)',
    policy: { key: 'batch-import', concurrency: 3, on_limit: 'wait' },
  },
]
