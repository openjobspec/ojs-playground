import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { runSimulation } from '@/engine/simulation'
import { DEFAULT_JOB } from '@/engine/constants'
import { simulateRateLimitBatch, RATE_LIMIT_PRESETS } from '@/engine/ratelimit'
import type { SimulationResult, BackoffStrategy, RateLimitPolicy } from '@/engine/types'
import { Gauge, AlertTriangle, ShieldCheck, ShieldAlert, Timer } from 'lucide-react'

type BackpressureStrategy = 'reject' | 'block' | 'drop_oldest'

interface QueueConfig {
  name: string
  maxSize: number
  currentDepth: number
  warningThreshold: number
  strategy: BackpressureStrategy
}

const DEFAULT_QUEUES: QueueConfig[] = [
  { name: 'default', maxSize: 100, currentDepth: 45, warningThreshold: 80, strategy: 'reject' },
  { name: 'email', maxSize: 50, currentDepth: 12, warningThreshold: 40, strategy: 'reject' },
  { name: 'webhooks', maxSize: 200, currentDepth: 180, warningThreshold: 160, strategy: 'drop_oldest' },
]

function getQueueStatus(queue: QueueConfig): 'ok' | 'warning' | 'critical' {
  if (queue.currentDepth >= queue.maxSize) return 'critical'
  if (queue.currentDepth >= queue.warningThreshold) return 'warning'
  return 'ok'
}

const statusColors = {
  ok: 'text-green-500',
  warning: 'text-yellow-500',
  critical: 'text-red-500',
}

const strategyLabels: Record<BackpressureStrategy, string> = {
  reject: 'Reject (429)',
  block: 'Block (wait)',
  drop_oldest: 'Drop Oldest',
}

const actionColors: Record<string, string> = {
  allow: 'text-green-500',
  wait: 'text-yellow-500',
  reschedule: 'text-blue-500',
  drop: 'text-red-500',
}

