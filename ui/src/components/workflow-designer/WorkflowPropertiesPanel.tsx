import { useState, useEffect } from 'react'
import type { WorkflowNode, WorkflowEdge } from '@/engine/workflow-designer'

interface WorkflowPropertiesPanelProps {
  selectedNode: WorkflowNode | null
  selectedEdge: WorkflowEdge | null
  onNodeUpdate: (id: string, updates: Partial<WorkflowNode>) => void
  onEdgeUpdate: (id: string, updates: Partial<WorkflowEdge>) => void
  workflowName: string
  workflowDescription: string
  onWorkflowNameChange: (name: string) => void
  onWorkflowDescriptionChange: (desc: string) => void
}

export function WorkflowPropertiesPanel({
  selectedNode,
  selectedEdge,
  onNodeUpdate,
  onEdgeUpdate,
  workflowName,
  workflowDescription,
  onWorkflowNameChange,
  onWorkflowDescriptionChange,
}: WorkflowPropertiesPanelProps) {
  const [argsText, setArgsText] = useState('{}')
  const [argsError, setArgsError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedNode?.args) {
      setArgsText(JSON.stringify(selectedNode.args, null, 2))
      setArgsError(null)
    } else {
      setArgsText('{}')
      setArgsError(null)
    }
  }, [selectedNode?.id, selectedNode?.args])

  const handleArgsChange = (text: string) => {
    setArgsText(text)
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        setArgsError('Args must be a JSON object')
        return
      }
      setArgsError(null)
      if (selectedNode) {
        onNodeUpdate(selectedNode.id, { args: parsed })
      }
    } catch {
      setArgsError('Invalid JSON')
    }
  }

  // Node properties
  if (selectedNode) {
    return (
      <div className="w-64 border-l border-border bg-muted/20 overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Node Properties
          </h3>
        </div>
        <div className="p-3 space-y-3">
          <Field label="Label">
            <input
              type="text"
              value={selectedNode.label}
              onChange={(e) => onNodeUpdate(selectedNode.id, { label: e.target.value })}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
            />
          </Field>

          <Field label="Job Type">
            <input
              type="text"
              value={selectedNode.jobType}
              onChange={(e) => onNodeUpdate(selectedNode.id, { jobType: e.target.value })}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
              placeholder="e.g. email.send"
            />
          </Field>

          <Field label="Queue">
            <input
              type="text"
              value={selectedNode.queue ?? ''}
              onChange={(e) => onNodeUpdate(selectedNode.id, { queue: e.target.value || undefined })}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
              placeholder="default"
            />
          </Field>

          <Field label="Node Type">
            <select
              value={selectedNode.type}
              onChange={(e) => onNodeUpdate(selectedNode.id, { type: e.target.value as WorkflowNode['type'] })}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
            >
              <option value="job">Job</option>
              <option value="chain">Chain</option>
              <option value="group">Group</option>
              <option value="batch">Batch</option>
              <option value="callback">Callback</option>
            </select>
          </Field>

          <Field label="Args (JSON)">
            <textarea
              value={argsText}
              onChange={(e) => handleArgsChange(e.target.value)}
              className={`w-full bg-background border rounded px-2 py-1 text-xs font-mono h-24 resize-y ${
                argsError ? 'border-red-500' : 'border-border'
              }`}
              spellCheck={false}
            />
            {argsError && (
              <p className="text-[10px] text-red-500 mt-0.5">{argsError}</p>
            )}
          </Field>

          <div className="text-[10px] text-muted-foreground pt-1">
            ID: <code className="bg-muted px-1 rounded">{selectedNode.id}</code>
          </div>
        </div>
      </div>
    )
  }

  // Edge properties
  if (selectedEdge) {
    return (
      <div className="w-64 border-l border-border bg-muted/20 overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Edge Properties
          </h3>
        </div>
        <div className="p-3 space-y-3">
          <Field label="Edge Type">
            <select
              value={selectedEdge.type}
              onChange={(e) => onEdgeUpdate(selectedEdge.id, { type: e.target.value as WorkflowEdge['type'] })}
              className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
              <option value="callback-success">Callback (Success)</option>
              <option value="callback-failure">Callback (Failure)</option>
            </select>
          </Field>

          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div>Source: <code className="bg-muted px-1 rounded">{selectedEdge.source}</code></div>
            <div>Target: <code className="bg-muted px-1 rounded">{selectedEdge.target}</code></div>
          </div>
        </div>
      </div>
    )
  }

  // Workflow-level properties (default)
  return (
    <div className="w-64 border-l border-border bg-muted/20 overflow-y-auto">
      <div className="p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Workflow Properties
        </h3>
      </div>
      <div className="p-3 space-y-3">
        <Field label="Name">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => onWorkflowNameChange(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
          />
        </Field>

        <Field label="Description">
          <textarea
            value={workflowDescription}
            onChange={(e) => onWorkflowDescriptionChange(e.target.value)}
            className="w-full bg-background border border-border rounded px-2 py-1 text-xs h-16 resize-y"
            placeholder="Optional description..."
          />
        </Field>

        <p className="text-[10px] text-muted-foreground">
          Select a node or edge to edit its properties.
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-muted-foreground mb-0.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}
