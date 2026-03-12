import { useReducer, useCallback, useRef, useMemo } from 'react'
import type {
  WorkflowDesign,
  WorkflowNode,
  WorkflowEdge,
  DesignValidationResult,
} from '@/engine/workflow-designer'
import {
  validateDesign,
  autoLayout,
  generateCode,
  designToOJSSpec,
} from '@/engine/workflow-designer'
import { WorkflowNodeComponent } from './WorkflowNode'
import { WorkflowEdgeComponent } from './WorkflowEdge'
import { WorkflowToolbar } from './WorkflowToolbar'
import { WorkflowPropertiesPanel } from './WorkflowPropertiesPanel'

// ---- Props ----

export interface WorkflowDesignerProps {
  initialDesign?: WorkflowDesign
  onDesignChange?: (design: WorkflowDesign) => void
  language?: string
  serverUrl?: string
}

// ---- State ----

interface DesignerState {
  design: WorkflowDesign
  selectedNodeId: string | null
  selectedEdgeId: string | null
  language: string
  validationResult: DesignValidationResult | null
  nextNodeIndex: number
  connectingFrom: string | null
  pan: { x: number; y: number }
  showCode: boolean
}

type DesignerAction =
  | { type: 'SET_DESIGN'; design: WorkflowDesign }
  | { type: 'ADD_NODE'; node: WorkflowNode }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<WorkflowNode> }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: WorkflowEdge }
  | { type: 'UPDATE_EDGE'; id: string; updates: Partial<WorkflowEdge> }
  | { type: 'DELETE_EDGE'; id: string }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'SELECT_EDGE'; id: string | null }
  | { type: 'SET_LANGUAGE'; language: string }
  | { type: 'SET_VALIDATION'; result: DesignValidationResult }
  | { type: 'AUTO_LAYOUT' }
  | { type: 'SET_WORKFLOW_NAME'; name: string }
  | { type: 'SET_WORKFLOW_DESCRIPTION'; description: string }
  | { type: 'START_CONNECT'; nodeId: string }
  | { type: 'FINISH_CONNECT'; targetId: string }
  | { type: 'CANCEL_CONNECT' }
  | { type: 'SET_PAN'; pan: { x: number; y: number } }
  | { type: 'TOGGLE_CODE' }

function createDefaultDesign(): WorkflowDesign {
  return {
    nodes: [],
    edges: [],
    name: 'New Workflow',
    description: '',
  }
}

