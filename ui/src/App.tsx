import { useEffect, useRef } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { TopBar } from '@/components/shell/TopBar'
import { Layout } from '@/components/shell/Layout'
import { CommandPalette } from '@/components/shell/CommandPalette'
import { WelcomeOverlay } from '@/components/shell/WelcomeOverlay'
import { EmbedLayout, isEmbedMode } from '@/components/embed/EmbedLayout'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useShare } from '@/hooks/useShare'
import { useSimulation } from '@/hooks/useSimulation'
import { useStore } from '@/store'
import { DEFAULT_JOB_JSON } from '@/engine/constants'
import { trackEvent } from '@/engine/analytics'

const AUTO_SIM_KEY = 'ojs-playground-auto-sim-done'

function AppInner() {
  useTheme()
  useKeyboardShortcuts()
  const { loadFromUrl } = useShare()
  const { play, reset } = useSimulation()
  const editorContent = useStore((s) => s.editorContent)
  const initFromContent = useStore((s) => s.initFromContent)
  const autoSimRef = useRef(false)

  useEffect(() => {
    trackEvent('playground_loaded')

    // Check for embedded spec parameter
    const params = new URLSearchParams(window.location.search)
    const embeddedSpec = params.get('spec')
    if (embeddedSpec) {
      try {
        initFromContent(decodeURIComponent(embeddedSpec))
        return
      } catch { /* fall through */ }
    }

    // Try loading from URL hash first
    const loaded = loadFromUrl()
    if (!loaded && !editorContent) {
      initFromContent(DEFAULT_JOB_JSON)
    }

    // Auto-run simulation on first visit
    if (!autoSimRef.current && !localStorage.getItem(AUTO_SIM_KEY)) {
      autoSimRef.current = true
      localStorage.setItem(AUTO_SIM_KEY, 'true')
      setTimeout(() => {
        reset()
        setTimeout(play, 100)
      }, 1500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex-1 min-h-0">
        <Layout />
      </div>
      <CommandPalette />
      <WelcomeOverlay />
      <Toaster position="bottom-right" />
    </div>
  )
}

function App() {
  // Render minimal layout in embed mode
  if (isEmbedMode()) {
    return <EmbedLayout />
  }

  return (
    <TooltipProvider>
      <AppInner />
    </TooltipProvider>
  )
}

export default App
