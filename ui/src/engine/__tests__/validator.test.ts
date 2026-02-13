import { describe, it, expect } from 'vitest'
import { validateJob, validateJobJSON } from '../validator'

const validJob = {
  specversion: '1.0.0-rc.1',
  id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  type: 'email.send',
  queue: 'default',
  args: ['user@example.com', 'welcome'],
}

describe('validateJob', () => {
  it('validates a minimal valid job', () => {
    const result = validateJob(validJob)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('validates a job with all optional fields', () => {
    const result = validateJob({
      ...validJob,
      meta: { trace_id: 'abc' },
      priority: 10,
      timeout: 30,
      retry: {
        max_attempts: 5,
        initial_interval: 'PT1S',
        backoff_coefficient: 2.0,
        max_interval: 'PT5M',
        jitter: true,
      },
    })
    expect(result.valid).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = validateJob({ specversion: '1.0.0-rc.1' })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects invalid job type format', () => {
    const result = validateJob({
      ...validJob,
      type: 'InvalidType', // must be lowercase dot-separated
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('type'))).toBe(true)
  })

  it('rejects invalid id format', () => {
    const result = validateJob({
      ...validJob,
      id: 'not-a-uuid-v7',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects wrong specversion', () => {
    const result = validateJob({
      ...validJob,
      specversion: '2.0.0',
    })
    expect(result.valid).toBe(false)
  })

  it('rejects non-array args', () => {
    const result = validateJob({
      ...validJob,
      args: 'not-an-array',
    })
    expect(result.valid).toBe(false)
  })

  it('validates retry policy fields', () => {
    const result = validateJob({
      ...validJob,
      retry: {
        max_attempts: -1, // invalid: must be >= 0
      },
    })
    expect(result.valid).toBe(false)
  })
})

describe('validateJobJSON', () => {
  it('validates valid JSON string', () => {
    const result = validateJobJSON(JSON.stringify(validJob))
    expect(result.valid).toBe(true)
  })

  it('rejects invalid JSON syntax', () => {
    const result = validateJobJSON('{ invalid json }')
    expect(result.valid).toBe(false)
    expect(result.errors[0]!.keyword).toBe('parse')
  })

  it('rejects empty string', () => {
    const result = validateJobJSON('')
    expect(result.valid).toBe(false)
  })
})
