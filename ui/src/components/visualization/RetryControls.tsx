import { useStore } from '@/store'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parseDuration, toIsoDuration } from '@/engine/duration'
import type { OJSJob } from '@/engine/types'
import YAML from 'yaml'

export function RetryControls() {
  const parsedJob = useStore((s) => s.parsedJob)
  const editorContent = useStore((s) => s.editorContent)
  const initFromContent = useStore((s) => s.initFromContent)
  const editorMode = useStore((s) => s.editorMode)
  const simulationResult = useStore((s) => s.simulationResult)

  if (!parsedJob?.retry) {
    return (
      <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
        Add a retry policy to the job spec to adjust parameters
      </div>
    )
  }

  const retry = parsedJob.retry
  const maxAttempts = retry.max_attempts ?? 3
  const initialIntervalMs = retry.initial_interval ? parseDuration(retry.initial_interval) : 1000
  const maxIntervalMs = retry.max_interval ? parseDuration(retry.max_interval) : 300000
  const backoffCoefficient = retry.backoff_coefficient ?? 2.0
  const jitter = retry.jitter ?? true

  const handleChange = (patch: Record<string, unknown>) => {
    try {
      const job = (editorMode === 'yaml' ? YAML.parse(editorContent) : JSON.parse(editorContent)) as OJSJob
      job.retry = { ...job.retry, ...patch }
      const updated = editorMode === 'yaml' ? YAML.stringify(job) : JSON.stringify(job, null, 2)
      initFromContent(updated)
    } catch {
      // ignore parse errors during slider drag
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Retry Parameters</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px]">Max Attempts</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{maxAttempts}</span>
        </div>
        <Slider
          value={[maxAttempts]}
          min={1}
          max={25}
          step={1}
          onValueChange={([v]) => handleChange({ max_attempts: v })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px]">Initial Interval</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatMs(initialIntervalMs)}</span>
        </div>
        <Slider
          value={[msToSlider(initialIntervalMs)]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => handleChange({ initial_interval: toIsoDuration(sliderToMs(v!)) })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px]">Max Interval</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatMs(maxIntervalMs)}</span>
        </div>
        <Slider
          value={[msToSlider(maxIntervalMs)]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => handleChange({ max_interval: toIsoDuration(sliderToMs(v!)) })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[11px]">Backoff Coefficient</Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">{backoffCoefficient.toFixed(1)}</span>
        </div>
        <Slider
          value={[backoffCoefficient * 10]}
          min={10}
          max={100}
          step={1}
          onValueChange={([v]) => handleChange({ backoff_coefficient: Math.round(v!) / 10 })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px]">Jitter</Label>
        <Switch
          checked={jitter}
          onCheckedChange={(checked) => handleChange({ jitter: checked })}
          className="scale-75"
        />
      </div>

      {/* Retry Schedule Table */}
      {simulationResult && simulationResult.retrySchedule.length > 0 && (
        <div className="mt-1 border-t pt-2">
          <div className="text-[10px] font-medium text-muted-foreground mb-1">Retry Schedule</div>
          <ScrollArea className="max-h-24">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium pr-2">#</th>
                  <th className="text-right font-medium pr-2">Delay</th>
                  <th className="text-right font-medium">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {simulationResult.retrySchedule.map((entry) => (
                  <tr key={entry.retryNumber} className="tabular-nums">
                    <td className="pr-2">{entry.retryNumber}</td>
                    <td className="text-right pr-2">{formatMs(entry.finalDelay)}</td>
                    <td className="text-right">{formatMs(entry.cumulativeTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// Logarithmic slider mapping: 0-100 → 100ms-1hr
function sliderToMs(v: number): number {
  const minLog = Math.log(100)
  const maxLog = Math.log(3600000)
  return Math.round(Math.exp(minLog + (v / 100) * (maxLog - minLog)))
}

function msToSlider(ms: number): number {
  const minLog = Math.log(100)
  const maxLog = Math.log(3600000)
  const clamped = Math.max(100, Math.min(3600000, ms))
  return Math.round(((Math.log(clamped) - minLog) / (maxLog - minLog)) * 100)
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}
