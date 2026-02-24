import type { WorkflowNode } from '@/engine/workflow-designer'

const SUPPORTED_LANGUAGES = [
  { value: 'go', label: 'Go' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'csharp', label: 'C#' },
]

const NODE_TYPES: { type: WorkflowNode['type']; label: string; icon: string }[] = [
  { type: 'job', label: 'Job', icon: '⚙' },
  { type: 'chain', label: 'Chain', icon: '→' },
  { type: 'group', label: 'Group', icon: '⑂' },
  { type: 'batch', label: 'Batch', icon: '⑃' },
  { type: 'callback', label: 'Callback', icon: '↩' },
]

interface WorkflowToolbarProps {
  language: string
  onLanguageChange: (lang: string) => void
  onAddNode: (type: WorkflowNode['type']) => void
  onDeleteSelection: () => void
  onAutoLayout: () => void
  onValidate: () => void
  onExportJSON: () => void
  onExportCode: () => void
  hasSelection: boolean
  validationCount?: number
}

export function WorkflowToolbar({
  language,
  onLanguageChange,
  onAddNode,
  onDeleteSelection,
  onAutoLayout,
  onValidate,
  onExportJSON,
  onExportCode,
  hasSelection,
  validationCount,
}: WorkflowToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5 text-xs flex-wrap">
      {/* Add Node Buttons */}
      <div className="flex items-center gap-0.5 mr-2">
        <span className="text-muted-foreground mr-1">Add:</span>
        {NODE_TYPES.map((nt) => (
          <button
            key={nt.type}
            onClick={() => onAddNode(nt.type)}
            className="px-2 py-1 rounded hover:bg-accent transition-colors"
            title={`Add ${nt.label} node`}
          >
            <span className="mr-0.5">{nt.icon}</span>
            {nt.label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Actions */}
      <button
        onClick={onDeleteSelection}
        disabled={!hasSelection}
        className="px-2 py-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Delete selected node or edge (Del)"
      >
        🗑 Delete
      </button>

      <button
        onClick={onAutoLayout}
        className="px-2 py-1 rounded hover:bg-accent transition-colors"
        title="Auto-arrange nodes"
      >
        📐 Layout
      </button>

      <button
        onClick={onValidate}
        className="px-2 py-1 rounded hover:bg-accent transition-colors relative"
        title="Validate workflow"
      >
        ✓ Validate
        {validationCount !== undefined && validationCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center">
            {validationCount}
          </span>
        )}
      </button>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Export */}
      <button
        onClick={onExportJSON}
        className="px-2 py-1 rounded hover:bg-accent transition-colors"
        title="Export as OJS JSON spec"
      >
        📋 JSON
      </button>

      <button
        onClick={onExportCode}
        className="px-2 py-1 rounded hover:bg-accent transition-colors"
        title="Copy generated code"
      >
        📄 Code
      </button>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Language Selector */}
      <label className="flex items-center gap-1 text-muted-foreground">
        Lang:
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-background border border-border rounded px-1.5 py-0.5 text-foreground text-xs"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
