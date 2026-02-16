import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'

interface WorkflowStep {
  id: string
  label: string
  group?: number
}

interface WorkflowGraph {
  steps: WorkflowStep[]
  edges: { source: string; target: string }[]
  type: 'chain' | 'group' | 'batch' | 'unknown'
}

function parseWorkflow(meta: Record<string, unknown> | undefined): WorkflowGraph | null {
  if (!meta) return null

  const steps = meta.steps as string[] | undefined
  if (!Array.isArray(steps) || steps.length === 0) return null

  const workflowType = (meta.workflow_type as string) ?? 'chain'

  if (workflowType === 'chain') {
    return {
      type: 'chain',
      steps: steps.map((s, i) => ({ id: `step-${i}`, label: s })),
      edges: steps.slice(0, -1).map((_, i) => ({
        source: `step-${i}`,
        target: `step-${i + 1}`,
      })),
    }
  }

  if (workflowType === 'group' || workflowType === 'batch') {
    // Fan-out/fan-in: first step → parallel middle → last step
    const isGroup = steps.length > 2
    const firstStep = steps[0]
    const lastStep = steps[steps.length - 1]
    const parallel = steps.slice(1, -1)

    const nodes: WorkflowStep[] = [
      { id: 'step-0', label: firstStep },
      ...parallel.map((s, i) => ({ id: `step-${i + 1}`, label: s, group: 1 })),
      { id: `step-${steps.length - 1}`, label: lastStep },
    ]

    const edges: { source: string; target: string }[] = []
    if (isGroup) {
      for (let i = 0; i < parallel.length; i++) {
        edges.push({ source: 'step-0', target: `step-${i + 1}` })
        edges.push({ source: `step-${i + 1}`, target: `step-${steps.length - 1}` })
      }
    } else {
      edges.push({ source: 'step-0', target: `step-${steps.length - 1}` })
    }

    return { type: workflowType as 'group' | 'batch', steps: nodes, edges }
  }

  return null
}

function getStepStatus(stepLabel: string, completedSteps: Set<string>, activeStep: string | null): 'pending' | 'active' | 'completed' {
  if (completedSteps.has(stepLabel)) return 'completed'
  if (activeStep === stepLabel) return 'active'
  return 'pending'
}

const stepStatusStyles: Record<string, Record<string, string | number>> = {
  pending: { borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' },
  active: { borderColor: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.1)', borderWidth: 2 },
  completed: { borderColor: 'hsl(142, 71%, 45%)', background: 'hsl(142, 71%, 45%, 0.1)' },
}

function layoutNodes(graph: WorkflowGraph, completedSteps: Set<string>, activeStep: string | null): Node[] {
  const nodeWidth = 160
  const nodeHeight = 40
  const hGap = 60
  const vGap = 60

  if (graph.type === 'chain') {
    return graph.steps.map((step, i) => {
      const status = getStepStatus(step.label, completedSteps, activeStep)
      return {
        id: step.id,
        type: 'default',
        position: { x: i * (nodeWidth + hGap), y: 80 },
        data: { label: `${status === 'completed' ? '✓ ' : status === 'active' ? '▶ ' : ''}${step.label}` },
        style: {
          width: nodeWidth,
          height: nodeHeight,
          fontSize: 11,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...stepStatusStyles[status],
        },
      }
    })
  }

  // Fan-out layout
  const parallelSteps = graph.steps.filter((s) => s.group === 1)
  const parallelHeight = parallelSteps.length * (nodeHeight + vGap) - vGap
  const startY = Math.max(0, (parallelHeight - nodeHeight) / 2)

  return graph.steps.map((step) => {
    let x: number, y: number
    const status = getStepStatus(step.label, completedSteps, activeStep)

    if (step.id === 'step-0') {
      x = 0
      y = startY
    } else if (step.group === 1) {
      const idx = parallelSteps.indexOf(step)
      x = nodeWidth + hGap
      y = idx * (nodeHeight + vGap)
    } else {
      x = 2 * (nodeWidth + hGap)
      y = startY
    }

    return {
      id: step.id,
      type: 'default',
      position: { x, y },
      data: { label: `${status === 'completed' ? '✓ ' : status === 'active' ? '▶ ' : ''}${step.label}` },
      style: {
        width: nodeWidth,
        height: nodeHeight,
        fontSize: 11,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...stepStatusStyles[status],
      },
    }
  })
}

export function DAGVisualization() {
  const parsedJob = useStore((s) => s.parsedJob)
  const simulationResult = useStore((s) => s.simulationResult)
  const activeEventIndex = useStore((s) => s.activeEventIndex)
  const { resolvedTheme } = useTheme()

  const graph = useMemo(() => {
    if (!parsedJob?.meta) return null
    return parseWorkflow(parsedJob.meta)
  }, [parsedJob])

  // Extract completed/active steps from simulation events up to the current playback index
  const { completedSteps, activeStep } = useMemo(() => {
    const completed = new Set<string>()
    let active: string | null = null

    if (!simulationResult) return { completedSteps: completed, activeStep: active }

    const limit = activeEventIndex >= 0 ? activeEventIndex + 1 : simulationResult.events.length
    for (let i = 0; i < limit && i < simulationResult.events.length; i++) {
      const event = simulationResult.events[i]!
      if (event.workflowStep) {
        if (event.label.includes('completed') || event.to === 'completed') {
          completed.add(event.workflowStep)
          active = null
        } else {
          active = event.workflowStep
        }
      }
    }

    return { completedSteps: completed, activeStep: active }
  }, [simulationResult, activeEventIndex])

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] }

    const flowNodes = layoutNodes(graph, completedSteps, activeStep)
    const flowEdges: Edge[] = graph.edges.map((e, i) => {
      const sourceNode = graph.steps.find((s) => s.id === e.source)
      const isCompleted = sourceNode && completedSteps.has(sourceNode.label)
      return {
        id: `edge-${i}`,
        source: e.source,
        target: e.target,
        animated: !isCompleted,
        style: {
          stroke: isCompleted ? 'hsl(142, 71%, 45%)' : 'hsl(var(--primary))',
          strokeWidth: 2,
        },
      }
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [graph, completedSteps, activeStep])

  if (!graph) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <div className="text-center space-y-1">
          <p>No workflow detected</p>
          <p className="text-[10px]">
            Add <code className="bg-muted px-1 rounded">meta.workflow_type</code> and{' '}
            <code className="bg-muted px-1 rounded">meta.steps</code> to see the DAG
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.5}
        maxZoom={2}
      >
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  )
}
