import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled'

interface ConformanceRun {
  id: string
  status: RunStatus
  level: number
  started_at: string
  ended_at?: string
  results?: {
    total: number
    passed: number
    failed: number
    runner_errors?: number
    backend_failures?: number
    error?: string
    message?: string
  }
}

interface ActiveRun {
  generation: number
  runId?: string
  controller: AbortController
  pollTimer?: ReturnType<typeof setTimeout>
  safetyTimer?: ReturnType<typeof setTimeout>
}

const POLL_INTERVAL_MS = 500
const RUN_TIMEOUT_MS = 30_000

export function ConformanceRunnerPanel() {
  const isLocalMode = useStore((s) => s.isLocalMode)
  const localUrl = useStore((s) => s.localUrl)
  const [runs, setRuns] = useState<ConformanceRun[]>([])
  const [running, setRunning] = useState(false)
  const activeRef = useRef<ActiveRun | null>(null)
  const generationRef = useRef(0)

  const clearActiveRun = useCallback((generation?: number, runId?: string) => {
    const active = activeRef.current
    if (!active) return false
    if (generation !== undefined && active.generation !== generation) return false
    if (runId !== undefined && active.runId !== runId) return false

    if (active.pollTimer !== undefined) clearTimeout(active.pollTimer)
    if (active.safetyTimer !== undefined) clearTimeout(active.safetyTimer)
    active.controller.abort()
    activeRef.current = null
    return true
  }, [])

  const finishRun = useCallback((
    generation: number,
    runId: string,
    message?: { type: 'success' | 'error'; text: string },
  ) => {
    if (!clearActiveRun(generation, runId)) return
    setRunning(false)
    if (message?.type === 'success') toast.success(message.text)
    else if (message) toast.error(message.text)
  }, [clearActiveRun])

  useEffect(() => {
    generationRef.current++
    if (clearActiveRun()) setRunning(false)
  }, [clearActiveRun, localUrl])

  useEffect(() => () => {
    generationRef.current++
    clearActiveRun()
  }, [clearActiveRun])

  const startRun = useCallback(async () => {
    generationRef.current++
    clearActiveRun()
    const generation = generationRef.current
    const controller = new AbortController()
    const active: ActiveRun = { generation, controller }
    activeRef.current = active
    setRunning(true)

    const isCurrent = (runId?: string) => {
      const current = activeRef.current
      return current?.generation === generation && (runId === undefined || current.runId === runId)
    }

    try {
      const response = await fetch(`${localUrl}/api/conformance/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 0 }),
        signal: controller.signal,
      })
      if (!isCurrent()) return
      if (!response.ok) {
        const message = await readServerError(response)
        if (isCurrent()) {
          clearActiveRun(generation)
          setRunning(false)
          toast.error(message)
        }
        return
      }

      const data = await response.json()
      if (!isCurrent()) return
      const run = data.run as ConformanceRun
      if (!run?.id || run.status !== 'running') {
        clearActiveRun(generation)
        setRunning(false)
        toast.error('Server returned an invalid conformance run')
        return
      }

      active.runId = run.id
      setRuns((previous) => [run, ...previous])

      const poll = async (): Promise<void> => {
        if (!isCurrent(run.id)) return
        try {
          const pollResponse = await fetch(`${localUrl}/api/conformance/run/${run.id}`, {
            signal: controller.signal,
          })
          if (!isCurrent(run.id)) return
          if (!pollResponse.ok) {
            finishRun(generation, run.id, {
              type: 'error',
              text: await readServerError(pollResponse),
            })
            return
          }

          const pollData = await pollResponse.json()
          if (!isCurrent(run.id)) return
          const updated = pollData.run as ConformanceRun
          if (!updated || updated.id !== run.id) return
          setRuns((previous) => previous.map((item) => item.id === run.id ? updated : item))

          if (updated.status !== 'running') {
            const runnerErrors = updated.results?.runner_errors ?? 0
            const backendFailures = updated.results?.backend_failures ?? 0
            const failureMessage = runnerErrors > 0
              ? `Runner could not evaluate ${runnerErrors} test${runnerErrors === 1 ? '' : 's'}`
              : `Backend failed ${backendFailures || updated.results?.failed || 0} conformance test${(backendFailures || updated.results?.failed) === 1 ? '' : 's'}`
            finishRun(generation, run.id, {
              type: updated.status === 'completed' ? 'success' : 'error',
              text: updated.status === 'completed' ? 'Conformance run completed' : failureMessage,
            })
            return
          }

          const current = activeRef.current
          if (current?.generation === generation && current.runId === run.id) {
            current.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          finishRun(generation, run.id, {
            type: 'error',
            text: 'Conformance polling failed. Start a new run to retry.',
          })
        }
      }

      active.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
      active.safetyTimer = setTimeout(() => {
        finishRun(generation, run.id, {
          type: 'error',
          text: 'Conformance run timed out. Start a new run to retry.',
        })
      }, RUN_TIMEOUT_MS)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (clearActiveRun(generation)) {
        setRunning(false)
        toast.error('Failed to connect to the conformance server')
      }
    }
  }, [clearActiveRun, finishRun, localUrl])

  if (!isLocalMode) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <p>Conformance runner requires Local Mode</p>
          <p className="text-[10px]">Run <code className="bg-muted px-1 rounded">npx ojs-playground dev</code> to enable</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Conformance Runner</span>
        <Button
          size="sm"
          className="h-9 gap-1 text-xs"
          onClick={startRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-3 w-3" aria-hidden="true" />
          )}
          {running ? 'Running…' : 'Run Tests'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {runs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Select “Run Tests” to start a conformance check
          </div>
        ) : (
          <div className="divide-y">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

async function readServerError(response: Response): Promise<string> {
  try {
    const data = await response.json()
    const message = data?.error?.message
    if (typeof message === 'string' && message.length <= 500) return message
  } catch {
    // Use the status fallback below.
  }
  return `Conformance request failed (${response.status})`
}

function RunCard({ run }: { run: ConformanceRun }) {
  const StatusIcon = run.status === 'completed' ? CheckCircle2 :
    run.status === 'running' ? Loader2 : XCircle
  const statusColor = run.status === 'completed' ? 'text-green-500' :
    run.status === 'running' ? 'text-yellow-500' : 'text-red-500'

  const results = run.results
  const runnerErrors = results?.runner_errors ?? 0
  const backendFailures = results?.backend_failures ?? Math.max(0, (results?.failed ?? 0) - runnerErrors)
  const passRate = results && results.total > 0
    ? Math.round((results.passed / results.total) * 100)
    : 0

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`h-4 w-4 ${statusColor} ${run.status === 'running' ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span className="text-xs font-medium">Level {run.level} Test Run</span>
        </div>
        <Badge
          variant={run.status === 'completed' ? 'secondary' : run.status === 'running' ? 'outline' : 'destructive'}
          className="h-5 text-[10px]"
        >
          {run.status}
        </Badge>
      </div>

      {results && (
        <>
          <Progress value={passRate} className="h-1.5" />
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>Total: <strong className="text-foreground">{results.total}</strong></span>
            <span>Passed: <strong className="text-green-500">{results.passed}</strong></span>
            <span>Failed: <strong className="text-red-500">{results.failed}</strong></span>
          </div>
          {results.failed > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              <span>Backend failures: <strong className="text-red-500">{backendFailures}</strong></span>
              <span>Runner errors: <strong className={runnerErrors > 0 ? 'text-amber-500' : 'text-foreground'}>{runnerErrors}</strong></span>
            </div>
          )}
          {runnerErrors > 0 && (
            <div className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-700 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              Runner errors mean the playground could not evaluate suite semantics; they are not backend conformance failures.
            </div>
          )}
          {(results.message || results.error) && (
            <div className="flex items-start gap-1.5 rounded bg-muted p-2 text-[10px] text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {results.message || results.error}
            </div>
          )}
        </>
      )}

      <div className="text-[10px] text-muted-foreground">
        {run.id.slice(0, 8)}… · {new Intl.DateTimeFormat(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(run.started_at))}
      </div>
    </div>
  )
}
