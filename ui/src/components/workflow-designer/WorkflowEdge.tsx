import type { WorkflowEdge as WorkflowEdgeType, WorkflowNode } from '@/engine/workflow-designer'

const edgeColors: Record<WorkflowEdgeType['type'], string> = {
  sequential: '#3b82f6',    // blue
  parallel: '#f97316',      // orange
  'callback-success': '#22c55e', // green
  'callback-failure': '#ef4444', // red
}

interface WorkflowEdgeProps {
  edge: WorkflowEdgeType
  sourceNode: WorkflowNode
  targetNode: WorkflowNode
  selected: boolean
  onSelect: (id: string) => void
}

function computePath(
  sx: number, sy: number,
  tx: number, ty: number,
): string {
  // Source right-center → target left-center with cubic bezier
  const sourceX = sx + 160
  const sourceY = sy + 30
  const targetX = tx
  const targetY = ty + 30
  const dx = Math.abs(targetX - sourceX) * 0.5
  return `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`
}

export function WorkflowEdgeComponent({
  edge,
  sourceNode,
  targetNode,
  selected,
  onSelect,
}: WorkflowEdgeProps) {
  const color = edgeColors[edge.type] ?? '#888'
  const path = computePath(
    sourceNode.position.x, sourceNode.position.y,
    targetNode.position.x, targetNode.position.y,
  )

  const markerId = `arrow-${edge.id}`

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={color} />
        </marker>
      </defs>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onSelect(edge.id) }}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={edge.type === 'parallel' ? '6 3' : undefined}
        markerEnd={`url(#${markerId})`}
        className="pointer-events-none"
        opacity={selected ? 1 : 0.7}
      />
      {selected && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={6}
          opacity={0.2}
          className="pointer-events-none"
        />
      )}
    </g>
  )
}
