import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { JobState } from '@/engine/types'
import { cn } from '@/lib/utils'

interface StateMachineNodeData {
  label: string
  state: JobState
  isActive: boolean
  isTerminal: boolean
  isSelected?: boolean
  isDimmed?: boolean
  [key: string]: unknown
}

const stateColorClasses: Record<JobState, string> = {
  scheduled: 'bg-ojs-scheduled',
  available: 'bg-ojs-available',
  pending: 'bg-ojs-pending',
  active: 'bg-ojs-active',
  completed: 'bg-ojs-completed',
  retryable: 'bg-ojs-retryable',
  cancelled: 'bg-ojs-cancelled',
  discarded: 'bg-ojs-discarded',
}

export const StateMachineNode = memo(function StateMachineNode({
  data,
}: NodeProps) {
  const { label, state, isActive, isTerminal, isSelected, isDimmed } = data as StateMachineNodeData
  return (
    <div
      className={cn(
        'rounded-lg border-2 px-4 py-2 text-center text-sm font-medium text-white shadow-sm transition-all cursor-pointer',
        stateColorClasses[state],
        isActive && 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110 animate-pulse',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        isTerminal && 'rounded-xl',
        isDimmed && 'opacity-30',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-2 !h-2" />
      {label}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-2 !h-2" />
    </div>
  )
})