function reducer(state: DesignerState, action: DesignerAction): DesignerState {
  switch (action.type) {
    case 'SET_DESIGN':
      return { ...state, design: action.design, selectedNodeId: null, selectedEdgeId: null }

    case 'ADD_NODE':
      return {
        ...state,
        design: { ...state.design, nodes: [...state.design.nodes, action.node] },
        nextNodeIndex: state.nextNodeIndex + 1,
        selectedNodeId: action.node.id,
        selectedEdgeId: null,
      }

    case 'UPDATE_NODE':
      return {
        ...state,
        design: {
          ...state.design,
          nodes: state.design.nodes.map((n) =>
            n.id === action.id ? { ...n, ...action.updates } : n
          ),
        },
      }

    case 'DELETE_NODE': {
      const newEdges = state.design.edges.filter(
        (e) => e.source !== action.id && e.target !== action.id
      )
      return {
        ...state,
        design: {
          ...state.design,
          nodes: state.design.nodes.filter((n) => n.id !== action.id),
          edges: newEdges,
        },
        selectedNodeId: state.selectedNodeId === action.id ? null : state.selectedNodeId,
      }
    }

    case 'ADD_EDGE':
      return {
        ...state,
        design: { ...state.design, edges: [...state.design.edges, action.edge] },
        selectedEdgeId: action.edge.id,
        selectedNodeId: null,
      }

    case 'UPDATE_EDGE':
      return {
        ...state,
        design: {
          ...state.design,
          edges: state.design.edges.map((e) =>
            e.id === action.id ? { ...e, ...action.updates } : e
          ),
        },
      }

    case 'DELETE_EDGE':
      return {
        ...state,
        design: {
          ...state.design,
          edges: state.design.edges.filter((e) => e.id !== action.id),
        },
        selectedEdgeId: state.selectedEdgeId === action.id ? null : state.selectedEdgeId,
      }

    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id, selectedEdgeId: null }

    case 'SELECT_EDGE':
      return { ...state, selectedEdgeId: action.id, selectedNodeId: null }

    case 'SET_LANGUAGE':
      return { ...state, language: action.language }

    case 'SET_VALIDATION':
      return { ...state, validationResult: action.result }

    case 'AUTO_LAYOUT': {
      const laid = autoLayout(state.design.nodes, state.design.edges)
      return { ...state, design: { ...state.design, nodes: laid } }
    }

    case 'SET_WORKFLOW_NAME':
      return { ...state, design: { ...state.design, name: action.name } }

    case 'SET_WORKFLOW_DESCRIPTION':
      return { ...state, design: { ...state.design, description: action.description } }

    case 'START_CONNECT':
      return { ...state, connectingFrom: action.nodeId }

    case 'FINISH_CONNECT': {
      if (!state.connectingFrom || state.connectingFrom === action.targetId) {
        return { ...state, connectingFrom: null }
      }
      // Check for duplicate edge
      const exists = state.design.edges.some(
        (e) => e.source === state.connectingFrom && e.target === action.targetId
      )
      if (exists) return { ...state, connectingFrom: null }

      const newEdge: WorkflowEdge = {
        id: `edge-${Date.now()}`,
        source: state.connectingFrom,
        target: action.targetId,
        type: 'sequential',
      }
      return {
        ...state,
        connectingFrom: null,
        design: { ...state.design, edges: [...state.design.edges, newEdge] },
        selectedEdgeId: newEdge.id,
        selectedNodeId: null,
      }
    }

    case 'CANCEL_CONNECT':
      return { ...state, connectingFrom: null }

    case 'SET_PAN':
      return { ...state, pan: action.pan }

    case 'TOGGLE_CODE':
      return { ...state, showCode: !state.showCode }

    default:
      return state
  }
}

// ---- Component ----

