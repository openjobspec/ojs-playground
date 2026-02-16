import { describe, it, expect, beforeEach } from 'vitest'
import { simulateBulkEnqueue, clearIdempotencyCache } from '../bulk'

beforeEach(() => {
  clearIdempotencyCache()
})

describe('simulateBulkEnqueue', () => {
  it('enqueues valid jobs successfully', () => {
    const result = simulateBulkEnqueue({
      atomicity: 'partial',
      jobs: [
        { type: 'email.send', queue: 'default', args: ['user@example.com'] },
        { type: 'sms.send', queue: 'sms', args: ['+1234567890'] },
      ],
    })
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(result.items[0]!.status).toBe('created')
    expect(result.items[0]!.jobId).toBeDefined()
  })

  it('reports validation errors for invalid jobs', () => {
    const result = simulateBulkEnqueue({
      atomicity: 'partial',
      jobs: [
        { type: 'valid.job', args: ['ok'] },
        { type: '', args: ['missing type'] },
        { type: 'another.valid', args: ['fine'] },
      ],
    })
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.items[1]!.status).toBe('failed')
    expect(result.items[1]!.error).toContain('VALIDATION_ERROR')
  })

  it('rolls back all in atomic mode on any failure', () => {
    const result = simulateBulkEnqueue({
      atomicity: 'atomic',
      jobs: [
        { type: 'valid.job', args: ['ok'] },
        { type: '', args: [] }, // invalid
      ],
    })
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.items[0]!.error).toContain('ATOMIC_ROLLBACK')
  })

  it('rejects batch exceeding max size', () => {
    const jobs = Array.from({ length: 1001 }, () => ({ type: 'test', args: [] }))
    const result = simulateBulkEnqueue({ atomicity: 'partial', jobs })
    expect(result.failed).toBe(1001)
    expect(result.items[0]!.error).toContain('BATCH_TOO_LARGE')
  })

  it('caches results for idempotency key', () => {
    const request = {
      atomicity: 'partial' as const,
      idempotencyKey: 'test-key-1',
      jobs: [{ type: 'email.send', args: ['test'] }],
    }
    const first = simulateBulkEnqueue(request)
    const second = simulateBulkEnqueue(request)
    expect(first).toEqual(second)
    expect(first.items[0]!.jobId).toBe(second.items[0]!.jobId)
  })

  it('handles missing args as validation error', () => {
    const result = simulateBulkEnqueue({
      atomicity: 'partial',
      jobs: [{ type: 'test' }], // no args
    })
    expect(result.failed).toBe(1)
    expect(result.items[0]!.error).toContain('missing or invalid args')
  })
})
