import LZString from 'lz-string'
import YAML from 'yaml'
import type { ShareableState } from './types'
import { validateJob } from './validator'
import { boundedDecompressFromEncodedURIComponent } from './lz-bounded'

const URL_PREFIX = '#/s/'
const SHORT_PREFIX = '#/p/'
const MAX_URL_LENGTH = 2000
const MAX_ENCODED_LENGTH = 16 * 1024
const MAX_DECODED_LENGTH = 128 * 1024
const MAX_SPEC_BYTES = 64 * 1024
const MAX_STRING_BYTES = 16 * 1024
const MAX_ARRAY_ITEMS = 1000
const MAX_OBJECT_KEYS = 1000
const MAX_NODES = 10_000
const MAX_DEPTH = 32

const LANGUAGES = new Set(['go', 'javascript', 'python', 'ruby', 'rust', 'java'])
const SCOPES = new Set(['enqueue', 'worker', 'full'])
const EDITOR_MODES = new Set(['json', 'yaml'])
const SCENARIOS = new Set([
  'success_first_attempt',
  'success_after_retries',
  'exhausted',
  'cancelled',
  'non_retryable_error',
  'scheduled_then_success',
  'timeout_execution',
  'timeout_heartbeat',
  'progress_tracking',
  'dead_letter',
  'backpressure_reject',
  'workflow_chain',
  'workflow_group',
  'custom',
])
const STRATEGIES = new Set(['none', 'linear', 'exponential', 'polynomial'])
const TABS = new Set([
  'code', 'templates', 'comparison', 'conformance', 'tutorials', 'cron', 'dlq',
  'backpressure', 'queues', 'middleware', 'workers', 'chaos', 'jobs',
  'test-runner', 'job-ide',
])
const STATE_KEYS = new Set([
  'version', 'spec', 'editorMode', 'language', 'scope', 'scenario', 'strategy', 'tab',
])

export type ShareDecodeError =
  | 'not_share_link'
  | 'missing'
  | 'too_large'
  | 'invalid_encoding'
  | 'invalid_json'
  | 'invalid_shape'
  | 'invalid_version'
  | 'invalid_enum'
  | 'invalid_spec'

export type ShareDecodeResult =
  | { ok: true; state: ShareableState }
  | { ok: false; error: ShareDecodeError; message: string }

