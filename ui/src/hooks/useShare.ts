import { useCallback } from 'react'
import { useStore } from '@/store'
import { encodeState, decodeState, getShareUrl } from '@/engine/sharing'
import type { ShareableState } from '@/engine/types'

export function useShare() {
  const store = useStore()

  const buildShareableState = useCallback((): ShareableState => {
    return {
      spec: store.editorContent,
      editorMode: store.editorMode,
      language: store.language,
      scope: store.scope,
      scenario: store.scenario,
      strategy: store.strategy,
    }
  }, [store.editorContent, store.editorMode, store.language, store.scope, store.scenario, store.strategy])

  const copyShareUrl = useCallback(async () => {
    const state = buildShareableState()
    const url = getShareUrl(state)
    await navigator.clipboard.writeText(url)
    window.history.replaceState(null, '', encodeState(state))
    return url
  }, [buildShareableState])

  const loadFromUrl = useCallback(() => {
    const hash = window.location.hash
    if (!hash) return false

    const state = decodeState(hash)
    if (!state) return false

    if (state.editorMode) store.setEditorMode(state.editorMode)
    if (state.language) store.setLanguage(state.language)
    if (state.scope) store.setScope(state.scope)
    if (state.scenario) store.setScenario(state.scenario)
    if (state.strategy) store.setStrategy(state.strategy)

    store.initFromContent(state.spec)
    return true
  }, [store])

  return { copyShareUrl, loadFromUrl, buildShareableState }
}
