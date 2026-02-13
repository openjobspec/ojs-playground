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

export interface OJSJob {
  specversion: string
  id: string
  type: string
  queue: string
  args: unknown[]
  meta?: Record<string, unknown>
  priority?: number
  timeout?: number
  scheduled_at?: string
  expires_at?: string
  retry?: RetryPolicy
  unique?: UniquePolicy
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
  | 'custom'

export interface SimulationConfig {
  job: OJSJob
  scenario: SimulationScenario
  strategy: BackoffStrategy
  failOnAttempts?: number[]
  cancelOnAttempt?: number
  nonRetryableErrorOnAttempt?: number
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
}

export interface SimulationResult {
  events: SimulationEvent[]
  finalState: JobState
  totalDuration: number
  totalAttempts: number
  retryDelays: number[]
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
