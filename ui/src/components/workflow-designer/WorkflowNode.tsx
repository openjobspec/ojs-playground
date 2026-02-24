import type { WorkflowNode as WorkflowNodeType } from '@/engine/workflow-designer'

const nodeStyles: Record<WorkflowNodeType['type'], { bg: string; border: string; icon: string }> = {
  job: { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-400', icon: '⚙' },
  chain: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-400', icon: '→' },
  group: { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-400', icon: '⑂' },
  batch: { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-400', icon: '⑃' },
  callback: { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-400', icon: '↩' },
}

interface WorkflowNodeProps {
  node: WorkflowNodeType
  selected: boolean
  hasError: boolean
  errorMessage?: string
  onSelect: (id: string) => void
  onDragStart: (id: string, e: React.MouseEvent) => void
}

export function WorkflowNodeComponent({
  node,
  selected,
  hasError,
  errorMessage,
  onSelect,
  onDragStart,
}: WorkflowNodeProps) {
  const style = nodeStyles[node.type] ?? nodeStyles.job

  const borderClass = hasError
    ? 'border-red-500 border-2'
    : selected
      ? 'border-primary border-2 ring-2 ring-primary/30'
      : `border ${style.border}`

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      className="cursor-pointer"
      onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
      onMouseDown={(e) => { if (e.button === 0) onDragStart(node.id, e) }}
    >
      <foreignObject width={160} height={60} overflow="visible">
        <div
          className={`
            rounded-lg border px-3 py-2 text-xs shadow-sm select-none
            transition-all duration-150
            ${style.bg} ${borderClass}
          `}
          title={hasError ? errorMessage : undefined}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{style.icon}</span>
            <span className="font-medium truncate">{node.label || node.jobType}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {node.jobType}{node.queue ? ` · ${node.queue}` : ''}
          </div>
        </div>
      </foreignObject>
    </g>
  )
}