function failure(error: ShareDecodeError, message: string): ShareDecodeResult {
  return { ok: false, error, message }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/**
 * Encode playground state into a URL-safe compressed string.
 */
export function encodeState(state: ShareableState): string {
  const validation = validateShareableState(state)
  if (!validation.ok) throw new Error(validation.message)
  const json = JSON.stringify(validation.state)
  const compressed = LZString.compressToEncodedURIComponent(json)
  if (compressed.length > MAX_ENCODED_LENGTH) {
    throw new Error('Shared playground state is too large')
  }
  return URL_PREFIX + compressed
}

/**
 * Decode and validate a playground URL hash without throwing.
 */
export function decodeStateResult(hash: string): ShareDecodeResult {
  if (hash.startsWith(SHORT_PREFIX)) return decodeShortState(hash)
  if (!hash.startsWith(URL_PREFIX)) return failure('not_share_link', 'This is not a playground share link')

  const compressed = hash.slice(URL_PREFIX.length)
  if (!compressed) return failure('missing', 'The share link has no content')
  if (compressed.length > MAX_ENCODED_LENGTH) {
    return failure('too_large', 'The share link is larger than the supported limit')
  }

  const decompressed = boundedDecompressFromEncodedURIComponent(compressed, MAX_DECODED_LENGTH)
  if (!decompressed.ok) {
    return failure(
      decompressed.reason === 'too_large' ? 'too_large' : 'invalid_encoding',
      decompressed.reason === 'too_large'
        ? 'The shared state expands beyond the supported limit'
        : 'The share link is corrupted',
    )
  }
  if (!decompressed.value || byteLength(decompressed.value) > MAX_DECODED_LENGTH) {
    return failure('too_large', 'The decoded shared state is larger than the supported limit')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(decompressed.value)
  } catch {
    return failure('invalid_json', 'The shared state is not valid JSON')
  }
  return validateShareableState(parsed)
}

/**
 * Backward-compatible nullable decoder used by existing callers.
 */
export function decodeState(hash: string): ShareableState | null {
  const result = decodeStateResult(hash)
  return result.ok ? result.state : null
}

function decodeShortState(hash: string): ShareDecodeResult {
  const id = hash.slice(SHORT_PREFIX.length)
  if (!/^[A-Za-z0-9]{8}$/.test(id)) {
    return failure('invalid_encoding', 'The local share identifier is invalid')
  }

  let stored: string | null
  try {
    stored = localStorage.getItem(`ojs-share-${id}`)
  } catch {
    return failure('missing', 'Local shared state is unavailable')
  }
  if (!stored) return failure('missing', 'This local share link is no longer available')
  if (byteLength(stored) > MAX_DECODED_LENGTH) {
    return failure('too_large', 'The local shared state is larger than the supported limit')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return failure('invalid_json', 'The local shared state is not valid JSON')
  }
  return validateShareableState(parsed)
}

export function validateShareableState(value: unknown): ShareDecodeResult {
  if (!isRecord(value) || Object.keys(value).some((key) => !STATE_KEYS.has(key))) {
    return failure('invalid_shape', 'The shared state has an unsupported shape')
  }
  if (value.version !== undefined && value.version !== 1) {
    return failure('invalid_version', 'The shared state version is not supported')
  }
  if (typeof value.spec !== 'string' || value.spec.length === 0 || byteLength(value.spec) > MAX_SPEC_BYTES) {
    return failure('invalid_shape', 'The shared spec is missing or too large')
  }
  if (!isOptionalEnum(value.editorMode, EDITOR_MODES) ||
      !isOptionalEnum(value.language, LANGUAGES) ||
      !isOptionalEnum(value.scope, SCOPES) ||
      !isOptionalEnum(value.scenario, SCENARIOS) ||
      !isOptionalEnum(value.strategy, STRATEGIES) ||
      !isOptionalEnum(value.tab, TABS)) {
    return failure('invalid_enum', 'The shared state contains an unsupported option')
  }

  const parsedSpec = parseSharedSpec(value.spec, value.editorMode)
  if (!parsedSpec.ok) return parsedSpec.result

  const complexityError = validateValueComplexity(parsedSpec.value)
  if (complexityError) return failure('invalid_spec', complexityError)

  const validation = validateJob(parsedSpec.value)
  if (!validation.valid) {
    return failure('invalid_spec', `The shared spec is invalid: ${validation.errors[0]?.message ?? 'schema validation failed'}`)
  }

  return {
    ok: true,
    state: {
      ...(value.version === 1 ? { version: 1 as const } : {}),
      spec: value.spec,
      ...(value.editorMode ? { editorMode: value.editorMode as ShareableState['editorMode'] } : {}),
      ...(value.language ? { language: value.language as ShareableState['language'] } : {}),
      ...(value.scope ? { scope: value.scope as ShareableState['scope'] } : {}),
      ...(value.scenario ? { scenario: value.scenario as ShareableState['scenario'] } : {}),
      ...(value.strategy ? { strategy: value.strategy as ShareableState['strategy'] } : {}),
      ...(value.tab ? { tab: value.tab as string } : {}),
    },
  }
}

function parseSharedSpec(
  spec: string,
  mode: unknown,
): { ok: true; value: unknown } | { ok: false; result: ShareDecodeResult } {
  try {
    if (mode === 'yaml') return { ok: true, value: YAML.parse(spec) }
    if (mode === 'json') return { ok: true, value: JSON.parse(spec) }
    try {
      return { ok: true, value: JSON.parse(spec) }
    } catch {
      return { ok: true, value: YAML.parse(spec) }
    }
  } catch {
    return {
      ok: false,
      result: failure('invalid_spec', `The shared ${mode === 'yaml' ? 'YAML' : 'JSON'} spec cannot be parsed`),
    }
  }
}

function validateValueComplexity(value: unknown): string | null {
  let nodes = 0
  const visit = (item: unknown, depth: number): string | null => {
    nodes++
    if (nodes > MAX_NODES) return 'The shared spec contains too many values'
    if (depth > MAX_DEPTH) return 'The shared spec is nested too deeply'
    if (typeof item === 'string' && byteLength(item) > MAX_STRING_BYTES) {
      return 'The shared spec contains a string that is too long'
    }
    if (Array.isArray(item)) {
      if (item.length > MAX_ARRAY_ITEMS) return 'The shared spec contains an oversized array'
      for (const child of item) {
        const error = visit(child, depth + 1)
        if (error) return error
      }
    } else if (isRecord(item)) {
      const values = Object.entries(item)
      if (values.length > MAX_OBJECT_KEYS) return 'The shared spec contains too many object fields'
      for (const [key, child] of values) {
        if (byteLength(key) > 256) return 'The shared spec contains an object key that is too long'
        const error = visit(child, depth + 1)
        if (error) return error
      }
    }
    return null
  }
  return visit(value, 0)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isOptionalEnum(value: unknown, allowed: Set<string>): boolean {
  return value === undefined || (typeof value === 'string' && allowed.has(value))
}

function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(8)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (byte) => chars.charAt(byte % chars.length)).join('')
}

/**
 * Get the current shareable URL, with a same-device localStorage fallback.
 */
export function getShareUrl(state: ShareableState): { url: string; hash: string; isLocal: boolean } {
  const validation = validateShareableState(state)
  if (!validation.ok) throw new Error(validation.message)
  const serialized = JSON.stringify(validation.state)
  if (byteLength(serialized) > MAX_DECODED_LENGTH) {
    throw new Error('Shared playground state is too large')
  }

  const compressed = LZString.compressToEncodedURIComponent(serialized)
  const portableHash = URL_PREFIX + compressed
  const fullUrl = `${window.location.origin}${window.location.pathname}${portableHash}`
  if (compressed.length <= MAX_ENCODED_LENGTH && fullUrl.length <= MAX_URL_LENGTH) {
    return { url: fullUrl, hash: portableHash, isLocal: false }
  }

  const shortId = generateShortId()
  localStorage.setItem(`ojs-share-${shortId}`, serialized)
  const shortHash = SHORT_PREFIX + shortId
  return {
    url: `${window.location.origin}${window.location.pathname}${shortHash}`,
    hash: shortHash,
    isLocal: true,
  }
}
