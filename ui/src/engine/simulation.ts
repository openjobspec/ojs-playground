import type {
  JobState,
  SimulationConfig,
  SimulationEvent,
  SimulationResult,
  OJSError,
} from './types'
import { TERMINAL_STATES } from './constants'
import { computeRetrySchedule, mergeRetryPolicy } from './retry'
import { parseDuration } from './duration'

const PROCESSING_TIME = 500 // simulated processing time in ms
const SCHEDULE_DELAY = 2000 // simulated schedule wait in ms
const FETCH_DELAY = 100 // simulated fetch/claim delay in ms

/**
 * Determine which attempts should fail based on the scenario.
 */
function getFailingAttempts(config: SimulationConfig): number[] {
  const policy = mergeRetryPolicy(config.job.retry)

  switch (config.scenario) {
    case 'success_first_attempt':
    case 'progress_tracking':
    case 'workflow_chain':
    case 'workflow_group':
      return []

    case 'success_after_retries': {
      // Fail on all attempts except the last one
      const lastAttempt = Math.min(policy.max_attempts, 3) // default: succeed on attempt 3
      const failures: number[] = []
      for (let i = 1; i < lastAttempt; i++) {
        failures.push(i)
      }
      return failures
    }

    case 'exhausted':
    case 'dead_letter': {
      // Fail on all attempts
      const all: number[] = []
      for (let i = 1; i <= policy.max_attempts; i++) {
        all.push(i)
      }
      return all
    }

    case 'cancelled':
      return [] // will be handled by cancel logic

    case 'non_retryable_error':
      return [1] // first attempt hits non-retryable error

    case 'scheduled_then_success':
      return []

    case 'timeout_execution':
    case 'timeout_heartbeat':
      return [config.timeoutOnAttempt ?? 1]

    case 'backpressure_reject':
      return []

    case 'custom':
      return config.failOnAttempts ?? [1]
  }
}

function makeError(attempt: number, nonRetryable: boolean, timeout?: boolean): OJSError {
  if (timeout) {
    return {
      type: 'TimeoutError',
      message: `Execution timed out on attempt ${attempt}`,
    }
  }
  if (nonRetryable) {
    return {
      type: 'ValidationError',
      message: `Non-retryable error on attempt ${attempt}: invalid input`,
    }
  }
  return {
    type: 'RuntimeError',
    message: `Transient failure on attempt ${attempt}: connection timeout`,
  }
}

const PROGRESS_INTERVAL = 200 // ms between progress updates

/**
 * Run a deterministic simulation of the OJS job lifecycle.
 */
