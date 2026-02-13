import { useState } from 'react'
import { useStore } from '@/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConformanceLevel {
  level: number
  name: string
  description: string
  capabilities: { name: string; description: string; exampleSpec?: string }[]
  backends: string[]
}

const CONFORMANCE_LEVELS: ConformanceLevel[] = [
  {
    level: 0,
    name: 'Core',
    description: 'Basic job enqueue, dequeue, and completion. The minimum to be OJS-compliant.',
    capabilities: [
      { name: 'Enqueue job', description: 'Submit a job with type, queue, and args' },
      { name: 'Dequeue job', description: 'Worker claims a job from a queue' },
      { name: 'Complete job', description: 'Mark job as completed with optional result' },
      { name: 'Fail job', description: 'Mark job as failed with error details' },
      { name: 'Get job by ID', description: 'Retrieve job status and metadata' },
    ],
    backends: ['Redis', 'Postgres', 'Kafka', 'SQS', 'NATS'],
  },
  {
    level: 1,
    name: 'Retry',
    description: 'Automatic retry with configurable backoff strategies (exponential, linear, polynomial).',
    capabilities: [
      { name: 'Retry with backoff', description: 'Exponential, linear, or polynomial backoff' },
      { name: 'Max attempts', description: 'Configure maximum retry attempts' },
      { name: 'Jitter', description: 'Randomized delay to prevent thundering herd' },
      { name: 'Non-retryable errors', description: 'Specify errors that should not trigger retry' },
      { name: 'Dead letter', description: 'Route exhausted jobs to dead letter queue' },
    ],
    backends: ['Redis', 'Postgres', 'Kafka', 'SQS', 'NATS'],
  },
  {
    level: 2,
    name: 'Scheduled',
    description: 'Delayed and scheduled job execution with future timestamps.',
    capabilities: [
      { name: 'Delayed execution', description: 'Execute job after a specified delay' },
      { name: 'Scheduled at timestamp', description: 'Execute job at a specific time (RFC 3339)' },
      { name: 'Unique jobs', description: 'Deduplicate jobs based on configurable keys' },
      { name: 'Priority queues', description: 'Higher-priority jobs are processed first' },
      { name: 'Job cancellation', description: 'Cancel pending or scheduled jobs' },
    ],
    backends: ['Redis', 'Postgres', 'Kafka', 'NATS'],
  },
  {
    level: 3,
    name: 'Workflows',
    description: 'Multi-job orchestration with chains, groups, and batch callbacks.',
    capabilities: [
      { name: 'Chain (sequential)', description: 'Execute jobs in sequence, passing results forward' },
      { name: 'Group (parallel)', description: 'Fan-out to parallel jobs, fan-in on completion' },
      { name: 'Batch (callbacks)', description: 'Execute callback when all jobs in batch complete' },
      { name: 'Workflow state tracking', description: 'Track overall workflow status' },
    ],
    backends: ['Redis', 'Postgres'],
  },
  {
    level: 4,
    name: 'Advanced',
    description: 'Middleware, rate limiting, and advanced operational features.',
    capabilities: [
      { name: 'Middleware chains', description: 'Pre/post processing hooks with next() pattern' },
      { name: 'Rate limiting', description: 'Limit job execution rate per queue or type' },
      { name: 'Job events', description: 'Real-time event streaming for job state changes' },
      { name: 'Cron scheduling', description: 'Recurring job execution on cron schedule' },
      { name: 'Batch enqueue', description: 'Submit multiple jobs atomically' },
    ],
    backends: ['Redis', 'Postgres'],
  },
]

function detectRequiredLevel(spec: Record<string, unknown>): number {
  const meta = (spec.meta ?? {}) as Record<string, unknown>
  if (meta.workflow_type || meta.middleware) return 3
  if (spec.unique || (spec.priority !== undefined && spec.priority !== 0) || spec.scheduled_at) return 2
  if (spec.retry) return 1
  return 0
}

export function ConformancePanel() {
  const [openLevels, setOpenLevels] = useState<Set<number>>(new Set([0]))
  const parsedJob = useStore((s) => s.parsedJob)
  const initFromContent = useStore((s) => s.initFromContent)

  const requiredLevel = parsedJob ? detectRequiredLevel(parsedJob as unknown as Record<string, unknown>) : 0

  const toggleLevel = (level: number) => {
    setOpenLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  const loadExample = (spec: string) => {
    if (spec) initFromContent(spec)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Conformance Levels</span>
        {parsedJob && (
          <Badge variant="outline" className="h-5 text-[10px]">
            Your spec: Level {requiredLevel}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {CONFORMANCE_LEVELS.map((level) => (
            <Collapsible
              key={level.level}
              open={openLevels.has(level.level)}
              onOpenChange={() => toggleLevel(level.level)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start h-auto py-2 px-2',
                    requiredLevel === level.level && 'bg-accent',
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-transform mr-1.5',
                      openLevels.has(level.level) && 'rotate-90',
                    )}
                  />
                  <div className="flex items-center gap-2 flex-1 text-left">
                    <Badge
                      variant={requiredLevel >= level.level ? 'default' : 'outline'}
                      className="h-5 text-[10px] shrink-0"
                    >
                      L{level.level}
                    </Badge>
                    <div>
                      <div className="text-xs font-medium">{level.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {level.description}
                      </div>
                    </div>
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-7 space-y-1.5 pb-2">
                  {level.capabilities.map((cap) => (
                    <div
                      key={cap.name}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-accent/50 cursor-default"
                    >
                      <Zap className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-medium">{cap.name}</div>
                        <div className="text-[10px] text-muted-foreground">{cap.description}</div>
                      </div>
                      {cap.exampleSpec && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[9px] ml-auto shrink-0"
                          onClick={(e) => { e.stopPropagation(); loadExample(cap.exampleSpec!) }}
                        >
                          Load
                        </Button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1 px-2 pt-1">
                    <span className="text-[9px] text-muted-foreground">Backends:</span>
                    {level.backends.map((b) => (
                      <Badge key={b} variant="outline" className="h-4 text-[9px]">{b}</Badge>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
