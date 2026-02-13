import { encodeState, decodeState } from '@/engine/sharing'
import type { ShareableState } from '@/engine/types'

/**
 * Sync playground state to/from URL hash.
 * Used by the useShare hook; this module provides the raw utilities.
 */

export function syncToUrl(state: ShareableState): void {
  const hash = encodeState(state)
  window.history.replaceState(null, '', hash)
}

export function loadFromUrl(): ShareableState | null {
  const hash = window.location.hash
  if (!hash) return null
  return decodeState(hash)
}

/**
 * Create a URL hash subscriber that auto-updates the URL
 * when relevant state changes. Debounced to avoid excessive history entries.
 */
export function createUrlSyncSubscriber(
  getState: () => { editorContent: string; editorMode: 'json' | 'yaml'; language: string; scope: string; scenario: string; strategy: string },
) {
  let timer: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const s = getState()
      syncToUrl({
        spec: s.editorContent,
        editorMode: s.editorMode as 'json' | 'yaml',
        language: s.language as ShareableState['language'],
        scope: s.scope as ShareableState['scope'],
        scenario: s.scenario as ShareableState['scenario'],
        strategy: s.strategy as ShareableState['strategy'],
      })
    }, 1000)
  }
}
