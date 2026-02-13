import LZString from 'lz-string'
import type { ShareableState } from './types'

const URL_PREFIX = '#/s/'

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
 * Get the current shareable URL.
 */
export function getShareUrl(state: ShareableState): string {
  const hash = encodeState(state)
  return `${window.location.origin}${window.location.pathname}${hash}`
}