export function runSimulation(config: SimulationConfig): SimulationResult {
  const events: SimulationEvent[] = []
  const policy = mergeRetryPolicy(config.job.retry)
  const failingAttempts = getFailingAttempts(config)
  const failSet = new Set(failingAttempts)

  const retrySchedule = computeRetrySchedule(
    config.job.retry,
    config.strategy,
    failingAttempts,
    config.seed ?? 42,
  )

  let time = 0
  let attempt = 0
  let currentState = 'initial' as JobState | 'initial'
  let retryIndex = 0

  function addEvent(to: JobState, label: string, delay?: number, error?: OJSError, extra?: Partial<SimulationEvent>) {
    events.push({
      from: currentState,
      to,
      timestamp: time,
      attempt,
      delay,
      error,
      label,
      ...extra,
    })
    currentState = to
  }

  // Backpressure check
  if (config.scenario === 'backpressure_reject') {
    const depth = config.queueDepth ?? 100
    const maxSize = config.queueMaxSize ?? 50
    if (depth >= maxSize) {
      addEvent('discarded', `Queue full (${depth}/${maxSize}) — job rejected`, undefined, {
        type: 'BackpressureError',
        message: `Queue depth ${depth} exceeds max ${maxSize}`,
      }, { backpressure: config.backpressureStrategy ?? 'reject' })
      return {
        events,
        finalState: currentState as JobState,
        totalDuration: time,
        totalAttempts: attempt,
        retryDelays: [],
        retrySchedule: [],
      }
    }
  }

  // Step 1: Initial transition
  const isScheduled = config.scenario === 'scheduled_then_success' || !!config.job.scheduled_at

  if (isScheduled) {
    addEvent('scheduled', 'Job created with scheduled_at')
    time += SCHEDULE_DELAY
    addEvent('available', 'Scheduled time arrives')
  } else {
    addEvent('available', 'Job enqueued')
  }

  // Workflow scenarios
  if (config.scenario === 'workflow_chain' || config.scenario === 'workflow_group') {
    const steps = config.workflowSteps ?? (config.job.meta?.steps as string[] | undefined) ?? ['step.1', 'step.2', 'step.3']
    const isChain = config.scenario === 'workflow_chain'

    if (isChain) {
      for (const step of steps) {
        time += FETCH_DELAY
        attempt++
        addEvent('active', `Chain step: ${step}`, undefined, undefined, { workflowStep: step })
        time += PROCESSING_TIME
        if (step !== steps[steps.length - 1]) {
          addEvent('available', `Step ${step} completed, next step queued`, undefined, undefined, { workflowStep: step })
        }
      }
      addEvent('completed', `Chain workflow completed (${steps.length} steps)`)
    } else {
      time += FETCH_DELAY
      attempt++
      addEvent('active', `Group: fan-out ${steps.length} parallel steps`)

      for (const step of steps) {
        time += PROCESSING_TIME / steps.length
        events.push({
          from: 'active',
          to: 'active',
          timestamp: time,
          attempt,
          label: `Group step: ${step} completed`,
          workflowStep: step,
          progress: (steps.indexOf(step) + 1) / steps.length,
        })
      }

      addEvent('completed', `Group workflow completed (${steps.length} parallel steps)`)
    }

    return {
      events,
      finalState: currentState as JobState,
      totalDuration: time,
      totalAttempts: attempt,
      retryDelays: [],
      retrySchedule: [],
    }
  }

  // Step 2: Processing loop
  while (!TERMINAL_STATES.has(currentState as JobState)) {
    if (currentState === 'available') {
      time += FETCH_DELAY
      addEvent('active', 'Worker claims job')
      attempt++
    }

    if (currentState === 'active') {
      // Progress tracking scenario
      if (config.scenario === 'progress_tracking') {
        const totalSteps = config.progressSteps ?? 5
        for (let step = 1; step <= totalSteps; step++) {
          time += PROGRESS_INTERVAL
          const progress = step / totalSteps
          events.push({
            from: 'active',
            to: 'active',
            timestamp: time,
            attempt,
            label: `Progress: ${Math.round(progress * 100)}%`,
            progress,
            progressMessage: step === totalSteps ? 'Processing complete' : `Processing step ${step}/${totalSteps}`,
          })
        }
        addEvent('completed', `Job completed with progress tracking (${totalSteps} steps)`)
        break
      }

      time += PROCESSING_TIME

      // Check for cancellation
      if (
        config.scenario === 'cancelled' ||
        (config.cancelOnAttempt !== undefined && config.cancelOnAttempt === attempt)
      ) {
        addEvent('cancelled', `Job cancelled during attempt ${attempt}`)
        break
      }

      // Check for non-retryable error
      if (
        (config.scenario === 'non_retryable_error' && attempt === (config.nonRetryableErrorOnAttempt ?? 1)) ||
        (config.scenario !== 'non_retryable_error' && config.nonRetryableErrorOnAttempt === attempt)
      ) {
        const error = makeError(attempt, true)
        addEvent('discarded', `Non-retryable error on attempt ${attempt}`, undefined, error)
        break
      }

      // Check for timeout
      if (
        (config.scenario === 'timeout_execution' || config.scenario === 'timeout_heartbeat') &&
        attempt === (config.timeoutOnAttempt ?? 1)
      ) {
        const error = makeError(attempt, false, true)
        const label = config.scenario === 'timeout_heartbeat'
          ? `Heartbeat timeout on attempt ${attempt}`
          : `Execution timeout on attempt ${attempt}`

        if (attempt < policy.max_attempts) {
          addEvent('retryable', label, undefined, error)
          const schedule = retrySchedule[retryIndex]
          if (schedule) {
            time += schedule.finalDelay
            retryIndex++
          } else {
            time += parseDuration(policy.initial_interval)
          }
          addEvent('available', 'Backoff delay expires', retrySchedule[retryIndex - 1]?.finalDelay)
        } else {
          addEvent('discarded', `${label} (retries exhausted)`, undefined, error)
          break
        }
        continue
      }

      // Check if this attempt fails
      if (failSet.has(attempt)) {
        const error = makeError(attempt, false)

        // Check if retries remain
        if (attempt < policy.max_attempts) {
          addEvent('retryable', `Attempt ${attempt} failed (retries remain)`, undefined, error)

          // Backoff delay
          const schedule = retrySchedule[retryIndex]
          if (schedule) {
            time += schedule.finalDelay
            retryIndex++
          } else {
            time += parseDuration(policy.initial_interval)
          }

          addEvent('available', `Backoff delay expires`, retrySchedule[retryIndex - 1]?.finalDelay)
        } else {
          // Exhausted — dead letter or discard
          const onExhaustion = config.job.retry?.on_exhaustion ?? 'discard'
          if (config.scenario === 'dead_letter' || onExhaustion === 'dead_letter') {
            addEvent('discarded', `Attempt ${attempt} failed — moved to dead letter queue`, undefined, error, { deadLettered: true })
          } else {
            addEvent('discarded', `Attempt ${attempt} failed (retries exhausted)`, undefined, error)
          }
          break
        }
      } else {
        // Success
        addEvent('completed', `Attempt ${attempt} succeeded`)
        break
      }
    }
  }

  const retryDelays = retrySchedule.map((s) => s.finalDelay)

  return {
    events,
    finalState: currentState as JobState,
    totalDuration: time,
    totalAttempts: attempt,
    retryDelays,
    retrySchedule,
  }
}

/**
 * Create a step-through simulation iterator.
 */
export function createSimulationStepper(config: SimulationConfig) {
  const result = runSimulation(config)
  let index = 0

  return {
    hasNext(): boolean {
      return index < result.events.length
    },

    next(): SimulationEvent | null {
      if (index >= result.events.length) return null
      return result.events[index++] ?? null
    },

    reset(): void {
      index = 0
    },

    peek(): SimulationEvent | null {
      return result.events[index] ?? null
    },

    get currentIndex(): number {
      return index
    },

    get totalSteps(): number {
      return result.events.length
    },

    get result(): SimulationResult {
      return result
    },
  }
}
