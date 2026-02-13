import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store'
import { ALL_STATES, TERMINAL_STATES, VALID_TRANSITIONS } from '@/engine/constants'
import type { JobState } from '@/engine/types'
import { StateMachineNode } from './StateMachineNode'
import { useTheme } from '@/hooks/useTheme'

const nodeTypes = { stateNode: StateMachineNode }

// Manual layout positions for the 8-state diagram
const positions: Record<JobState, { x: number; y: number }> = {
  scheduled: { x: 0, y: 0 },
  pending: { x: 250, y: 0 },
  available: { x: 125, y: 100 },
  active: { x: 125, y: 200 },
  completed: { x: 0, y: 320 },
  retryable: { x: 250, y: 320 },
  cancelled: { x: -125, y: 320 },
  discarded: { x: 375, y: 320 },
}

// State info displayed when clicking a state node
const STATE_INFO: Record<JobState, { fields: string; enters: string; exits: string }> = {
  scheduled: { fields: 'scheduled_at', enters: 'Job created with future scheduled_at', exits: 'Scheduled time arrives → available' },
  available: { fields: 'queue, priority', enters: 'Enqueued or schedule fires', exits: 'Worker claims → active' },
  pending: { fields: 'External activation required', enters: 'Job created with pending flag', exits: 'External activation → available' },
  active: { fields: 'timeout, attempt', enters: 'Worker claims from queue', exits: 'Success → completed, Error → retryable/discarded, Cancel → cancelled' },
  completed: { fields: 'result, completed_at', enters: 'Handler succeeded', exits: 'Terminal state' },
  retryable: { fields: 'retry policy, error', enters: 'Handler failed, retries remain', exits: 'Backoff expires → available' },
  cancelled: { fields: 'cancelled_at', enters: 'Job cancelled during execution', exits: 'Terminal state' },
  discarded: { fields: 'error, on_exhaustion', enters: 'Max attempts exceeded or non-retryable error', exits: 'Manual retry → available' },
}

function getRelevantStates(job: Record<string, unknown> | null): Set<JobState> {
  const relevant = new Set<JobState>(['available', 'active', 'completed'])
  if (!job) return new Set(ALL_STATES)
  if (job.scheduled_at) relevant.add('scheduled')
  if (job.retry) {
    relevant.add('retryable')
    relevant.add('discarded')
  }
  relevant.add('cancelled')
  relevant.add('pending')
  if (!job.retry) relevant.add('discarded')
  return relevant
}

export function StateMachine() {
  const activeState = useStore((s) => s.activeState)
  const simulationResult = useStore((s) => s.simulationResult)
  const activeEventIndex = useStore((s) => s.activeEventIndex)
  const parsedJob = useStore((s) => s.parsedJob)
  const { resolvedTheme } = useTheme()
  const [selectedState, setSelectedState] = useState<JobState | null>(null)

  const relevantStates = useMemo(
    () => getRelevantStates(parsedJob as unknown as Record<string, unknown>),
    [parsedJob],
  )

  // Determine which states have been visited
  const visitedStates = useMemo(() => {
    if (!simulationResult || activeEventIndex < 0) return new Set<string>()
    const visited = new Set<string>()
    for (let i = 0; i <= activeEventIndex; i++) {
      const event = simulationResult.events[i]
      if (event) visited.add(event.to)
    }
    return visited
  }, [simulationResult, activeEventIndex])

  // Active edge (the last transition that happened)
  const activeEdge = useMemo(() => {
    if (!simulationResult || activeEventIndex < 0) return null
    const event = simulationResult.events[activeEventIndex]
    if (!event || event.from === 'initial') return null
    return `${event.from}-${event.to}`
  }, [simulationResult, activeEventIndex])

  const handleNodeClick = useCallback((_: unknown, node: { id: string }) => {
    setSelectedState((prev) => (prev === node.id ? null : node.id) as JobState | null)
  }, [])

  const nodes: Node[] = useMemo(
    () =>
      ALL_STATES.map((state) => ({
        id: state,
        type: 'stateNode',
        position: positions[state],
        data: {
          label: state.charAt(0).toUpperCase() + state.slice(1),
          state,
          isActive: activeState === state,
          isTerminal: TERMINAL_STATES.has(state),
          isSelected: selectedState === state,
          isDimmed: !relevantStates.has(state),
        },
        draggable: false,
      })),
    [activeState, selectedState, relevantStates],
  )

  const edges: Edge[] = useMemo(
    () =>
      VALID_TRANSITIONS.filter((t) => t.from !== 'initial').map((t) => {
        const id = `${t.from}-${t.to}`
        const isActive = activeEdge === id
        const isVisited =
          visitedStates.has(t.from) && visitedStates.has(t.to)

        return {
          id,
          source: t.from,
          target: t.to,
          label: t.trigger,
          type: ConnectionLineType.SmoothStep,
          animated: isActive,
          style: {
            stroke: isActive
              ? 'hsl(var(--primary))'
              : isVisited
                ? 'hsl(var(--muted-foreground))'
                : 'hsl(var(--border))',
            strokeWidth: isActive ? 2.5 : 1.5,
            opacity: isActive ? 1 : isVisited ? 0.8 : 0.4,
          },
          labelStyle: {
            fontSize: 10,
            fill: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
          },
          labelBgStyle: {
            fill: resolvedTheme === 'dark' ? 'hsl(240, 10%, 3.9%)' : 'hsl(0, 0%, 100%)',
          },
        }
      }),
    [activeEdge, visitedStates, resolvedTheme],
  )

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={handleNodeClick}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
      >
        <Background gap={20} size={1} />
      </ReactFlow>

      {/* State detail popover */}
      {selectedState && (
        <div className="absolute bottom-2 left-2 right-2 z-10 rounded-md border bg-popover p-2.5 text-popover-foreground shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium capitalize">{selectedState}</span>
            <button className="text-xs text-muted-foreground" onClick={() => setSelectedState(null)}>✕</button>
          </div>
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div><span className="font-medium">Fields:</span> {STATE_INFO[selectedState]?.fields}</div>
            <div><span className="font-medium">Enters:</span> {STATE_INFO[selectedState]?.enters}</div>
            <div><span className="font-medium">Exits:</span> {STATE_INFO[selectedState]?.exits}</div>
          </div>
        </div>
      )}
    </div>
  )
}
