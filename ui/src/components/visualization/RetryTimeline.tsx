import { useMemo } from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useStore } from '@/store'
import { formatDuration } from '@/engine/duration'

export function RetryTimeline() {
  const simulationResult = useStore((s) => s.simulationResult)

  const data = useMemo(() => {
    if (!simulationResult) return []

    return simulationResult.events
      .filter((e) => e.from !== 'initial')
      .map((event, i) => ({
        index: i,
        time: event.timestamp,
        state: event.to,
        label: event.label,
        delay: event.delay,
        attempt: event.attempt,
        isSuccess: event.to === 'completed',
        isFail: event.to === 'retryable' || event.to === 'discarded',
      }))
  }, [simulationResult])

  if (!simulationResult || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Run a simulation to see the timeline
      </div>
    )
  }

  const { totalDuration, totalAttempts, finalState, retryDelays } = simulationResult

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              dataKey="time"
              name="Time"
              tickFormatter={(v) => formatDuration(v as number)}
              tick={{ fontSize: 10 }}
              label={{ value: 'Time', position: 'insideBottom', offset: -10, fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="attempt"
              name="Attempt"
              tick={{ fontSize: 10 }}
              label={{ value: 'Attempt', angle: -90, position: 'insideLeft', fontSize: 10 }}
              allowDecimals={false}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null
                const d = payload[0]!.payload as (typeof data)[0]
                return (
                  <div className="rounded border bg-popover p-2 text-xs text-popover-foreground shadow-md">
                    <div className="font-medium">{d.label}</div>
                    <div>State: {d.state}</div>
                    <div>Time: {formatDuration(d.time)}</div>
                    {d.delay && <div>Delay: {formatDuration(d.delay)}</div>}
                    <div>Attempt: {d.attempt}</div>
                  </div>
                )
              }}
            />
            <Scatter
              data={data.filter((d) => d.isSuccess)}
              fill="hsl(142, 71%, 45%)"
              name="Success"
            />
            <Scatter
              data={data.filter((d) => d.isFail)}
              fill="hsl(0, 84%, 60%)"
              name="Failure"
            />
            <Scatter
              data={data.filter((d) => !d.isSuccess && !d.isFail)}
              fill="hsl(var(--primary))"
              name="Transition"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="border-t px-3 py-1.5 flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
        <span>Attempts: <strong className="text-foreground">{totalAttempts}</strong></span>
        <span>Duration: <strong className="text-foreground">{formatDuration(totalDuration)}</strong></span>
        <span>
          Result: <strong className={finalState === 'completed' ? 'text-green-500' : 'text-red-500'}>
            {finalState}
          </strong>
        </span>
        {retryDelays.length > 0 && (
          <span>Delays: {retryDelays.map((d) => formatDuration(d)).join(' → ')}</span>
        )}
      </div>
    </div>
  )
}
