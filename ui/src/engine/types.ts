// ---- Job Lifecycle ----

export type JobState =
  | 'scheduled'
  | 'available'
  | 'pending'
  | 'active'
  | 'completed'
  | 'retryable'
  | 'cancelled'
  | 'discarded'

export type BackoffStrategy = 'none' | 'linear' | 'exponential' | 'polynomial'

// ---- OJS Job Envelope ----

export interface OJSError {
  type: string
  message: string
  backtrace?: string[]
}

export interface RetryPolicy {
  max_attempts?: number
  initial_interval?: string
  backoff_coefficient?: number
  max_interval?: string
  jitter?: boolean
  non_retryable_errors?: string[]
  on_exhaustion?: 'discard' | 'dead_letter'
}

export interface UniquePolicy {
  keys?: ('type' | 'queue' | 'args' | 'meta')[]
  args_keys?: string[]
  meta_keys?: string[]
  period?: string
  states?: JobState[]
  on_conflict?: 'reject' | 'replace' | 'replace_except_schedule' | 'ignore'
}

export interface CronPolicy {
  expression: string
  timezone?: string
  limit?: number
  paused?: boolean
}

export interface TimeoutPolicy {
  execution?: number
  heartbeat?: number
  heartbeat_grace?: number
  enqueue_ttl?: number
}

export interface ProgressUpdate {
  value: number
  message?: string
  checkpoint?: Record<string, unknown>
}

export interface RateLimitPolicy {
  key: string
  concurrency?: number
  rate?: { limit: number; period: string }
  throttle?: { limit: number; period: string }
  on_limit?: 'wait' | 'reschedule' | 'drop'
}

export interface QueueConfigPolicy {
  max_size?: number
  overflow_policy?: 'reject' | 'drop_oldest' | 'block'
  concurrency?: number
  rate_limit?: RateLimitPolicy
  default_timeout?: number
  default_retry?: RetryPolicy
  retention?: {
    completed?: string
    discarded?: string
    cancelled?: string
  }
  dead_letter_queue?: string
  dead_letter_ttl?: string
  allowed_job_types?: string[]
}

export interface MiddlewareEntry {
  name: string
  type: 'enqueue' | 'execution'
  enabled: boolean
  order: number
  description?: string
}

export interface BulkOperationResult {
  index: number
  status: 'created' | 'duplicate' | 'failed'
  error?: string
  jobId?: string
}

export interface OJSJob {
  specversion: string
  id: string
  type: string
  queue: string
  args: unknown[]
  meta?: Record<string, unknown>
  priority?: number
  timeout?: number | TimeoutPolicy
  scheduled_at?: string
  expires_at?: string
  retry?: RetryPolicy
  unique?: UniquePolicy
  cron?: CronPolicy
  rate_limit?: RateLimitPolicy
  progress?: ProgressUpdate
  schema?: string
  state?: JobState
  attempt?: number
  created_at?: string
  enqueued_at?: string
  started_at?: string
  completed_at?: string
  error?: OJSError
  result?: unknown
}

// ---- Simulation ----

export type SimulationScenario =
  | 'success_first_attempt'
  | 'success_after_retries'
  | 'exhausted'
  | 'cancelled'
  | 'non_retryable_error'
  | 'scheduled_then_success'
  | 'timeout_execution'
  | 'timeout_heartbeat'
  | 'progress_tracking'
  | 'dead_letter'
  | 'backpressure_reject'
  | 'workflow_chain'
  | 'workflow_group'
  | 'custom'

export interface SimulationConfig {
  job: OJSJob
  scenario: SimulationScenario
  strategy: BackoffStrategy
  failOnAttempts?: number[]
  cancelOnAttempt?: number
  nonRetryableErrorOnAttempt?: number
  timeoutOnAttempt?: number
  progressSteps?: number
  backpressureStrategy?: 'reject' | 'block' | 'drop_oldest'
  queueDepth?: number
  queueMaxSize?: number
  workflowSteps?: string[]
  seed?: number
}

export interface SimulationEvent {
  from: JobState | 'initial'
  to: JobState
  timestamp: number
  attempt: number
  delay?: number
  error?: OJSError
  label: string
  progress?: number
  progressMessage?: string
  deadLettered?: boolean
  backpressure?: 'reject' | 'block' | 'drop_oldest'
  workflowStep?: string
}

export interface SimulationResult {
  events: SimulationEvent[]
  finalState: JobState
  totalDuration: number
  totalAttempts: number
  retryDelays: number[]
  retrySchedule: RetryAttempt[]
}

export interface RetryAttempt {
  retryNumber: number
  rawDelay: number
  cappedDelay: number
  jitteredDelay: number
  finalDelay: number
  cumulativeTime: number
}

// ---- Validation ----

export interface ValidationError {
  path: string
  message: string
  keyword: string
  params?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// ---- Sharing ----

export interface ShareableState {
  spec: string
  editorMode?: 'json' | 'yaml'
  language?: CodegenLanguage
  scope?: 'enqueue' | 'worker' | 'full'
  scenario?: SimulationScenario
  strategy?: BackoffStrategy
}

// ---- Code Generation ----

export type CodegenLanguage = 'go' | 'javascript' | 'python' | 'ruby' | 'rust' | 'java'
export type CodegenScope = 'enqueue' | 'worker' | 'full'

export interface CodeGenContext {
  jobType: string
  jobTypePascal: string
  jobTypeCamel: string
  jobTypeSnake: string
  queue: string
  args: unknown[]
  argsTyped: { name: string; type: string; value: unknown }[]
  hasRetry: boolean
  retry: RetryPolicy
  hasMeta: boolean
  meta: Record<string, unknown>
  hasPriority: boolean
  priority: number
  hasTimeout: boolean
  timeout: number
  hasScheduledAt: boolean
  scheduledAt: string
  language: CodegenLanguage
}
