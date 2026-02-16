import { useState, useCallback } from 'react'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ConformanceRun {
  id: string
  status: 'running' | 'completed' | 'failed'
  level: number
  started_at: string
  ended_at?: string
  results?: {
    total: number
    passed: number
    failed: number
    message?: string
  }
}

export function ConformanceRunnerPanel() {
  const isLocalMode = useStore((s) => s.isLocalMode)
  const localUrl = useStore((s) => s.localUrl)
  const [runs, setRuns] = useState<ConformanceRun[]>([])
  const [running, setRunning] = useState(false)

  const startRun = useCallback(async () => {
    setRunning(true)
    try {
      const res = await fetch(`${localUrl}/api/conformance/run`, { method: 'POST' })
      if (!res.ok) {
        toast.error('Failed to start conformance run')
        setRunning(false)
        return
      }
      const data = await res.json()
      const run = data.run as ConformanceRun
      setRuns((prev) => [run, ...prev])

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${localUrl}/api/conformance/run/${run.id}`)
          if (!pollRes.ok) return
          const pollData = await pollRes.json()
          const updated = pollData.run as ConformanceRun
          setRuns((prev) => prev.map((r) => r.id === updated.id ? updated : r))
          if (updated.status !== 'running') {
            clearInterval(pollInterval)
            setRunning(false)
            toast.success(`Conformance run ${updated.status}`)
          }
        } catch {
          clearInterval(pollInterval)
          setRunning(false)
        }
      }, 500)

      // Safety timeout
      setTimeout(() => {
        clearInterval(pollInterval)
        setRunning(false)
      }, 30000)
    } catch {
      toast.error('Failed to connect to server')
      setRunning(false)
    }
  }, [localUrl])

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
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Conformance Runner</span>
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={startRun}
          disabled={running}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {running ? 'Running...' : 'Run Tests'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {runs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Click "Run Tests" to start a conformance check
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

function RunCard({ run }: { run: ConformanceRun }) {
  const StatusIcon = run.status === 'completed' ? CheckCircle2 :
                     run.status === 'failed' ? XCircle : Loader2
  const statusColor = run.status === 'completed' ? 'text-green-500' :
                      run.status === 'failed' ? 'text-red-500' : 'text-yellow-500'

  const results = run.results
  const passRate = results && results.total > 0
    ? Math.round((results.passed / results.total) * 100)
    : 0

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusColor} ${run.status === 'running' ? 'animate-spin' : ''}`} />
          <span className="text-xs font-medium">Level {run.level} Test Run</span>
        </div>
        <Badge
          variant={run.status === 'completed' ? 'secondary' : run.status === 'failed' ? 'destructive' : 'outline'}
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
          {results.message && (
            <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted rounded p-2">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              {results.message}
            </div>
          )}
        </>
      )}

      <div className="text-[10px] text-muted-foreground">
        {run.id.slice(0, 8)}… · {new Date(run.started_at).toLocaleTimeString()}
      </div>
    </div>
  )
}
