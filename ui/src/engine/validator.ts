import Ajv2020 from 'ajv/dist/2020'
import type { ErrorObject } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import YAML from 'yaml'
import type { ValidationResult, ValidationError as VError } from './types'

import jobSchema from '../../public/schema/job.schema.json'
import retryPolicySchema from '../../public/schema/retry-policy.schema.json'
import uniquePolicySchema from '../../public/schema/unique-policy.schema.json'
import errorSchema from '../../public/schema/error.schema.json'

let cachedAjv: Ajv2020 | null = null

function getAjv(): Ajv2020 {
  if (cachedAjv) return cachedAjv

  const ajv = new Ajv2020({
    allErrors: true,
    verbose: true,
    strict: false,
  })
  addFormats(ajv)

  // Register schemas with their $id for $ref resolution
  ajv.addSchema(errorSchema)
  ajv.addSchema(retryPolicySchema)
  ajv.addSchema(uniquePolicySchema)
  ajv.addSchema(jobSchema)

  cachedAjv = ajv
  return ajv
}

/** Field descriptions for user-friendly error messages */
const FIELD_HINTS: Record<string, string> = {
  '/specversion': 'Must be "1.0.0-rc.1" — the current OJS spec version',
  '/id': 'Must be a valid UUIDv7 (e.g. 019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f)',
  '/type': 'Use dot-separated lowercase names (e.g. email.send, report.generate)',
  '/queue': 'Lowercase alphanumeric with hyphens/dots (e.g. default, high-priority)',
  '/args': 'Must be a JSON array of arguments for the job handler',
  '/retry/max_attempts': 'Integer ≥ 1 — how many times to retry on failure',
  '/retry/initial_interval': 'ISO 8601 duration (e.g. PT1S for 1 second, PT5M for 5 minutes)',
  '/retry/backoff_coefficient': 'Number ≥ 1 — multiplier between retry intervals',
  '/retry/max_interval': 'ISO 8601 duration — upper bound for retry delay',
  '/scheduled_at': 'ISO 8601 timestamp with timezone (e.g. 2026-03-15T09:30:00Z)',
  '/expires_at': 'ISO 8601 timestamp with timezone (e.g. 2026-03-15T18:00:00Z)',
  '/timeout': 'Integer ≥ 0 — max execution time in seconds (0 = no timeout)',
  '/priority': 'Integer — higher = higher priority (HIGH=10, NORMAL=0, LOW=-10)',
}

/**
 * Produce a user-friendly error message from an AJV error object.
 */
function humanizeValidationError(err: ErrorObject): string {
  const path = err.instancePath || '/'
  const base = err.message ?? 'Unknown error'

  // Required property missing
  if (err.keyword === 'required') {
    const field = (err.params as { missingProperty?: string }).missingProperty
    const hint = field ? FIELD_HINTS[`${path === '/' ? '' : path}/${field}`] : undefined
    return hint
      ? `Missing required field "${field}" — ${hint}`
      : `Missing required field "${field}"`
  }

  // Const mismatch (e.g. specversion)
  if (err.keyword === 'const') {
    const allowed = (err.params as { allowedValue?: unknown }).allowedValue
    return `Must be exactly ${JSON.stringify(allowed)}`
  }

  // Pattern mismatch
  if (err.keyword === 'pattern') {
    const hint = FIELD_HINTS[path]
    return hint ? `Invalid format — ${hint}` : `Invalid format: ${base}`
  }

  // Type mismatch
  if (err.keyword === 'type') {
    const expected = (err.params as { type?: string }).type
    const hint = FIELD_HINTS[path]
    return hint ? `Expected ${expected} — ${hint}` : `Expected ${expected}`
  }

  // Enum mismatch
  if (err.keyword === 'enum') {
    const values = (err.params as { allowedValues?: unknown[] }).allowedValues
    return `Must be one of: ${values?.map(v => JSON.stringify(v)).join(', ')}`
  }

  // Minimum / maximum
  if (err.keyword === 'minimum' || err.keyword === 'maximum') {
    const hint = FIELD_HINTS[path]
    return hint ? `${base} — ${hint}` : base
  }

  // Format errors
  if (err.keyword === 'format') {
    const hint = FIELD_HINTS[path]
    return hint ? `Invalid format — ${hint}` : `Invalid format: ${base}`
  }

  // Fallback: append hint if available
  const hint = FIELD_HINTS[path]
  return hint ? `${base} — ${hint}` : base
}

/**
 * Validate a parsed OJS job object against the JSON Schema.
 */
export function validateJob(data: unknown): ValidationResult {
  const ajv = getAjv()
  const validate = ajv.getSchema(
    'https://openjobspec.org/schemas/v1/job.json',
  )

  if (!validate) {
    return {
      valid: false,
      errors: [{ path: '', message: 'Schema not loaded', keyword: 'schema', params: {} }],
    }
  }

  const valid = validate(data)

  if (valid) {
    return { valid: true, errors: [] }
  }

  const errors: VError[] = (validate.errors ?? []).map((err) => ({
    path: err.instancePath || '/',
    message: humanizeValidationError(err),
    keyword: err.keyword,
    params: err.params as Record<string, unknown> | undefined,
  }))

  return { valid: false, errors }
}

/**
 * Validate a JSON string. Handles parse errors and schema validation.
 */
export function validateJobJSON(jsonString: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON'
    return {
      valid: false,
      errors: [{ path: '/', message: msg, keyword: 'parse', params: {} }],
    }
  }

  return validateJob(parsed)
}

/**
 * Validate a YAML string. Handles parse errors and schema validation.
 */
export function validateJobYAML(yamlString: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = YAML.parse(yamlString)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid YAML'
    return {
      valid: false,
      errors: [{ path: '/', message: msg, keyword: 'parse', params: {} }],
    }
  }

  return validateJob(parsed)
}

/**
 * Validate content based on the editor mode.
 */
export function validateJobContent(content: string, mode: 'json' | 'yaml'): ValidationResult {
  return mode === 'yaml' ? validateJobYAML(content) : validateJobJSON(content)
}

/**
 * Find the line number for a JSON path like "/retry/max_attempts" in source text.
 * Returns 1-based line number, or 1 if not found.
 */
export function findLineForPath(source: string, path: string): number {
  if (!path || path === '/') return 1

  const segments = path.split('/').filter(Boolean)
  const lines = source.split('\n')

  // Walk segments and find each key in order
  let searchFromLine = 0
  let lastFoundLine = 0

  for (const segment of segments) {
    // Try to match "key": or key: patterns
    const isArrayIndex = /^\d+$/.test(segment)
    let found = false

    for (let i = searchFromLine; i < lines.length; i++) {
      const line = lines[i]!
      if (isArrayIndex) {
        // For array indices, advance past array elements
        const idx = parseInt(segment, 10)
        let arrayCount = -1
        for (let j = searchFromLine; j < lines.length; j++) {
          const trimmed = lines[j]!.trim()
          // Count non-empty, non-bracket lines as array elements
          if (trimmed && !trimmed.startsWith(']') && !trimmed.startsWith('[')) {
            arrayCount++
            if (arrayCount === idx) {
              lastFoundLine = j
              searchFromLine = j + 1
              found = true
              break
            }
          }
        }
        break
      }

      // Match JSON key pattern: "segment" :
      const keyPattern = new RegExp(`["']?${escapeRegExp(segment)}["']?\\s*:`)
      if (keyPattern.test(line)) {
        lastFoundLine = i
        searchFromLine = i + 1
        found = true
        break
      }
    }

    if (!found) break
  }

  return lastFoundLine + 1 // 1-based
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
