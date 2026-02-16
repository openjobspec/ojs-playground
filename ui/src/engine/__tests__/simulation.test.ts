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

describe('new simulation scenarios', () => {
  it('timeout_execution: fails with TimeoutError, can retry', () => {
    const result = runSimulation(makeConfig({
      scenario: 'timeout_execution',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 3 } },
    }))
    const timeoutEvent = result.events.find((e) => e.error?.type === 'TimeoutError')
    expect(timeoutEvent).toBeDefined()
    expect(timeoutEvent!.label).toContain('Execution timeout')
  })

  it('timeout_heartbeat: fails with heartbeat timeout', () => {
    const result = runSimulation(makeConfig({
      scenario: 'timeout_heartbeat',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 2 } },
    }))
    const hbEvent = result.events.find((e) => e.label.includes('Heartbeat timeout'))
    expect(hbEvent).toBeDefined()
  })

  it('progress_tracking: emits progress events', () => {
    const result = runSimulation(makeConfig({
      scenario: 'progress_tracking',
      progressSteps: 4,
    }))
    expect(result.finalState).toBe('completed')
    const progressEvents = result.events.filter((e) => e.progress !== undefined)
    expect(progressEvents.length).toBe(4)
    expect(progressEvents[progressEvents.length - 1]!.progress).toBe(1)
  })

  it('dead_letter: exhausted job marked as dead-lettered', () => {
    const result = runSimulation(makeConfig({
      scenario: 'dead_letter',
      job: { ...DEFAULT_JOB, retry: { max_attempts: 2, on_exhaustion: 'dead_letter' } },
    }))
    expect(result.finalState).toBe('discarded')
    const dlEvent = result.events.find((e) => e.deadLettered)
    expect(dlEvent).toBeDefined()
    expect(dlEvent!.label).toContain('dead letter')
  })

  it('backpressure_reject: rejects when queue full', () => {
    const result = runSimulation(makeConfig({
      scenario: 'backpressure_reject',
      queueDepth: 100,
      queueMaxSize: 50,
    }))
    expect(result.finalState).toBe('discarded')
    const bpEvent = result.events.find((e) => e.backpressure === 'reject')
    expect(bpEvent).toBeDefined()
  })

  it('backpressure_reject: allows when queue has space', () => {
    const result = runSimulation(makeConfig({
      scenario: 'backpressure_reject',
      queueDepth: 10,
      queueMaxSize: 50,
    }))
    expect(result.finalState).toBe('completed')
  })

  it('workflow_chain: processes steps sequentially', () => {
    const result = runSimulation(makeConfig({
      scenario: 'workflow_chain',
      workflowSteps: ['step.a', 'step.b', 'step.c'],
    }))
    expect(result.finalState).toBe('completed')
    const stepEvents = result.events.filter((e) => e.workflowStep)
    expect(stepEvents.length).toBeGreaterThanOrEqual(3)
  })

  it('workflow_group: processes steps in parallel', () => {
    const result = runSimulation(makeConfig({
      scenario: 'workflow_group',
      workflowSteps: ['step.x', 'step.y'],
    }))
    expect(result.finalState).toBe('completed')
    const stepEvents = result.events.filter((e) => e.workflowStep)
    expect(stepEvents.length).toBe(2)
  })
})
