import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store'

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

  useEffect(() => {
    // Listen for postMessage from parent to set spec
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ojs-playground:set-spec' && typeof e.data.spec === 'string') {
        initFromContent(e.data.spec)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [initFromContent])

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
  const params = new URLSearchParams(window.location.search)
  return params.get('embed') === 'true'
}

/**
 * Generate the embed snippet for a given spec.
 */
export function getEmbedSnippet(spec: string, options?: { width?: string; height?: string }): string {
  const width = options?.width ?? '100%'
  const height = options?.height ?? '400px'
  const encodedSpec = encodeURIComponent(spec)
  const baseUrl = `${window.location.origin}${window.location.pathname}`
  return `<iframe
  src="${baseUrl}?embed=true&spec=${encodedSpec}"
  width="${width}"
  height="${height}"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="OJS Playground"
></iframe>`
}
