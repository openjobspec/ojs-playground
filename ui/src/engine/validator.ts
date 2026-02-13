import Ajv2020 from 'ajv/dist/2020'
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
    message: err.message ?? 'Unknown error',
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
