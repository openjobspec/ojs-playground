import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/store'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useReducedMotion } from '@/hooks/useReducedMotion'

interface ChaosState {
  fail_next_n: number
  latency_ms: number
  timeout_next: boolean
  paused_queues: string[]
}

const defaultState: ChaosState = {
  fail_next_n: 0,
  latency_ms: 0,
  timeout_next: false,
  paused_queues: [],
}

export function ChaosPanel() {
  const isLocalMode = useStore((s) => s.isLocalMode)
  const localUrl = useStore((s) => s.localUrl)
  const [chaos, setChaos] = useState<ChaosState>(defaultState)
  const [active, setActive] = useState(false)

  const fetchChaos = useCallback(async () => {
    try {
      const res = await fetch(`${localUrl}/api/chaos`)
      if (!res.ok) return
      const data = await res.json()
      setChaos(data.chaos ?? defaultState)
    } catch {
      // server not reachable
    }
  }, [localUrl])

  useEffect(() => {
    if (!isLocalMode) return
    fetchChaos()
  }, [isLocalMode, fetchChaos])

  useEffect(() => {
    setActive(
      chaos.fail_next_n > 0 || chaos.latency_ms > 0 || chaos.timeout_next || chaos.paused_queues.length > 0,
    )
  }, [chaos])

  const updateChaos = async (patch: Partial<ChaosState>) => {
    try {
      const res = await fetch(`${localUrl}/api/chaos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const data = await res.json()
        setChaos(data.chaos ?? defaultState)
      }
    } catch {
      toast.error('Failed to update chaos config')
    }
  }

  const resetChaos = async () => {
    try {
      const res = await fetch(`${localUrl}/api/chaos`, { method: 'DELETE' })
      if (res.ok) {
        setChaos(defaultState)
        toast.success('Chaos config reset')
      }
    } catch {
      toast.error('Failed to reset chaos config')
    }
  }

  const reducedMotion = useReducedMotion()

  if (!isLocalMode) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <p>Chaos panel requires Local Mode</p>
          <p className="text-[10px]">Run <code className="bg-muted px-1 rounded">npx ojs-playground dev</code> to enable</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Chaos</span>
          {active && (
            <span className="relative flex h-2 w-2" title="Chaos active">
              {!reducedMotion && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px]"
          onClick={resetChaos}
          title="Reset all chaos settings"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {active && (
          <div className="flex items-center gap-2 rounded bg-destructive/10 p-2 text-[11px] text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Chaos is active — jobs may fail or experience delays
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Fail Next N Executions</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">{chaos.fail_next_n}</span>
          </div>
          <Slider
            value={[chaos.fail_next_n]}
            min={0}
            max={50}
            step={1}
            onValueChange={([v]) => updateChaos({ fail_next_n: v })}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px]">Added Latency</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {chaos.latency_ms === 0 ? 'off' : `${chaos.latency_ms}ms`}
            </span>
          </div>
          <Slider
            value={[chaos.latency_ms]}
            min={0}
            max={10000}
            step={100}
            onValueChange={([v]) => updateChaos({ latency_ms: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-[11px]">Timeout Next Execution</Label>
          <Switch
            checked={chaos.timeout_next}
            onCheckedChange={(checked) => updateChaos({ timeout_next: checked })}
            className="scale-75"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px]">Simulate Network Partition</Label>
            <p className="text-[9px] text-muted-foreground">Adds 30s latency to all requests</p>
          </div>
          <Switch
            checked={chaos.latency_ms >= 30000}
            onCheckedChange={(checked) => updateChaos({ latency_ms: checked ? 30000 : 0 })}
            className="scale-75"
          />
        </div>

        {chaos.paused_queues.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px]">Paused Queues</Label>
            <div className="flex flex-wrap gap-1">
              {chaos.paused_queues.map((q) => (
                <Badge key={q} variant="destructive" className="h-4 text-[9px] px-1.5">
                  {q}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
