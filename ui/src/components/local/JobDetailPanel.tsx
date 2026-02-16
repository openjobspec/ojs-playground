import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RefreshCw, ChevronRight, ArrowLeft, Clock } from 'lucide-react'
import type { LocalJob } from '@/store/slices/local'

const stateVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  available: 'outline',
  scheduled: 'outline',
  pending: 'outline',
  active: 'default',
  completed: 'secondary',
  retryable: 'destructive',
  cancelled: 'destructive',
  discarded: 'destructive',
}

interface JobHistory {
  from_state: string
  to_state: string
  timestamp: string
  reason?: string
}

interface JobDetailData {
  id: string
  type: string
  state: string
  queue: string
  args: unknown
  meta?: unknown
  priority: number
  attempt: number
  max_attempts: number
  created_at: string
  started_at?: string
  completed_at?: string
  result?: unknown
  error?: unknown
}

export function JobDetailPanel() {
  const isLocalMode = useStore((s) => s.isLocalMode)
  const localUrl = useStore((s) => s.localUrl)
  const recentJobs = useStore((s) => s.recentJobs)
  const addRecentJob = useStore((s) => s.addRecentJob)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${localUrl}/api/jobs?limit=50`)
      if (!res.ok) return
      const data = await res.json()
      for (const j of data.jobs ?? []) {
        addRecentJob({
          id: j.id,
          type: j.type,
          queue: j.queue,
          state: j.state,
          createdAt: j.created_at,
          completedAt: j.completed_at,
        })
      }
    } catch {
      // server not reachable
    }
  }, [localUrl, addRecentJob])

  useEffect(() => {
    if (!isLocalMode) return
    fetchJobs()
    const interval = setInterval(fetchJobs, 3000)
    return () => clearInterval(interval)
  }, [isLocalMode, fetchJobs])

  if (!isLocalMode) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <p>Job detail requires Local Mode</p>
          <p className="text-[10px]">Run <code className="bg-muted px-1 rounded">npx ojs-playground dev</code> to enable</p>
        </div>
      </div>
    )
  }

  if (selectedJob) {
    return <JobDetail jobId={selectedJob} localUrl={localUrl} onBack={() => setSelectedJob(null)} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Recent Jobs</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-5 text-[10px]">
            {recentJobs.length}
          </Badge>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchJobs}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {recentJobs.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No jobs yet — enqueue one to see it here
          </div>
        ) : (
          <div className="divide-y">
            {recentJobs.map((job) => (
              <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job.id)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function JobRow({ job, onClick }: { job: LocalJob; onClick: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between p-2.5 text-left hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium truncate">{job.type}</span>
          <Badge variant={stateVariant[job.state] ?? 'outline'} className="h-4 text-[9px] px-1">
            {job.state}
          </Badge>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {job.id.slice(0, 8)}… · {job.queue}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </button>
  )
}

function JobDetail({
  jobId,
  localUrl,
  onBack,
}: {
  jobId: string
  localUrl: string
  onBack: () => void
}) {
  const [job, setJob] = useState<JobDetailData | null>(null)
  const [history, setHistory] = useState<JobHistory[]>([])

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [jobRes, histRes] = await Promise.all([
          fetch(`${localUrl}/api/jobs/${jobId}`),
          fetch(`${localUrl}/api/jobs/${jobId}/history`),
        ])
        if (jobRes.ok) {
          const d = await jobRes.json()
          setJob(d.job ?? null)
        }
        if (histRes.ok) {
          const d = await histRes.json()
          setHistory(d.history ?? [])
        }
      } catch {
        // server not reachable
      }
    }
    fetchDetail()
  }, [jobId, localUrl])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-sm font-medium truncate">
          {job?.type ?? 'Loading...'}
        </span>
        {job && (
          <Badge variant={stateVariant[job.state] ?? 'outline'} className="h-5 text-[10px]">
            {job.state}
          </Badge>
        )}
      </div>
      <ScrollArea className="flex-1">
        {!job ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Loading job details...
          </div>
        ) : (
          <div className="space-y-3 p-3">
            <Section title="Info">
              <InfoRow label="ID" value={job.id} />
              <InfoRow label="Type" value={job.type} />
              <InfoRow label="Queue" value={job.queue} />
              <InfoRow label="Priority" value={String(job.priority)} />
              <InfoRow label="Attempt" value={`${job.attempt} / ${job.max_attempts}`} />
              <InfoRow label="Created" value={formatTime(job.created_at)} />
              {job.started_at && <InfoRow label="Started" value={formatTime(job.started_at)} />}
              {job.completed_at && <InfoRow label="Completed" value={formatTime(job.completed_at)} />}
            </Section>

            {job.args !== undefined && (
              <Section title="Args">
                <pre className="text-[10px] bg-muted rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(job.args, null, 2)}
                </pre>
              </Section>
            )}

            {job.result !== undefined && (
              <Section title="Result">
                <pre className="text-[10px] bg-muted rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              </Section>
            )}

            {job.error !== undefined && (
              <Section title="Error">
                <pre className="text-[10px] bg-destructive/10 text-destructive rounded p-2 overflow-auto max-h-32">
                  {JSON.stringify(job.error, null, 2)}
                </pre>
              </Section>
            )}

            {history.length > 0 && (
              <Section title="State History">
                <div className="space-y-1.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <Badge variant="outline" className="h-4 text-[9px] px-1">
                        {h.from_state || '∅'}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="h-4 text-[9px] px-1">
                        {h.to_state}
                      </Badge>
                      <span className="text-muted-foreground ml-auto">
                        {formatTime(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}
