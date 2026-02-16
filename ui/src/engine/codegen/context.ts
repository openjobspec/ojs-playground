import type { CodeGenContext, CodegenLanguage, OJSJob } from '../types'

/**
 * Convert a dot-separated job type to PascalCase.
 * e.g., "email.send" -> "EmailSend"
 */
function toPascalCase(jobType: string): string {
  return jobType
    .split('.')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('')
}

/**
 * Convert a dot-separated job type to camelCase.
 * e.g., "email.send" -> "emailSend"
 */
function toCamelCase(jobType: string): string {
  const pascal = toPascalCase(jobType)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Convert a dot-separated job type to snake_case.
 * e.g., "email.send" -> "email_send"
 */
function toSnakeCase(jobType: string): string {
  return jobType.replace(/\./g, '_')
}

/**
 * Infer a simple type name from a JSON value for code generation.
 */
function inferType(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float'
  if (typeof value === 'boolean') return 'bool'
  if (Array.isArray(value)) return 'array'
  return 'object'
}

/**
 * Generate a parameter name from an array index and value.
 */
function argName(index: number, value: unknown): string {
  if (typeof value === 'string' && index === 0) return 'to'
  if (typeof value === 'string' && index === 1) return 'template'
  if (typeof value === 'string') return `arg${index}`
  if (typeof value === 'number') return `num${index}`
  if (typeof value === 'boolean') return `flag${index}`
  return `arg${index}`
}

/**
 * Build a CodeGenContext from a parsed job spec.
 */
export function buildContext(job: OJSJob, language: CodegenLanguage): CodeGenContext {
  const argsTyped = job.args.map((arg, i) => ({
    name: argName(i, arg),
    type: inferType(arg),
    value: arg,
  }))

  return {
    jobType: job.type,
    jobTypePascal: toPascalCase(job.type),
    jobTypeCamel: toCamelCase(job.type),
    jobTypeSnake: toSnakeCase(job.type),
    queue: job.queue,
    args: job.args,
    argsTyped,
    hasRetry: !!job.retry,
    retry: job.retry ?? {},
    hasMeta: !!job.meta && Object.keys(job.meta).length > 0,
    meta: job.meta ?? {},
    hasPriority: job.priority !== undefined && job.priority !== 0,
    priority: job.priority ?? 0,
    hasTimeout: job.timeout !== undefined && (typeof job.timeout === 'number' ? job.timeout > 0 : !!job.timeout.execution),
    timeout: typeof job.timeout === 'number' ? job.timeout : (job.timeout?.execution ?? 0),
    hasScheduledAt: !!job.scheduled_at,
    scheduledAt: job.scheduled_at ?? '',
    language,
  }
}
