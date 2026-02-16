import { useEffect, useCallback } from 'react'
import { useStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Wifi, WifiOff, Trash2, PauseCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { LocalWorker } from '@/store/slices/local'

export function WorkersPanel() {
  const isLocalMode = useStore((s) => s.isLocalMode)
  const localUrl = useStore((s) => s.localUrl)
  const workers = useStore((s) => s.workers)
  const setWorkers = useStore((s) => s.setWorkers)

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`${localUrl}/api/workers`)
      if (!res.ok) return
      const data = await res.json()
      const mapped: LocalWorker[] = (data.workers ?? []).map((w: Record<string, unknown>) => ({
        id: w.id as string,
        name: (w.name as string) || (w.id as string),
        queues: (w.queues as string[]) ?? [],
        jobTypes: (w.job_types as string[]) ?? [],
        status: w.status === 'disconnected' ? 'disconnected' : 'connected',
        lastSeen: Date.now(),
      }))
      setWorkers(mapped)
    } catch {
      // server not reachable
    }
  }, [localUrl, setWorkers])

  useEffect(() => {
    if (!isLocalMode) return
    fetchWorkers()
    const interval = setInterval(fetchWorkers, 5000)
    return () => clearInterval(interval)
  }, [isLocalMode, fetchWorkers])

  if (!isLocalMode) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <p>Workers panel requires Local Mode</p>
          <p className="text-[10px]">Run <code className="bg-muted px-1 rounded">npx ojs-playground dev</code> to enable</p>
        </div>
      </div>
    )
  }

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`${localUrl}/api/workers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setWorkers(workers.filter((w) => w.id !== id))
        toast.success('Worker removed')
      }
    } catch {
      toast.error('Failed to remove worker')
    }
  }

  const handleDrain = async (id: string) => {
    try {
      const res = await fetch(`${localUrl}/api/workers/${id}/drain`, { method: 'POST' })
      if (res.ok) {
        setWorkers(workers.map((w) => w.id === id ? { ...w, status: 'disconnected' as const } : w))
        toast.success('Worker draining')
      }
    } catch {
      toast.error('Failed to drain worker')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Workers</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-5 text-[10px]">
            {workers.length} worker{workers.length !== 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={fetchWorkers}
            title="Refresh workers"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {workers.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No workers discovered yet
          </div>
        ) : (
          <div className="divide-y">
            {workers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} onRemove={handleRemove} onDrain={handleDrain} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WorkerCard({
  worker,
  onRemove,
  onDrain,
}: {
  worker: LocalWorker
  onRemove: (id: string) => void
  onDrain: (id: string) => void
}) {
  const isConnected = worker.status === 'connected'

  return (
    <div className="flex items-start justify-between p-3 gap-2">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-3 w-3 shrink-0 text-green-500" />
          ) : (
            <WifiOff className="h-3 w-3 shrink-0 text-red-500" />
          )}
          <span className="text-xs font-medium truncate">{worker.name}</span>
          <Badge
            variant={isConnected ? 'default' : 'destructive'}
            className="h-4 text-[9px] px-1"
          >
            {worker.status}
          </Badge>
        </div>
        {worker.queues.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {worker.queues.map((q) => (
              <Badge key={q} variant="outline" className="h-4 text-[9px] px-1">
                {q}
              </Badge>
            ))}
          </div>
        )}
        {worker.jobTypes.length > 0 && (
          <div className="text-[10px] text-muted-foreground truncate">
            Types: {worker.jobTypes.join(', ')}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {isConnected && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDrain(worker.id)}
            title="Drain worker (stop accepting new jobs)"
          >
            <PauseCircle className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onRemove(worker.id)}
          title="Remove worker"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
