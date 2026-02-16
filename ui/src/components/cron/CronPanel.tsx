import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { parseCron, getNextRuns, CRON_PRESETS, CRON_FIELDS } from '@/engine/cron'

export function CronPanel() {
  const [expression, setExpression] = useState('0 9 * * 1-5')
  const parsed = useMemo(() => parseCron(expression), [expression])
  const nextRuns = useMemo(
    () => (parsed.valid ? getNextRuns(expression, 10) : null),
    [expression, parsed.valid],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Cron Expression Builder</span>
        <Badge variant={parsed.valid ? 'default' : 'destructive'} className="text-[10px]">
          {parsed.valid ? 'Valid' : 'Invalid'}
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Expression Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Expression</label>
          <Input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="* * * * *"
            className="font-mono text-sm"
          />
          {parsed.valid && parsed.description && (
            <p className="text-xs text-muted-foreground">{parsed.description}</p>
          )}
          {!parsed.valid && parsed.error && (
            <p className="text-xs text-destructive">{parsed.error}</p>
          )}
        </div>

        {/* Field Reference */}
        {parsed.valid && parsed.fields && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Parsed Fields</label>
            <div className="grid gap-1.5">
              {CRON_FIELDS.map((field, i) => (
                <div key={field.label} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted-foreground">{field.label}:</span>
                  <span className="font-mono text-[11px]">
                    {parsed.fields![i]!.length > 15
                      ? `${parsed.fields![i]!.slice(0, 5).join(', ')}... (${parsed.fields![i]!.length} values)`
                      : parsed.fields![i]!.join(', ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Runs */}
        {nextRuns && nextRuns.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Next {nextRuns.length} Runs
            </label>
            <div className="space-y-0.5">
              {nextRuns.map((run, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-5 text-muted-foreground">{i + 1}.</span>
                  <span>{run.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Presets</label>
          <div className="grid gap-1">
            {CRON_PRESETS.map((preset) => (
              <button
                key={preset.expression}
                onClick={() => setExpression(preset.expression)}
                className="flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors"
              >
                <span className="font-medium">{preset.label}</span>
                <code className="text-[10px] text-muted-foreground font-mono">{preset.expression}</code>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
