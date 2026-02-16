import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Layers, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import type { MiddlewareEntry } from '@/engine/types'

const DEFAULT_EXECUTION_MIDDLEWARE: MiddlewareEntry[] = [
  { name: 'Logging', type: 'execution', enabled: true, order: 0, description: 'Log job start/complete/fail with timing' },
  { name: 'Metrics', type: 'execution', enabled: true, order: 1, description: 'Record duration, success/fail counters' },
  { name: 'Error Reporting', type: 'execution', enabled: true, order: 2, description: 'Capture exceptions, format as OJS error' },
  { name: 'Timeout', type: 'execution', enabled: true, order: 3, description: 'Enforce job.timeout with deadline' },
  { name: 'Trace Context', type: 'execution', enabled: false, order: 4, description: 'Restore W3C traceparent from job.meta' },
  { name: 'Rate Limiter', type: 'execution', enabled: false, order: 5, description: 'Check rate limits before execution' },
]

const DEFAULT_ENQUEUE_MIDDLEWARE: MiddlewareEntry[] = [
  { name: 'Validation', type: 'enqueue', enabled: true, order: 0, description: 'Validate job envelope against schema' },
  { name: 'Trace Context', type: 'enqueue', enabled: true, order: 1, description: 'Inject W3C traceparent into job.meta' },
  { name: 'Logging', type: 'enqueue', enabled: true, order: 2, description: 'Log enqueue operations' },
  { name: 'Deduplication', type: 'enqueue', enabled: false, order: 3, description: 'Check unique constraints before enqueue' },
]

export function MiddlewarePanel() {
  const [chain, setChain] = useState<'execution' | 'enqueue'>('execution')
  const [executionMw, setExecutionMw] = useState<MiddlewareEntry[]>(DEFAULT_EXECUTION_MIDDLEWARE)
  const [enqueueMw, setEnqueueMw] = useState<MiddlewareEntry[]>(DEFAULT_ENQUEUE_MIDDLEWARE)

  const middleware = chain === 'execution' ? executionMw : enqueueMw
  const setMiddleware = chain === 'execution' ? setExecutionMw : setEnqueueMw
  const enabledMw = middleware.filter((m) => m.enabled).sort((a, b) => a.order - b.order)

  const toggleEnabled = useCallback((name: string) => {
    setMiddleware((prev) =>
      prev.map((m) => (m.name === name ? { ...m, enabled: !m.enabled } : m)),
    )
  }, [setMiddleware])

  const moveUp = useCallback((name: string) => {
    setMiddleware((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((m) => m.name === name)
      if (idx <= 0) return prev
      const temp = sorted[idx]!.order
      sorted[idx]!.order = sorted[idx - 1]!.order
      sorted[idx - 1]!.order = temp
      return [...sorted]
    })
  }, [setMiddleware])

  const moveDown = useCallback((name: string) => {
    setMiddleware((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order)
      const idx = sorted.findIndex((m) => m.name === name)
      if (idx < 0 || idx >= sorted.length - 1) return prev
      const temp = sorted[idx]!.order
      sorted[idx]!.order = sorted[idx + 1]!.order
      sorted[idx + 1]!.order = temp
      return [...sorted]
    })
  }, [setMiddleware])

  const resetToDefaults = () => {
    setExecutionMw([...DEFAULT_EXECUTION_MIDDLEWARE])
    setEnqueueMw([...DEFAULT_ENQUEUE_MIDDLEWARE])
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Middleware</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setChain('execution')}
            className={`px-2 py-0.5 rounded text-[10px] ${chain === 'execution' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Execution
          </button>
          <button
            onClick={() => setChain('enqueue')}
            className={`px-2 py-0.5 rounded text-[10px] ${chain === 'enqueue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Enqueue
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Onion model visualization */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              {chain === 'execution' ? 'Execution Chain (onion model)' : 'Enqueue Chain (linear)'}
            </label>
            <Button size="sm" variant="ghost" className="h-5 px-1.5" onClick={resetToDefaults}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>

          {chain === 'execution' ? (
            // Onion model: nested layers
            <div className="space-y-0">
              {enabledMw.map((mw, i) => {
                const depth = enabledMw.length - i
                const paddingLeft = i * 12
                const isInner = i === enabledMw.length - 1
                return (
                  <div key={mw.name}>
                    <div
                      className="rounded-t border border-b-0 px-2 py-1 text-[10px]"
                      style={{ marginLeft: paddingLeft, marginRight: paddingLeft }}
                    >
                      <span className="font-medium">{mw.name}</span>
                      <span className="text-muted-foreground ml-1">→</span>
                    </div>
                    {isInner && (
                      <div
                        className="rounded border-2 border-primary/50 bg-primary/5 px-2 py-2 text-center text-[10px] font-medium"
                        style={{ marginLeft: paddingLeft + 12, marginRight: paddingLeft + 12 }}
                      >
                        Handler
                      </div>
                    )}
                  </div>
                )
              })}
              {enabledMw.length > 0 && (
                <div className="mt-1">
                  {[...enabledMw].reverse().map((mw, i) => {
                    const paddingLeft = (enabledMw.length - 1 - i) * 12
                    return (
                      <div
                        key={`close-${mw.name}`}
                        className="rounded-b border border-t-0 px-2 py-0.5 text-[10px] text-muted-foreground"
                        style={{ marginLeft: paddingLeft, marginRight: paddingLeft }}
                      >
                        <span>← {mw.name}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            // Linear pipeline
            <div className="flex items-center gap-1 flex-wrap">
              {enabledMw.map((mw, i) => (
                <div key={mw.name} className="flex items-center gap-1">
                  <div className="rounded border px-2 py-1 text-[10px] font-medium bg-card">
                    {mw.name}
                  </div>
                  {i < enabledMw.length - 1 && <span className="text-[10px] text-muted-foreground">→</span>}
                </div>
              ))}
              <span className="text-[10px] text-muted-foreground">→</span>
              <div className="rounded border-2 border-primary/50 bg-primary/5 px-2 py-1 text-[10px] font-medium">
                Enqueue
              </div>
            </div>
          )}
        </div>

        {/* Middleware list with controls */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Configure</label>
          <div className="space-y-1">
            {[...middleware].sort((a, b) => a.order - b.order).map((mw) => (
              <div
                key={mw.name}
                className={`flex items-center gap-2 rounded-md border p-2 text-xs ${!mw.enabled ? 'opacity-50' : ''}`}
              >
                <Switch
                  checked={mw.enabled}
                  onCheckedChange={() => toggleEnabled(mw.name)}
                  className="scale-75"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{mw.name}</div>
                  {mw.description && (
                    <div className="text-[10px] text-muted-foreground truncate">{mw.description}</div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0"
                    onClick={() => moveUp(mw.name)}
                    disabled={!mw.enabled}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0"
                    onClick={() => moveDown(mw.name)}
                    disabled={!mw.enabled}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spec reference */}
        <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-1">
          <div className="font-medium">Middleware (ojs-middleware.md)</div>
          <div><strong>Enqueue:</strong> Linear — middleware₁ → middleware₂ → enqueue</div>
          <div><strong>Execution:</strong> Nested (onion) — outermost wraps innermost</div>
          <div>Default: Logging → Metrics → Error Reporting → Timeout → Handler</div>
        </div>
      </div>
    </div>
  )
}
