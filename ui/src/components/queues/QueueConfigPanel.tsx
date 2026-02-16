import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Settings, Plus, Trash2, Play, Pause, Archive } from 'lucide-react'
import type { QueueConfigPolicy } from '@/engine/types'

interface QueueEntry {
  name: string
  state: 'active' | 'paused' | 'draining'
  config: QueueConfigPolicy
  stats: { pending: number; active: number; completed: number; discarded: number }
}

const DEFAULT_QUEUES: QueueEntry[] = [
  {
    name: 'default',
    state: 'active',
    config: {
      max_size: 10000,
      overflow_policy: 'reject',
      concurrency: 50,
      default_timeout: 30,
      retention: { completed: 'P7D', discarded: 'P30D', cancelled: 'P7D' },
      dead_letter_queue: '_dead_letter',
      dead_letter_ttl: 'P30D',
    },
    stats: { pending: 45, active: 12, completed: 1580, discarded: 3 },
  },
  {
    name: 'email',
    state: 'active',
    config: {
      max_size: 5000,
      overflow_policy: 'reject',
      concurrency: 20,
      default_timeout: 60,
      retention: { completed: 'P7D', discarded: 'P30D', cancelled: 'P7D' },
      dead_letter_queue: '_dead_letter',
      allowed_job_types: ['email.send', 'email.send_template'],
    },
    stats: { pending: 12, active: 8, completed: 430, discarded: 1 },
  },
  {
    name: 'webhooks',
    state: 'active',
    config: {
      max_size: 20000,
      overflow_policy: 'drop_oldest',
      concurrency: 100,
      default_timeout: 30,
      retention: { completed: 'P3D', discarded: 'P30D', cancelled: 'P3D' },
      dead_letter_queue: 'webhooks_dlq',
      dead_letter_ttl: 'P90D',
    },
    stats: { pending: 180, active: 45, completed: 8920, discarded: 22 },
  },
]

const stateBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  paused: 'secondary',
  draining: 'destructive',
}

