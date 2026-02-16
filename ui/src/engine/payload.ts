/**
 * Payload size calculation and limit validation.
 *
 * Per ojs-payload-limits.md:
 * - Envelope total: MUST >= 1 MB, SHOULD >= 10 MB
 * - Meta field: MUST NOT exceed 64 KB
 * - Queue name: MUST NOT exceed 255 bytes
 * - Job type: MUST NOT exceed 255 bytes
 * - Size measured as UTF-8 encoded JSON byte length
 */

export interface PayloadLimits {
  maxEnvelopeBytes: number
  maxMetaBytes: number
  maxQueueNameBytes: number
  maxJobTypeBytes: number
}

export const DEFAULT_PAYLOAD_LIMITS: PayloadLimits = {
  maxEnvelopeBytes: 10 * 1024 * 1024, // 10 MB
  maxMetaBytes: 64 * 1024,            // 64 KB
  maxQueueNameBytes: 255,
  maxJobTypeBytes: 255,
}

export interface PayloadSizeResult {
  totalBytes: number
  metaBytes: number
  queueNameBytes: number
  jobTypeBytes: number
  violations: PayloadViolation[]
}

export interface PayloadViolation {
  field: string
  currentBytes: number
  limitBytes: number
  severity: 'error' | 'warning'
}

function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function checkPayloadSize(
  content: string,
  limits: PayloadLimits = DEFAULT_PAYLOAD_LIMITS,
): PayloadSizeResult {
  const totalBytes = utf8ByteLength(content)
  const violations: PayloadViolation[] = []

  let metaBytes = 0
  let queueNameBytes = 0
  let jobTypeBytes = 0

  try {
    const parsed = JSON.parse(content)
    if (parsed.meta) {
      metaBytes = utf8ByteLength(JSON.stringify(parsed.meta))
    }
    if (parsed.queue) {
      queueNameBytes = utf8ByteLength(String(parsed.queue))
    }
    if (parsed.type) {
      jobTypeBytes = utf8ByteLength(String(parsed.type))
    }
  } catch {
    // Can't parse, just measure total
  }

  if (totalBytes > limits.maxEnvelopeBytes) {
    violations.push({
      field: 'envelope',
      currentBytes: totalBytes,
      limitBytes: limits.maxEnvelopeBytes,
      severity: 'error',
    })
  } else if (totalBytes > limits.maxEnvelopeBytes * 0.8) {
    violations.push({
      field: 'envelope',
      currentBytes: totalBytes,
      limitBytes: limits.maxEnvelopeBytes,
      severity: 'warning',
    })
  }

  if (metaBytes > limits.maxMetaBytes) {
    violations.push({
      field: 'meta',
      currentBytes: metaBytes,
      limitBytes: limits.maxMetaBytes,
      severity: 'error',
    })
  }

  if (queueNameBytes > limits.maxQueueNameBytes) {
    violations.push({
      field: 'queue',
      currentBytes: queueNameBytes,
      limitBytes: limits.maxQueueNameBytes,
      severity: 'error',
    })
  }

  if (jobTypeBytes > limits.maxJobTypeBytes) {
    violations.push({
      field: 'type',
      currentBytes: jobTypeBytes,
      limitBytes: limits.maxJobTypeBytes,
      severity: 'error',
    })
  }

  return { totalBytes, metaBytes, queueNameBytes, jobTypeBytes, violations }
}
