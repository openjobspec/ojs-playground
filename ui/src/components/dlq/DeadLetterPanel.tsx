import { useState, useMemo, useCallback } from 'react'
import { useStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/engine/duration'
import { simulateBulkEnqueue } from '@/engine/bulk'
import { JOB_TEMPLATES } from '@/engine/templates'
import { RotateCcw, Trash2, Archive, AlertTriangle, CheckSquare, Square, Layers } from 'lucide-react'
import type { SimulationEvent, BulkOperationResult } from '@/engine/types'

interface DeadLetterEntry {
  id: string
  jobType: string
  queue: string
  error: string
  errorType: string
  attempt: number
  failedAt: number
  retryCount: number
  status: 'pending' | 'replayed' | 'purged'
  selected?: boolean
}

export function DeadLetterPanel() {
  const simulationResult = useStore((s) => s.simulationResult)
  const parsedJob = useStore((s) => s.parsedJob)
  const setScenario = useStore((s) => s.setScenario)
  const recompute = useStore((s) => s.recompute)

  const [entries, setEntries] = useState<DeadLetterEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'replayed'>('all')
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number; items: BulkOperationResult[] } | null>(null)
  const [showBulk, setShowBulk] = useState(false)

  const deadLetterEvents = useMemo(() => {
    if (!simulationResult) return []
    return simulationResult.events.filter(
      (e: SimulationEvent) => e.deadLettered || (e.to === 'discarded' && e.error),
    )
  }, [simulationResult])

  const addToDLQ = useCallback(() => {
    if (!parsedJob || deadLetterEvents.length === 0) return
    const newEntries: DeadLetterEntry[] = deadLetterEvents.map((e, i) => ({
      id: `dlq-${Date.now()}-${i}`,
      jobType: parsedJob.type,
      queue: parsedJob.queue,
      error: e.error?.message ?? 'Unknown error',
      errorType: e.error?.type ?? 'Error',
      attempt: e.attempt,
      failedAt: e.timestamp,
      retryCount: simulationResult?.totalAttempts ?? 0,
      status: 'pending' as const,
    }))
    setEntries((prev) => [...newEntries, ...prev].slice(0, 50))
  }, [parsedJob, deadLetterEvents, simulationResult])

  const replayEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'replayed' as const } : e)),
    )
  }, [])

  const purgeEntry = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'purged' as const } : e)),
    )
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)),
    )
  }, [])

  const selectAll = useCallback(() => {
    const pendingEntries = entries.filter((e) => e.status === 'pending')
    const allSelected = pendingEntries.every((e) => e.selected)
    setEntries((prev) =>
      prev.map((e) => (e.status === 'pending' ? { ...e, selected: !allSelected } : e)),
    )
  }, [entries])

  const bulkReplay = useCallback(() => {
    const selected = entries.filter((e) => e.selected && e.status === 'pending')
    setEntries((prev) =>
      prev.map((e) => (e.selected && e.status === 'pending' ? { ...e, status: 'replayed' as const, selected: false } : e)),
    )
    setBulkResult({ succeeded: selected.length, failed: 0, items: selected.map((e, i) => ({ index: i, status: 'created', jobId: e.id })) })
  }, [entries])

  const bulkPurge = useCallback(() => {
    const selected = entries.filter((e) => e.selected && e.status === 'pending')
    setEntries((prev) =>
      prev.map((e) => (e.selected && e.status === 'pending' ? { ...e, status: 'purged' as const, selected: false } : e)),
    )
    setBulkResult({ succeeded: selected.length, failed: 0, items: selected.map((e, i) => ({ index: i, status: 'created', jobId: e.id })) })
  }, [entries])

  const bulkEnqueueFromTemplates = useCallback(() => {
    const templateJobs = JOB_TEMPLATES.slice(0, 5).map((t) => t.spec)
    const result = simulateBulkEnqueue({
      atomicity: 'partial',
      jobs: templateJobs,
    })
    setBulkResult(result)
  }, [])

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries
    return entries.filter((e) => e.status === filter)
  }, [entries, filter])

  const pendingCount = entries.filter((e) => e.status === 'pending').length
  const selectedCount = entries.filter((e) => e.selected).length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Archive className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-sm font-medium">DLQ & Bulk Ops</span>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1">
              {pendingCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowBulk(false)}
            className={`px-2 py-0.5 rounded text-[10px] ${!showBulk ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            DLQ
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className={`px-2 py-0.5 rounded text-[10px] ${showBulk ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            Bulk
          </button>
        </div>
      </div>

      {showBulk ? (
        /* Bulk Operations Section */
        <div className="flex-1 overflow-auto p-3 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Batch Enqueue</label>
            <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={bulkEnqueueFromTemplates}>
              <Layers className="h-3 w-3 mr-1" />
              Enqueue 5 Templates (partial)
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[10px]"
              onClick={() => {
                const templateJobs = JOB_TEMPLATES.slice(0, 5).map((t) => t.spec)
                // Inject one bad job to test atomic rollback
                templateJobs[2] = { ...templateJobs[2]!, type: '' }
                const result = simulateBulkEnqueue({ atomicity: 'atomic', jobs: templateJobs })
                setBulkResult(result)
              }}
            >
              <Layers className="h-3 w-3 mr-1" />
              Enqueue 5 Templates (atomic — with 1 invalid)
            </Button>
          </div>

          {bulkResult && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Result</label>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-md border p-1.5 text-center">
                  <div className="text-sm font-bold">{bulkResult.succeeded + bulkResult.failed}</div>
                  <div className="text-[9px] text-muted-foreground">Total</div>
                </div>
                <div className="rounded-md border p-1.5 text-center">
                  <div className="text-sm font-bold text-green-500">{bulkResult.succeeded}</div>
                  <div className="text-[9px] text-muted-foreground">Succeeded</div>
                </div>
                <div className="rounded-md border p-1.5 text-center">
                  <div className="text-sm font-bold text-red-500">{bulkResult.failed}</div>
                  <div className="text-[9px] text-muted-foreground">Failed</div>
                </div>
              </div>
              <div className="rounded-md border max-h-32 overflow-auto">
                {bulkResult.items.map((item) => (
                  <div key={item.index} className="flex items-center gap-2 px-2 py-0.5 text-[10px] border-b last:border-b-0">
                    <span className="w-5 text-muted-foreground">#{item.index}</span>
                    <Badge variant={item.status === 'created' ? 'default' : 'destructive'} className="text-[9px] h-3.5 px-1">
                      {item.status}
                    </Badge>
                    {item.jobId && <span className="font-mono text-muted-foreground truncate">{item.jobId.slice(0, 16)}…</span>}
                    {item.error && <span className="text-destructive/80 truncate">{item.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-1">
            <div className="font-medium">Bulk Operations (ojs-bulk-operations.md)</div>
            <div><strong>Partial:</strong> Best-effort, per-item results (200/207)</div>
            <div><strong>Atomic:</strong> All-or-nothing, rollback on any failure (422)</div>
            <div>Max batch size: 1,000 items</div>
            <div>Idempotency keys cached for 24 hours</div>
          </div>
        </div>
      ) : (
        /* DLQ Section */
        <>
          <div className="flex items-center gap-2 border-b px-3 py-1.5">
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setScenario('dead_letter'); setTimeout(() => { recompute(); setTimeout(addToDLQ, 50) }, 0) }}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              Simulate DLQ
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={addToDLQ} disabled={deadLetterEvents.length === 0}>
              Capture Failed
            </Button>
            <div className="flex-1" />
            {selectedCount > 0 && (
              <>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={bulkReplay}>
                  <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                  Replay ({selectedCount})
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={bulkPurge}>
                  <Trash2 className="h-2.5 w-2.5 mr-0.5" />
                  Purge ({selectedCount})
                </Button>
              </>
            )}
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-6 rounded border bg-background px-1.5 text-[10px]">
              <option value="all">All ({entries.length})</option>
              <option value="pending">Pending ({pendingCount})</option>
              <option value="replayed">Replayed ({entries.filter((e) => e.status === 'replayed').length})</option>
            </select>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredEntries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground p-4">
                <Archive className="h-8 w-8 opacity-30" />
                <p className="text-xs text-center">
                  {entries.length === 0
                    ? 'No dead-lettered jobs yet. Run a "Dead letter queue" simulation, then click "Capture Failed".'
                    : 'No entries match the current filter.'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {/* Select all header */}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 text-[10px]">
                    <button onClick={selectAll} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                      {entries.filter((e) => e.status === 'pending').every((e) => e.selected)
                        ? <CheckSquare className="h-3 w-3" />
                        : <Square className="h-3 w-3" />}
                      Select all pending
                    </button>
                  </div>
                )}
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className={`px-3 py-2 text-xs ${entry.status === 'purged' ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {entry.status === 'pending' && (
                          <button onClick={() => toggleSelect(entry.id)}>
                            {entry.selected ? <CheckSquare className="h-3 w-3 text-primary" /> : <Square className="h-3 w-3 text-muted-foreground" />}
                          </button>
                        )}
                        <span className="font-mono font-medium">{entry.jobType}</span>
                        <Badge variant={entry.status === 'pending' ? 'destructive' : entry.status === 'replayed' ? 'default' : 'secondary'} className="text-[9px] h-3.5 px-1">
                          {entry.status}
                        </Badge>
                      </div>
                      {entry.status === 'pending' && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]" onClick={() => replayEntry(entry.id)}>
                            <RotateCcw className="h-2.5 w-2.5 mr-0.5" />Replay
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-muted-foreground" onClick={() => purgeEntry(entry.id)}>
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-muted-foreground">
                      <div className="flex gap-3">
                        <span>Queue: {entry.queue}</span>
                        <span>Attempts: {entry.retryCount}</span>
                        <span>Failed at: {formatDuration(entry.failedAt)}</span>
                      </div>
                      <div className="text-destructive/80">[{entry.errorType}] {entry.error}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            Retention: 6 months / 10,000 jobs max • {entries.length} entries
          </div>
        </>
      )}
    </div>
  )
}
