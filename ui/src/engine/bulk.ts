/**
 * Bulk operations engine.
 *
 * Per ojs-bulk-operations.md:
 * - Batch enqueue with atomic/partial atomicity
 * - Bulk cancel, retry, delete
 * - Idempotency keys for deduplication
 * - Per-item result tracking
 */

import type { OJSJob, BulkOperationResult } from './types'

export type BulkAtomicity = 'atomic' | 'partial'

export interface BulkEnqueueRequest {
  atomicity: BulkAtomicity
  idempotencyKey?: string
  jobs: Partial<OJSJob>[]
}

export interface BulkEnqueueResponse {
  total: number
  succeeded: number
  failed: number
  items: BulkOperationResult[]
}

const seenIdempotencyKeys = new Map<string, BulkEnqueueResponse>()
const MAX_BATCH_SIZE = 1000

function generateJobId(): string {
  return `019${Date.now().toString(16).slice(-8)}-${Math.random().toString(16).slice(2, 6)}-7000-8000-${Math.random().toString(16).slice(2, 14)}`
}

function validateJob(job: Partial<OJSJob>, index: number): BulkOperationResult {
  if (!job.type || typeof job.type !== 'string') {
    return { index, status: 'failed', error: 'VALIDATION_ERROR: missing or invalid type' }
  }
  if (!job.args || !Array.isArray(job.args)) {
    return { index, status: 'failed', error: 'VALIDATION_ERROR: missing or invalid args' }
  }
  if (job.queue && typeof job.queue === 'string' && new TextEncoder().encode(job.queue).length > 255) {
    return { index, status: 'failed', error: 'VALIDATION_ERROR: queue name exceeds 255 bytes' }
  }
  if (new TextEncoder().encode(job.type).length > 255) {
    return { index, status: 'failed', error: 'VALIDATION_ERROR: type name exceeds 255 bytes' }
  }
  return { index, status: 'created', jobId: generateJobId() }
}

export function simulateBulkEnqueue(request: BulkEnqueueRequest): BulkEnqueueResponse {
  // Idempotency check
  if (request.idempotencyKey) {
    const cached = seenIdempotencyKeys.get(request.idempotencyKey)
    if (cached) return cached
  }

  // Batch size check
  if (request.jobs.length > MAX_BATCH_SIZE) {
    return {
      total: request.jobs.length,
      succeeded: 0,
      failed: request.jobs.length,
      items: [{ index: 0, status: 'failed', error: `BATCH_TOO_LARGE: max ${MAX_BATCH_SIZE} items` }],
    }
  }

  const items: BulkOperationResult[] = request.jobs.map((job, i) => validateJob(job, i))

  if (request.atomicity === 'atomic') {
    const hasFailure = items.some((item) => item.status === 'failed')
    if (hasFailure) {
      const response: BulkEnqueueResponse = {
        total: request.jobs.length,
        succeeded: 0,
        failed: request.jobs.length,
        items: items.map((item) => ({
          ...item,
          status: 'failed' as const,
          error: item.error ?? 'ATOMIC_ROLLBACK: batch rolled back due to other failures',
        })),
      }
      return response
    }
  }

  const succeeded = items.filter((i) => i.status === 'created').length
  const failed = items.filter((i) => i.status === 'failed').length

  const response: BulkEnqueueResponse = { total: request.jobs.length, succeeded, failed, items }

  // Cache for idempotency
  if (request.idempotencyKey) {
    seenIdempotencyKeys.set(request.idempotencyKey, response)
  }

  return response
}

export function clearIdempotencyCache(): void {
  seenIdempotencyKeys.clear()
}
