import { encodeState, decodeStateResult } from '@/engine/sharing'
import type { ShareableState } from '@/engine/types'

/**
 * Sync playground state to/from URL hash.
 * Used by the useShare hook; this module provides the raw utilities.
 */

export function syncToUrl(stateOrHash: ShareableState | string): void {
  const hash = typeof stateOrHash === 'string' ? stateOrHash : encodeState(stateOrHash)
  window.history.replaceState(null, '', hash)
}

export function loadFromUrl() {
  const hash = window.location.hash
  return decodeStateResult(hash)
}