export function QueueConfigPanel() {
  const [queues, setQueues] = useState<QueueEntry[]>(DEFAULT_QUEUES)
  const [selectedQueue, setSelectedQueue] = useState<string>('default')
  const [newQueueName, setNewQueueName] = useState('')

  const selected = queues.find((q) => q.name === selectedQueue)

  const updateConfig = (name: string, updates: Partial<QueueConfigPolicy>) => {
    setQueues((prev) =>
      prev.map((q) =>
        q.name === name ? { ...q, config: { ...q.config, ...updates } } : q,
      ),
    )
  }

  const toggleState = (name: string) => {
    setQueues((prev) =>
      prev.map((q) => {
        if (q.name !== name) return q
        const nextState = q.state === 'active' ? 'paused' : 'active'
        return { ...q, state: nextState }
      }),
    )
  }

  const addQueue = () => {
    const trimmed = newQueueName.trim()
    if (!trimmed || queues.some((q) => q.name === trimmed)) return
    setQueues((prev) => [
      ...prev,
      {
        name: trimmed,
        state: 'active',
        config: {
          max_size: 10000,
          overflow_policy: 'reject',
          concurrency: 50,
          default_timeout: 30,
          retention: { completed: 'P7D', discarded: 'P30D', cancelled: 'P7D' },
          dead_letter_queue: '_dead_letter',
        },
        stats: { pending: 0, active: 0, completed: 0, discarded: 0 },
      },
    ])
    setNewQueueName('')
    setSelectedQueue(trimmed)
  }

  const removeQueue = (name: string) => {
    if (queues.length <= 1) return
    setQueues((prev) => prev.filter((q) => q.name !== name))
    if (selectedQueue === name) {
      setSelectedQueue(queues[0]!.name)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Queue Config</span>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {queues.length} queues
        </Badge>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Queue list */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Queues</label>
          <div className="space-y-1">
            {queues.map((q) => (
              <button
                key={q.name}
                onClick={() => setSelectedQueue(q.name)}
                className={`w-full flex items-center justify-between rounded-md border px-2 py-1.5 text-xs text-left transition-colors ${
                  selectedQueue === q.name ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${q.state === 'active' ? 'bg-green-500' : q.state === 'paused' ? 'bg-yellow-500' : 'bg-orange-500'}`} />
                  <span className="font-mono font-medium">{q.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{q.stats.pending + q.stats.active} active</span>
                  <Badge variant={stateBadgeVariant[q.state]} className="text-[9px] h-3.5 px-1">
                    {q.state}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* Add queue */}
          <div className="flex items-center gap-1.5">
            <Input
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
              placeholder="new-queue"
              className="h-6 text-[10px] font-mono"
              onKeyDown={(e) => e.key === 'Enter' && addQueue()}
            />
            <Button size="sm" variant="outline" className="h-6 px-2" onClick={addQueue} disabled={!newQueueName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Selected queue config */}
        {selected && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{selected.name} Configuration</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5"
                  onClick={() => toggleState(selected.name)}
                  title={selected.state === 'active' ? 'Pause queue' : 'Resume queue'}
                >
                  {selected.state === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1.5 text-muted-foreground"
                  onClick={() => removeQueue(selected.name)}
                  disabled={queues.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-1.5">
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-sm font-bold">{selected.stats.pending}</div>
                <div className="text-[9px] text-muted-foreground">Pending</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-sm font-bold text-blue-500">{selected.stats.active}</div>
                <div className="text-[9px] text-muted-foreground">Active</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-sm font-bold text-green-500">{selected.stats.completed}</div>
                <div className="text-[9px] text-muted-foreground">Done</div>
              </div>
              <div className="rounded-md border p-1.5 text-center">
                <div className="text-sm font-bold text-red-500">{selected.stats.discarded}</div>
                <div className="text-[9px] text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Capacity</label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Max Size</span>
                  <Input
                    type="number"
                    value={selected.config.max_size ?? 10000}
                    onChange={(e) => updateConfig(selected.name, { max_size: Number(e.target.value) })}
                    className="h-5 w-20 text-[10px] text-right font-mono"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Concurrency</span>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[selected.config.concurrency ?? 50]}
                      min={1}
                      max={200}
                      step={1}
                      onValueChange={([v]) => updateConfig(selected.name, { concurrency: v })}
                      className="w-24"
                    />
                    <span className="text-[10px] font-mono w-6 text-right">{selected.config.concurrency ?? 50}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Overflow</span>
                  <select
                    value={selected.config.overflow_policy ?? 'reject'}
                    onChange={(e) => updateConfig(selected.name, { overflow_policy: e.target.value as 'reject' | 'drop_oldest' | 'block' })}
                    className="h-5 rounded border bg-background px-1 text-[10px]"
                  >
                    <option value="reject">Reject (429)</option>
                    <option value="drop_oldest">Drop Oldest</option>
                    <option value="block">Block</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">Default Timeout</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={selected.config.default_timeout ?? 30}
                      onChange={(e) => updateConfig(selected.name, { default_timeout: Number(e.target.value) })}
                      className="h-5 w-14 text-[10px] text-right font-mono"
                    />
                    <span className="text-[10px] text-muted-foreground">s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dead Letter */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Archive className="h-3 w-3 text-orange-500" />
                <label className="text-xs font-medium text-muted-foreground">Dead Letter</label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">DLQ Name</span>
                  <Input
                    value={selected.config.dead_letter_queue ?? '_dead_letter'}
                    onChange={(e) => updateConfig(selected.name, { dead_letter_queue: e.target.value })}
                    className="h-5 w-28 text-[10px] font-mono"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]">DLQ TTL</span>
                  <select
                    value={selected.config.dead_letter_ttl ?? 'P30D'}
                    onChange={(e) => updateConfig(selected.name, { dead_letter_ttl: e.target.value })}
                    className="h-5 rounded border bg-background px-1 text-[10px]"
                  >
                    <option value="P7D">7 days</option>
                    <option value="P30D">30 days</option>
                    <option value="P90D">90 days</option>
                    <option value="P180D">180 days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Retention */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Retention</label>
              <div className="space-y-2">
                {(['completed', 'discarded', 'cancelled'] as const).map((state) => (
                  <div key={state} className="flex items-center justify-between">
                    <span className="text-[10px] capitalize">{state}</span>
                    <select
                      value={selected.config.retention?.[state] ?? 'P7D'}
                      onChange={(e) =>
                        updateConfig(selected.name, {
                          retention: { ...selected.config.retention, [state]: e.target.value },
                        })
                      }
                      className="h-5 rounded border bg-background px-1 text-[10px]"
                    >
                      <option value="P1D">1 day</option>
                      <option value="P3D">3 days</option>
                      <option value="P7D">7 days</option>
                      <option value="P14D">14 days</option>
                      <option value="P30D">30 days</option>
                      <option value="P90D">90 days</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Allowed Job Types */}
            {selected.config.allowed_job_types && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Allowed Types</label>
                <div className="flex flex-wrap gap-1">
                  {selected.config.allowed_job_types.map((t) => (
                    <Badge key={t} variant="outline" className="text-[9px] font-mono">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Spec reference */}
        <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-1">
          <div className="font-medium">Queue Configuration (ojs-queue-config.md)</div>
          <div>States: active → paused → draining → deleted</div>
          <div>Default policy via <code className="bg-muted px-0.5 rounded">_default</code> virtual queue</div>
          <div>Layered: system → _default → queue → job-level</div>
        </div>
      </div>
    </div>
  )
}
