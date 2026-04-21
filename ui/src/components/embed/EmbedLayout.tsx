import { useEffect } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store'
import {
  escapeHTMLAttribute,
  getEmbedOptions,
  normalizeEmbedDimension,
} from '@/engine/embed-config'

import { EditorPanel } from '@/components/editor/EditorPanel'
import { CodegenPanel } from '@/components/codegen/CodegenPanel'

/**
 * Minimal embed layout for iframe embedding.
 * Shows editor + code generation only — no visualization or navigation.
 * Activated via ?embed=true query parameter.
 */
export function EmbedLayout() {
  useTheme()
  const initFromContent = useStore((s) => s.initFromContent)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)

  useEffect(() => {
    const options = getEmbedOptions()
    if (options.theme) setTheme(options.theme)
    if (options.language) setLanguage(options.language)
    if (options.spec) initFromContent(options.spec)

    // Listen for postMessage from parent to set spec
    const handler = (e: MessageEvent) => {
      if (
        e.source === window.parent &&
        e.data?.type === 'ojs-playground:set-spec' &&
        typeof e.data.spec === 'string' &&
        e.data.spec.length <= 64 * 1024
      ) {
        initFromContent(e.data.spec)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [initFromContent, setLanguage, setTheme])

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground">
        <div className="flex-1 min-w-0 border-r">
          <EditorPanel />
        </div>
        <div className="flex-1 min-w-0">
          <CodegenPanel />
        </div>
      </div>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

/**
 * Check if we're in embed mode based on URL parameters.
 */
export function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false
  return getEmbedOptions().enabled
}

/**
 * Generate the embed snippet for a given spec.
 */
export function getEmbedSnippet(spec: string, options?: { width?: string; height?: string }): string {
  const width = normalizeEmbedDimension(options?.width, '100%')
  const height = normalizeEmbedDimension(options?.height, '400px')
  const encodedSpec = encodeURIComponent(spec)
  const baseUrl = escapeHTMLAttribute(`${window.location.origin}${window.location.pathname}`)
  return `<iframe
  src="${baseUrl}?embed=true&spec=${encodedSpec}"
  width="${escapeHTMLAttribute(width)}"
  height="${escapeHTMLAttribute(height)}"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="OJS Playground"
></iframe>`
}
