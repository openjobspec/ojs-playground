import LZString from 'lz-string'
import type { ShareableState } from './types'

const URL_PREFIX = '#/s/'
const SHORT_PREFIX = '#/p/'
const MAX_URL_LENGTH = 2000

/**
 * Encode playground state into a URL-safe compressed string.
 */
export function encodeState(state: ShareableState): string {
  const json = JSON.stringify(state)
  const compressed = LZString.compressToEncodedURIComponent(json)
  return URL_PREFIX + compressed
}

/**
 * Decode playground state from a URL hash string.
 * Returns null if the hash is invalid or cannot be decompressed.
 */
export function decodeState(hash: string): ShareableState | null {
  if (hash.startsWith(SHORT_PREFIX)) {
    return decodeShortState(hash)
  }
  if (!hash.startsWith(URL_PREFIX)) return null

  const compressed = hash.slice(URL_PREFIX.length)
  if (!compressed) return null

  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed)
    if (!json) return null
    return JSON.parse(json) as ShareableState
  } catch {
    return null
  }
}

/**
 * Decode short URL state stored in localStorage.
 */
function decodeShortState(hash: string): ShareableState | null {
  const id = hash.slice(SHORT_PREFIX.length)
  if (!id) return null
  try {
    const stored = localStorage.getItem(`ojs-share-${id}`)
    if (!stored) return null
    return JSON.parse(stored) as ShareableState
  } catch {
    return null
  }
}

/**
 * Generate a short ID for local storage fallback.
 */
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

/**
 * Get the current shareable URL.
 * Falls back to localStorage-based short URL if compressed URL exceeds 2000 chars.
 */
export function getShareUrl(state: ShareableState): string {
  const hash = encodeState(state)
  const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`

  if (fullUrl.length <= MAX_URL_LENGTH) {
    return fullUrl
  }

  // Fallback: store in localStorage with short ID
  const shortId = generateShortId()
  localStorage.setItem(`ojs-share-${shortId}`, JSON.stringify(state))
  const shortHash = SHORT_PREFIX + shortId
  return `${window.location.origin}${window.location.pathname}${shortHash}`
}