export function WorkflowDesigner({
  initialDesign,
  onDesignChange,
  language: initialLanguage = 'go',
}: WorkflowDesignerProps) {
  const [state, dispatch] = useReducer(reducer, {
    design: initialDesign ?? createDefaultDesign(),
    selectedNodeId: null,
    selectedEdgeId: null,
    language: initialLanguage,
    validationResult: null,
    nextNodeIndex: initialDesign?.nodes.length ?? 0,
    connectingFrom: null,
    pan: { x: 0, y: 0 },
    showCode: true,
  })

  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const panRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null)

  const selectedNode = state.design.nodes.find((n) => n.id === state.selectedNodeId) ?? null
  const selectedEdge = state.design.edges.find((e) => e.id === state.selectedEdgeId) ?? null

  // Notify parent on design changes
  const prevDesignRef = useRef(state.design)
  if (prevDesignRef.current !== state.design) {
    prevDesignRef.current = state.design
    onDesignChange?.(state.design)
  }

  const errorNodeIds = useMemo(() => {
    if (!state.validationResult) return new Set<string>()
    const ids = new Set<string>()
    for (const err of state.validationResult.errors) {
      const match = err.path.match(/^nodes\.(.+?)\./)
      if (match) ids.add(match[1]!)
    }
    return ids
  }, [state.validationResult])

  // ---- Handlers ----

  const handleAddNode = useCallback(
    (type: WorkflowNode['type']) => {
      const index = state.nextNodeIndex
      const node: WorkflowNode = {
        id: `node-${Date.now()}-${index}`,
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}`,
        jobType: type === 'job' ? 'new.job' : type,
        args: {},
        position: { x: 80 + (index % 5) * 200, y: 80 + Math.floor(index / 5) * 120 },
      }
      dispatch({ type: 'ADD_NODE', node })
    },
    [state.nextNodeIndex]
  )

  const handleDeleteSelection = useCallback(() => {
    if (state.selectedNodeId) {
      dispatch({ type: 'DELETE_NODE', id: state.selectedNodeId })
    } else if (state.selectedEdgeId) {
      dispatch({ type: 'DELETE_EDGE', id: state.selectedEdgeId })
    }
  }, [state.selectedNodeId, state.selectedEdgeId])

  const handleValidate = useCallback(() => {
    const result = validateDesign(state.design)
    dispatch({ type: 'SET_VALIDATION', result })
  }, [state.design])

  const handleAutoLayout = useCallback(() => {
    dispatch({ type: 'AUTO_LAYOUT' })
  }, [])

  const handleExportJSON = useCallback(() => {
    const spec = designToOJSSpec(state.design)
    navigator.clipboard.writeText(JSON.stringify(spec, null, 2))
  }, [state.design])

  const handleExportCode = useCallback(() => {
    const code = generateCode(state.design, state.language)
    navigator.clipboard.writeText(code)
  }, [state.design, state.language])

  // Node dragging
  const handleNodeDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      if (state.connectingFrom) {
        dispatch({ type: 'FINISH_CONNECT', targetId: nodeId })
        return
      }
      const node = state.design.nodes.find((n) => n.id === nodeId)
      if (!node) return
      e.preventDefault()
      dragRef.current = {
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        origX: node.position.x,
        origY: node.position.y,
      }
    },
    [state.design.nodes, state.connectingFrom]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX
        const dy = e.clientY - dragRef.current.startY
        dispatch({
          type: 'UPDATE_NODE',
          id: dragRef.current.nodeId,
          updates: {
            position: {
              x: dragRef.current.origX + dx,
              y: dragRef.current.origY + dy,
            },
          },
        })
      } else if (panRef.current) {
        const dx = e.clientX - panRef.current.startX
        const dy = e.clientY - panRef.current.startY
        dispatch({
          type: 'SET_PAN',
          pan: { x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy },
        })
      }
    },
    []
  )

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    panRef.current = null
  }, [])

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (state.connectingFrom) {
        dispatch({ type: 'CANCEL_CONNECT' })
        return
      }
      // Pan
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: state.pan.x,
        origPanY: state.pan.y,
      }
    },
    [state.connectingFrom, state.pan]
  )

  const handleCanvasClick = useCallback(() => {
    dispatch({ type: 'SELECT_NODE', id: null })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete when typing in input fields
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        handleDeleteSelection()
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_CONNECT' })
        dispatch({ type: 'SELECT_NODE', id: null })
      }
    },
    [handleDeleteSelection]
  )

  // Double-click node to start connecting
  const _handleNodeDoubleClick = useCallback((nodeId: string) => {
    dispatch({ type: 'START_CONNECT', nodeId })
  }, [])

  // Generated code for preview
  const generatedCode = useMemo(
    () => generateCode(state.design, state.language),
    [state.design, state.language]
  )

  const generatedSpec = useMemo(
    () => JSON.stringify(designToOJSSpec(state.design), null, 2),
    [state.design]
  )

  return (
    <div
      className="flex flex-col h-full w-full bg-background text-foreground"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <WorkflowToolbar
        language={state.language}
        onLanguageChange={(lang) => dispatch({ type: 'SET_LANGUAGE', language: lang })}
        onAddNode={handleAddNode}
        onDeleteSelection={handleDeleteSelection}
        onAutoLayout={handleAutoLayout}
        onValidate={handleValidate}
        onExportJSON={handleExportJSON}
        onExportCode={handleExportCode}
        hasSelection={!!state.selectedNodeId || !!state.selectedEdgeId}
        validationCount={state.validationResult?.errors.length}
      />

      <div className="flex flex-1 min-h-0">
        {/* Canvas + Code split */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* SVG Canvas */}
          <div
            className={`relative ${state.showCode ? 'flex-1' : 'flex-1'} min-h-0 bg-muted/10 overflow-hidden`}
          >
            {state.connectingFrom && (
              <div className="absolute top-2 left-2 z-10 bg-primary/10 text-primary text-xs px-2 py-1 rounded">
                Click a target node to connect • Esc to cancel
              </div>
            )}

            {/* Validation errors overlay */}
            {state.validationResult && !state.validationResult.valid && (
              <div className="absolute top-2 right-2 z-10 bg-destructive/10 border border-destructive/30 rounded p-2 text-xs max-w-xs max-h-32 overflow-y-auto">
                {state.validationResult.errors.map((err, i) => (
                  <div key={i} className="text-destructive mb-0.5">
                    • {err.message}
                  </div>
                ))}
              </div>
            )}

            <svg
              ref={svgRef}
              className="w-full h-full cursor-grab active:cursor-grabbing"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
            >
              {/* Grid pattern */}
              <defs>
                <pattern id="wf-grid" width="20" height="20" patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${state.pan.x % 20}, ${state.pan.y % 20})`}
                >
                  <circle cx="1" cy="1" r="0.5" fill="currentColor" className="text-border" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wf-grid)" />

              <g transform={`translate(${state.pan.x}, ${state.pan.y})`}>
                {/* Edges */}
                {state.design.edges.map((edge) => {
                  const sourceNode = state.design.nodes.find((n) => n.id === edge.source)
                  const targetNode = state.design.nodes.find((n) => n.id === edge.target)
                  if (!sourceNode || !targetNode) return null
                  return (
                    <WorkflowEdgeComponent
                      key={edge.id}
                      edge={edge}
                      sourceNode={sourceNode}
                      targetNode={targetNode}
                      selected={state.selectedEdgeId === edge.id}
                      onSelect={(id) => dispatch({ type: 'SELECT_EDGE', id })}
                    />
                  )
                })}

                {/* Nodes */}
                {state.design.nodes.map((node) => (
                  <WorkflowNodeComponent
                    key={node.id}
                    node={node}
                    selected={state.selectedNodeId === node.id}
                    hasError={errorNodeIds.has(node.id)}
                    errorMessage={
                      state.validationResult?.errors
                        .filter((e) => e.path.startsWith(`nodes.${node.id}`))
                        .map((e) => e.message)
                        .join('; ')
                    }
                    onSelect={(id) => {
                      if (state.connectingFrom) {
                        dispatch({ type: 'FINISH_CONNECT', targetId: id })
                      } else {
                        dispatch({ type: 'SELECT_NODE', id })
                      }
                    }}
                    onDragStart={handleNodeDragStart}
                  />
                ))}
              </g>

              {/* Empty state */}
              {state.design.nodes.length === 0 && (
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  className="fill-muted-foreground text-sm"
                >
                  Click "Add" in the toolbar to create your first node
                </text>
              )}
            </svg>

            {/* Connect hint: double-click */}
            {!state.connectingFrom && state.design.nodes.length > 1 && (
              <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground">
                Double-click a node to start connecting
              </div>
            )}
          </div>

          {/* Code preview toggle */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CODE' })}
            className="w-full text-[10px] text-muted-foreground bg-muted/30 hover:bg-muted/50 border-t border-border px-2 py-0.5 text-left"
          >
            {state.showCode ? '▼ Hide code preview' : '▶ Show code preview'}
          </button>

          {/* Code preview */}
          {state.showCode && (
            <div className="h-48 min-h-0 border-t border-border overflow-auto bg-muted/20">
              <div className="flex border-b border-border text-[10px]">
                <button
                  className="px-3 py-1 bg-muted/50 font-medium border-r border-border"
                  onClick={() => navigator.clipboard.writeText(generatedCode)}
                  title="Click to copy"
                >
                  {state.language.charAt(0).toUpperCase() + state.language.slice(1)} Code
                </button>
                <button
                  className="px-3 py-1 hover:bg-muted/50 border-r border-border"
                  onClick={() => navigator.clipboard.writeText(generatedSpec)}
                  title="Click to copy"
                >
                  OJS Spec
                </button>
              </div>
              <pre className="p-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap">
                {generatedCode}
              </pre>
            </div>
          )}
        </div>

        {/* Properties panel */}
        <WorkflowPropertiesPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onNodeUpdate={(id, updates) => dispatch({ type: 'UPDATE_NODE', id, updates })}
          onEdgeUpdate={(id, updates) => dispatch({ type: 'UPDATE_EDGE', id, updates })}
          workflowName={state.design.name}
          workflowDescription={state.design.description ?? ''}
          onWorkflowNameChange={(name) => dispatch({ type: 'SET_WORKFLOW_NAME', name })}
          onWorkflowDescriptionChange={(desc) => dispatch({ type: 'SET_WORKFLOW_DESCRIPTION', description: desc })}
        />
      </div>
    </div>
  )
}
