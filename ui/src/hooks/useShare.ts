import { useCallback } from 'react'
import { useStore } from '@/store'
import { getShareUrl } from '@/engine/sharing'
import type { ShareableState } from '@/engine/types'
import { loadFromUrl as loadStateFromUrl, syncToUrl } from '@/store/middleware/url-sync'
import { toast } from 'sonner'

export function useShare() {
  const editorContent = useStore((s) => s.editorContent)
  const editorMode = useStore((s) => s.editorMode)
  const language = useStore((s) => s.language)
  const scope = useStore((s) => s.scope)
  const scenario = useStore((s) => s.scenario)
  const strategy = useStore((s) => s.strategy)
  const activeTab = useStore((s) => s.activeTab)
  const setEditorMode = useStore((s) => s.setEditorMode)
  const setLanguage = useStore((s) => s.setLanguage)
  const setScope = useStore((s) => s.setScope)
  const setScenario = useStore((s) => s.setScenario)
  const setStrategy = useStore((s) => s.setStrategy)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const initFromContent = useStore((s) => s.initFromContent)

  const buildShareableState = useCallback((): ShareableState => {
    return {
      version: 1,
      spec: editorContent,
      editorMode,
      language,
      scope,
      scenario,
      strategy,
      tab: activeTab !== 'code' ? activeTab : undefined,
    }
  }, [editorContent, editorMode, language, scope, scenario, strategy, activeTab])

  const copyShareUrl = useCallback(async () => {
    const state = buildShareableState()
    const { url, hash, isLocal } = getShareUrl(state)
    await navigator.clipboard.writeText(url)
    syncToUrl(hash)
    return { url, isLocal }
  }, [buildShareableState])

  const loadFromUrl = useCallback(() => {
    const result = loadStateFromUrl()
    if (!result.ok) {
      if (result.error !== 'not_share_link' && window.location.hash) {
        toast.error('Unable to load shared playground', {
          description: `${result.message}. You can continue with a new spec.`,
        })
      }
      return false
    }
    const state = result.state

    if (state.editorMode) setEditorMode(state.editorMode)
    if (state.language) setLanguage(state.language)
    if (state.scope) setScope(state.scope)
    if (state.scenario) setScenario(state.scenario)
    if (state.strategy) setStrategy(state.strategy)
    if (state.tab) setActiveTab(state.tab)

    initFromContent(state.spec)
    return true
  }, [setEditorMode, setLanguage, setScope, setScenario, setStrategy, setActiveTab, initFromContent])

  return { copyShareUrl, loadFromUrl, buildShareableState }
}
