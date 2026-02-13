import type { JobState, OJSJob, RetryPolicy } from './types'

export interface StateTransition {
  from: JobState | 'initial'
  to: JobState
  trigger: string
  description: string
}

export const VALID_TRANSITIONS: StateTransition[] = [
  { from: 'initial', to: 'scheduled', trigger: 'PUSH', description: 'Job created with future scheduled_at' },
  { from: 'initial', to: 'available', trigger: 'PUSH', description: 'Job created without scheduled_at' },
  { from: 'initial', to: 'pending', trigger: 'PUSH', description: 'Job created with pending flag' },
  { from: 'scheduled', to: 'available', trigger: 'SCHEDULE', description: 'Scheduled time arrives' },
  { from: 'available', to: 'active', trigger: 'FETCH', description: 'Worker claims job' },
  { from: 'pending', to: 'available', trigger: 'ACTIVATE', description: 'External activation' },
  { from: 'active', to: 'completed', trigger: 'ACK', description: 'Handler succeeded' },
  { from: 'active', to: 'retryable', trigger: 'FAIL', description: 'Handler failed, retries remain' },
  { from: 'active', to: 'cancelled', trigger: 'CANCEL', description: 'Job cancelled during execution' },
  { from: 'active', to: 'discarded', trigger: 'FAIL', description: 'Handler failed, no retries remain' },
  { from: 'retryable', to: 'available', trigger: 'RETRY', description: 'Backoff delay expires' },
  { from: 'discarded', to: 'available', trigger: 'MANUAL_RETRY', description: 'Manual retry from dead letter' },
]

export const TERMINAL_STATES: ReadonlySet<JobState> = new Set([
  'completed',
  'cancelled',
  'discarded',
])

export const ALL_STATES: readonly JobState[] = [
  'scheduled',
  'available',
  'pending',
  'active',
  'completed',
  'retryable',
  'cancelled',
  'discarded',
]

export const STATE_COLORS: Record<JobState, string> = {
  scheduled: 'var(--color-ojs-scheduled)',
  available: 'var(--color-ojs-available)',
  pending: 'var(--color-ojs-pending)',
  active: 'var(--color-ojs-active)',
  completed: 'var(--color-ojs-completed)',
  retryable: 'var(--color-ojs-retryable)',
  cancelled: 'var(--color-ojs-cancelled)',
  discarded: 'var(--color-ojs-discarded)',
}

export const STATE_LABELS: Record<JobState, string> = {
  scheduled: 'Scheduled',
  available: 'Available',
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  retryable: 'Retryable',
  cancelled: 'Cancelled',
  discarded: 'Discarded',
}

export const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  max_attempts: 3,
  initial_interval: 'PT1S',
  backoff_coefficient: 2.0,
  max_interval: 'PT5M',
  jitter: true,
  non_retryable_errors: [],
  on_exhaustion: 'discard',
}

export const DEFAULT_JOB: OJSJob = {
  specversion: '1.0.0-rc.1',
  id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  type: 'email.send',
  queue: 'default',
  args: ['user@example.com', 'welcome'],
  meta: {
    trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
    user_id: 'usr_12345',
  },
  priority: 0,
  timeout: 30,
  retry: {
    max_attempts: 3,
    initial_interval: 'PT1S',
    backoff_coefficient: 2.0,
    max_interval: 'PT5M',
    jitter: true,
  },
}

export const DEFAULT_JOB_JSON = JSON.stringify(DEFAULT_JOB, null, 2)
