import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface JobState {
  id: string
  type: string
  state: string
  timestamp: string
}

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'error' | 'warn'
  message: string
}

const DEFAULT_JOB = `{
  "type": "email.send",
  "args": ["user@example.com", "welcome"],
  "queue": "default",
  "retry": {
    "max_attempts": 3,
    "backoff": "exponential"
  }
}`

const JOB_TEMPLATES: Record<string, string> = {
  'Simple Job': `{
  "type": "email.send",
  "args": ["user@example.com", "welcome"],
  "queue": "default"
}`,
  'With Retry': `{
  "type": "payment.charge",
  "args": [{"amount": 9999, "currency": "usd"}],
  "queue": "payments",
  "retry": {
    "max_attempts": 5,
    "backoff": "exponential"
  }
}`,
  'Scheduled Job': `{
  "type": "report.generate",
  "args": ["monthly", "2025-01"],
  "queue": "reports",
  "scheduled_at": "__SCHEDULED_AT__"
}`,
  'Workflow (Chain)': `{
  "workflow": "chain",
  "jobs": [
    {"type": "data.extract", "args": ["source-api"]},
    {"type": "data.transform", "args": ["normalize"]},
    {"type": "data.load", "args": ["warehouse"]}
  ]
}`,
  'Batch Enqueue': `{
  "batch": true,
  "jobs": [
    {"type": "email.send", "args": ["alice@example.com", "welcome"]},
    {"type": "email.send", "args": ["bob@example.com", "welcome"]},
    {"type": "email.send", "args": ["charlie@example.com", "welcome"]}
  ]
}`,
}

const STATE_COLORS: Record<string, string> = {
  scheduled: 'bg-violet-400 text-violet-950',
  available: 'bg-blue-400 text-blue-950',
  pending: 'bg-amber-400 text-amber-950',
  active: 'bg-orange-400 text-orange-950',
  completed: 'bg-emerald-400 text-emerald-950',
  retryable: 'bg-red-400 text-red-950',
  cancelled: 'bg-gray-400 text-gray-950',
  discarded: 'bg-red-600 text-white',
}

const LOG_COLORS: Record<string, string> = {
  info: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
  warn: 'text-amber-400',
}

export function JobIDE() {
  const [jobDefinition, setJobDefinition] = useState(DEFAULT_JOB)
  const [jobs, setJobs] = useState<JobState[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isEnqueuing, setIsEnqueuing] = useState(false)
  const [serverUrl, setServerUrl] = useState('http://localhost:8080')
  const [selectedTemplate, setSelectedTemplate] = useState('Simple Job')
  const logsEndRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toISOString().slice(11, 23), level, message },
    ])
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const simulateStateTransitions = useCallback(
    (jobId: string) => {
      const states = ['available', 'pending', 'active', 'completed']
      const delays = [0, 500, 1000, 2500]

      states.forEach((state, i) => {
        setTimeout(() => {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === jobId ? { ...j, state, timestamp: new Date().toISOString() } : j,
            ),
          )
          addLog(
            state === 'completed' ? 'success' : 'info',
            `Job ${jobId.slice(0, 12)}... → ${state}`,
          )
        }, delays[i])
      })
    },
    [addLog],
  )

  const handleEnqueue = useCallback(async () => {
    setIsEnqueuing(true)
    addLog('info', 'Enqueuing job...')

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(jobDefinition) as Record<string, unknown>
    } catch {
      addLog('error', 'Invalid JSON — check your job definition')
      setIsEnqueuing(false)
      return
    }

    try {
      const response = await fetch(`${serverUrl}/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jobDefinition,
      })

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>
        const jobId = (data.id as string) || `sim-${Date.now().toString(36)}`
        const jobType = (parsed.type as string) || 'unknown'

        addLog('success', `Job enqueued: ${jobId}`)

        const newJob: JobState = {
          id: jobId,
          type: jobType,
          state: 'available',
          timestamp: new Date().toISOString(),
        }
        setJobs((prev) => [newJob, ...prev].slice(0, 50))
        simulateStateTransitions(jobId)
      } else {
        throw new Error(`Server returned ${String(response.status)}`)
      }
    } catch {
      // Simulate in browser mode if server not available
      const jobId = `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const jobType = (parsed.type as string) || (parsed.workflow as string) || 'batch'

      addLog('warn', 'Server unavailable — simulating locally')
      addLog('success', `Job enqueued (simulated): ${jobId}`)

      const newJob: JobState = {
        id: jobId,
        type: jobType,
        state: 'available',
        timestamp: new Date().toISOString(),
      }
      setJobs((prev) => [newJob, ...prev].slice(0, 50))
      simulateStateTransitions(jobId)
    }

    setIsEnqueuing(false)
  }, [jobDefinition, serverUrl, addLog, simulateStateTransitions])

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template)
    let code = JOB_TEMPLATES[template] || DEFAULT_JOB
    code = code.replace('__SCHEDULED_AT__', new Date(Date.now() + 60000).toISOString())
    setJobDefinition(code)
  }

  return (
    <div className="flex h-full flex-col font-mono text-xs">
      <div className="grid flex-1 grid-cols-2 gap-px bg-border min-h-0">
        {/* Left: Editor */}
        <div className="flex flex-col bg-background p-3 min-h-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Job Definition</span>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="rounded border bg-muted px-2 py-1 text-[11px] text-foreground"
            >
              {Object.keys(JOB_TEMPLATES).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={jobDefinition}
            onChange={(e) => setJobDefinition(e.target.value)}
            className="flex-1 resize-none rounded border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            spellCheck={false}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => void handleEnqueue()}
              disabled={isEnqueuing}
              className={cn(
                'rounded-md px-4 py-1.5 text-xs font-bold transition-colors',
                isEnqueuing
                  ? 'cursor-wait bg-primary/50 text-primary-foreground'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {isEnqueuing ? 'Enqueuing...' : '▶ Enqueue'}
            </button>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="Server URL"
              className="flex-1 rounded border bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Right: State Transitions */}
        <div className="flex flex-col bg-background p-3 min-h-0">
          <span className="mb-2 text-xs font-semibold text-foreground">
            Job State Transitions ({jobs.length})
          </span>
          <div className="flex-1 overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="mt-10 text-center text-xs text-muted-foreground">
                Enqueue a job to see state transitions
              </div>
            ) : (
              jobs.map((job, i) => (
                <div
                  key={`${job.id}-${String(i)}`}
                  className="flex items-center gap-2 border-b py-1.5 text-[11px]"
                >
                  <span
                    className={cn(
                      'min-w-[70px] rounded px-2 py-0.5 text-center text-[10px] font-semibold',
                      STATE_COLORS[job.state] || 'bg-muted text-muted-foreground',
                    )}
                  >
                    {job.state}
                  </span>
                  <span className="text-muted-foreground">{job.type}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">
                    {job.id.slice(0, 12)}...
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Logs */}
      <div className="h-[180px] shrink-0 overflow-y-auto border-t bg-muted/30 px-3 py-2">
        <span className="mb-1 block text-[11px] font-semibold text-foreground">Execution Log</span>
        {logs.map((log, i) => (
          <div key={i} className={cn('leading-relaxed', LOG_COLORS[log.level])}>
            <span className="text-muted-foreground/50">[{log.timestamp}]</span> {log.message}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  )
}