export function BackpressurePanel() {
  const [queues, setQueues] = useState<QueueConfig[]>(DEFAULT_QUEUES)
  const [simResult, setSimResult] = useState<SimulationResult | null>(null)
  const [activeSection, setActiveSection] = useState<'queues' | 'ratelimit'>('queues')
  const [selectedPreset, setSelectedPreset] = useState(0)
  const [batchSize, setBatchSize] = useState(20)
  const strategy = useStore((s) => s.strategy)
  const parsedJob = useStore((s) => s.parsedJob)

  const rateLimitPolicy = RATE_LIMIT_PRESETS[selectedPreset]!.policy
  const rateLimitEvents = useMemo(
    () => simulateRateLimitBatch(rateLimitPolicy, batchSize, 100),
    [rateLimitPolicy, batchSize],
  )

  const rlStats = useMemo(() => {
    const allowed = rateLimitEvents.filter((e) => e.action === 'allow').length
    const waited = rateLimitEvents.filter((e) => e.action === 'wait').length
    const dropped = rateLimitEvents.filter((e) => e.action === 'drop').length
    const rescheduled = rateLimitEvents.filter((e) => e.action === 'reschedule').length
    return { allowed, waited, dropped, rescheduled }
  }, [rateLimitEvents])

  const simulateEnqueue = (queueIndex: number) => {
    const queue = queues[queueIndex]!
    const job = parsedJob ?? DEFAULT_JOB
    const result = runSimulation({
      job: { ...job, queue: queue.name },
      scenario: 'backpressure_reject',
      strategy: strategy as BackoffStrategy,
      queueDepth: queue.currentDepth,
      queueMaxSize: queue.maxSize,
      backpressureStrategy: queue.strategy,
      seed: 42,
    })
    setSimResult(result)

    if (result.finalState !== 'discarded') {
      setQueues((prev) =>
        prev.map((q, i) =>
          i === queueIndex ? { ...q, currentDepth: Math.min(q.currentDepth + 1, q.maxSize) } : q,
        ),
      )
    }
  }

  const updateQueueDepth = (index: number, depth: number) => {
    setQueues((prev) =>
      prev.map((q, i) => (i === index ? { ...q, currentDepth: depth } : q)),
    )
  }

  const updateQueueStrategy = (index: number, strat: BackpressureStrategy) => {
    setQueues((prev) =>
      prev.map((q, i) => (i === index ? { ...q, strategy: strat } : q)),
    )
  }

  const totalPressure = useMemo(() => {
    const total = queues.reduce((sum, q) => sum + q.currentDepth, 0)
    const max = queues.reduce((sum, q) => sum + q.maxSize, 0)
    return Math.round((total / max) * 100)
  }, [queues])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Backpressure & Rate Limits</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSection('queues')}
            className={`px-2 py-0.5 rounded text-[10px] ${activeSection === 'queues' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Queues
          </button>
          <button
            onClick={() => setActiveSection('ratelimit')}
            className={`px-2 py-0.5 rounded text-[10px] ${activeSection === 'ratelimit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Rate Limits
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {activeSection === 'queues' ? (
          <>
            {/* System-wide gauge */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">System Queue Pressure</label>
              <Progress value={totalPressure} className="h-3" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span className={totalPressure > 80 ? 'text-red-500 font-medium' : ''}>{totalPressure}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Per-queue gauges */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Queue Depth</label>
              {queues.map((queue, i) => {
                const status = getQueueStatus(queue)
                const percent = Math.round((queue.currentDepth / queue.maxSize) * 100)
                return (
                  <div key={queue.name} className="space-y-1.5 rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {status === 'ok' && <ShieldCheck className="h-3 w-3 text-green-500" />}
                        {status === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                        {status === 'critical' && <ShieldAlert className="h-3 w-3 text-red-500" />}
                        <span className="text-xs font-mono font-medium">{queue.name}</span>
                      </div>
                      <span className={`text-[10px] font-medium ${statusColors[status]}`}>
                        {queue.currentDepth}/{queue.maxSize}
                      </span>
                    </div>
                    <Progress value={percent} className="h-2" />
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[queue.currentDepth]}
                        max={queue.maxSize}
                        step={1}
                        onValueChange={([v]) => updateQueueDepth(i, v!)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <select
                        value={queue.strategy}
                        onChange={(e) => updateQueueStrategy(i, e.target.value as BackpressureStrategy)}
                        className="h-5 rounded border bg-background px-1 text-[10px]"
                      >
                        {Object.entries(strategyLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" className="h-5 px-2 text-[10px]" onClick={() => simulateEnqueue(i)}>
                        Enqueue
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {simResult && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Last Enqueue Result</label>
                <div className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span>Result:</span>
                    <Badge variant={simResult.finalState === 'completed' ? 'default' : 'destructive'} className="text-[10px]">
                      {simResult.finalState}
                    </Badge>
                  </div>
                  {simResult.events.map((e, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">
                      {e.label}
                      {e.backpressure && <span className="text-orange-500 ml-1">({e.backpressure})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Rate Limit Section */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Preset</label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(Number(e.target.value))}
                className="w-full h-7 rounded border bg-background px-2 text-xs"
              >
                {RATE_LIMIT_PRESETS.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Policy display */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Active Policy</label>
              <div className="rounded-md border p-2 text-xs font-mono space-y-0.5">
                <div>key: &quot;{rateLimitPolicy.key}&quot;</div>
                {rateLimitPolicy.concurrency !== undefined && <div>concurrency: {rateLimitPolicy.concurrency}</div>}
                {rateLimitPolicy.rate && <div>rate: {rateLimitPolicy.rate.limit}/{rateLimitPolicy.rate.period}</div>}
                {rateLimitPolicy.throttle && <div>throttle: {rateLimitPolicy.throttle.limit}/{rateLimitPolicy.throttle.period}</div>}
                <div>on_limit: &quot;{rateLimitPolicy.on_limit ?? 'wait'}&quot;</div>
              </div>
            </div>

            {/* Batch size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Batch Simulation</label>
                <span className="text-[10px] text-muted-foreground">{batchSize} jobs</span>
              </div>
              <Slider value={[batchSize]} min={5} max={50} step={1} onValueChange={([v]) => setBatchSize(v!)} />
            </div>

            {/* Results summary */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-lg font-bold text-green-500">{rlStats.allowed}</div>
                <div className="text-[9px] text-muted-foreground">Allowed</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-lg font-bold text-yellow-500">{rlStats.waited}</div>
                <div className="text-[9px] text-muted-foreground">Waited</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-lg font-bold text-blue-500">{rlStats.rescheduled}</div>
                <div className="text-[9px] text-muted-foreground">Resched.</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-lg font-bold text-red-500">{rlStats.dropped}</div>
                <div className="text-[9px] text-muted-foreground">Dropped</div>
              </div>
            </div>

            {/* Event log */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Event Log</label>
              <div className="rounded-md border max-h-40 overflow-auto">
                {rateLimitEvents.map((event, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-0.5 text-[10px] border-b last:border-b-0">
                    <span className="w-6 text-muted-foreground">#{event.jobIndex}</span>
                    <Timer className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{event.time}ms</span>
                    <span className={`font-medium ${actionColors[event.action] ?? ''}`}>{event.action}</span>
                    {event.reason && <span className="text-muted-foreground truncate">{event.reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Spec reference */}
        <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-1">
          <div className="font-medium">
            {activeSection === 'queues' ? 'Backpressure (ojs-backpressure.md)' : 'Rate Limiting (ojs-rate-limiting.md)'}
          </div>
          {activeSection === 'queues' ? (
            <>
              <div><strong>Reject:</strong> Return 429, client retries</div>
              <div><strong>Block:</strong> Hold until space available</div>
              <div><strong>Drop Oldest:</strong> Evict oldest job</div>
            </>
          ) : (
            <>
              <div><strong>Concurrency:</strong> Max active jobs at once</div>
              <div><strong>Rate:</strong> Max starts per time window</div>
              <div><strong>Throttle:</strong> Even spacing between starts</div>
              <div><strong>on_limit:</strong> wait | reschedule | drop</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
