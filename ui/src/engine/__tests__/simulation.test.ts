import { describe, it, expect } from 'vitest'
import { runSimulation, createSimulationStepper } from '../simulation'
import type { SimulationConfig } from '../types'
import { DEFAULT_JOB } from '../constants'

function makeConfig(overrides: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    job: { ...DEFAULT_JOB },
    scenario: 'success_first_attempt',
    strategy: 'exponential',
    seed: 42,
    ...overrides,
  }
}

describe('runSimulation', () => {
  it('success_first_attempt: available -> active -> completed', () => {
    const result = runSimulation(makeConfig({ scenario: 'success_first_attempt' }))
    expect(result.finalState).toBe('completed')
    expect(result.totalAttempts).toBe(1)

    const states = result.events.map((e) => e.to)
    expect(states).toEqual(['available', 'active', 'completed'])
  })

  it('success_after_retries: includes retryable -> available loop', () => {
    const result = runSimulation(makeConfig({
      scenario: 'success_after_retries',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 3 } },
    }))
    expect(result.finalState).toBe('completed')
    expect(result.totalAttempts).toBeGreaterThan(1)

    const states = result.events.map((e) => e.to)
    expect(states).toContain('retryable')
    expect(states[states.length - 1]).toBe('completed')
  })

  it('exhausted: all attempts fail, ends in discarded', () => {
    const result = runSimulation(makeConfig({
      scenario: 'exhausted',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 3 } },
    }))
    expect(result.finalState).toBe('discarded')
    expect(result.totalAttempts).toBe(3)
  })

  it('cancelled: ends in cancelled state', () => {
    const result = runSimulation(makeConfig({ scenario: 'cancelled' }))
    expect(result.finalState).toBe('cancelled')
  })

  it('non_retryable_error: immediately discarded', () => {
    const result = runSimulation(makeConfig({ scenario: 'non_retryable_error' }))
    expect(result.finalState).toBe('discarded')
    expect(result.totalAttempts).toBe(1)

    const lastEvent = result.events[result.events.length - 1]!
    expect(lastEvent.error?.type).toBe('ValidationError')
  })

  it('scheduled_then_success: scheduled -> available -> active -> completed', () => {
    const result = runSimulation(makeConfig({ scenario: 'scheduled_then_success' }))
    expect(result.finalState).toBe('completed')

    const states = result.events.map((e) => e.to)
    expect(states[0]).toBe('scheduled')
    expect(states[1]).toBe('available')
    expect(states).toContain('completed')
  })

  it('events have increasing timestamps', () => {
    const result = runSimulation(makeConfig({ scenario: 'success_after_retries' }))
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.timestamp).toBeGreaterThanOrEqual(result.events[i - 1]!.timestamp)
    }
  })

  it('custom scenario: fail on specific attempts', () => {
    const result = runSimulation(makeConfig({
      scenario: 'custom',
      failOnAttempts: [1, 2],
      job: { ...DEFAULT_JOB, retry: { max_attempts: 4 } },
    }))
    expect(result.finalState).toBe('completed')
    expect(result.totalAttempts).toBe(3) // fail 1, fail 2, success 3
  })

  it('retry delays are populated for retry scenarios', () => {
    const result = runSimulation(makeConfig({
      scenario: 'exhausted',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 3, jitter: false } },
    }))
    expect(result.retryDelays.length).toBeGreaterThan(0)
  })

  it('is deterministic with same seed', () => {
    const a = runSimulation(makeConfig({ scenario: 'success_after_retries', seed: 42 }))
    const b = runSimulation(makeConfig({ scenario: 'success_after_retries', seed: 42 }))
    expect(a.events).toEqual(b.events)
    expect(a.totalDuration).toBe(b.totalDuration)
  })
})

describe('createSimulationStepper', () => {
  it('steps through events one at a time', () => {
    const stepper = createSimulationStepper(makeConfig())
    expect(stepper.hasNext()).toBe(true)

    const first = stepper.next()
    expect(first).not.toBeNull()
    expect(first!.to).toBe('available')
  })

  it('returns null when exhausted', () => {
    const stepper = createSimulationStepper(makeConfig())
    while (stepper.hasNext()) stepper.next()
    expect(stepper.next()).toBeNull()
  })

  it('reset returns to beginning', () => {
    const stepper = createSimulationStepper(makeConfig())
    stepper.next()
    stepper.next()
    stepper.reset()
    expect(stepper.currentIndex).toBe(0)
  })

  it('peek does not advance', () => {
    const stepper = createSimulationStepper(makeConfig())
    const peeked = stepper.peek()
    const stepped = stepper.next()
    expect(peeked).toEqual(stepped)
  })

  it('totalSteps matches event count', () => {
    const stepper = createSimulationStepper(makeConfig())
    expect(stepper.totalSteps).toBe(stepper.result.events.length)
  })
})
