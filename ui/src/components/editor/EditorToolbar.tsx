import { useStore } from '@/store'
import { DEFAULT_JOB_JSON } from '@/engine/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { RotateCcw, AlignLeft } from 'lucide-react'
import { toast } from 'sonner'
import YAML from 'yaml'

export function EditorToolbar() {
  const editorMode = useStore((s) => s.editorMode)
  const setEditorMode = useStore((s) => s.setEditorMode)
  const validationResult = useStore((s) => s.validationResult)
  const initFromContent = useStore((s) => s.initFromContent)
  const editorContent = useStore((s) => s.editorContent)

  const handleFormat = () => {
    try {
      if (editorMode === 'yaml') {
        const parsed = YAML.parse(editorContent)
        initFromContent(YAML.stringify(parsed, { indent: 2 }))
      } else {
        const parsed = JSON.parse(editorContent)
        initFromContent(JSON.stringify(parsed, null, 2))
      }
    } catch {
      toast.error(`Cannot format invalid ${editorMode.toUpperCase()}`)
    }
  }

  const handleModeChange = (mode: string) => {
    if (mode !== 'json' && mode !== 'yaml') return
    if (mode === editorMode) return

    try {
      if (mode === 'yaml') {
        const parsed = JSON.parse(editorContent)
        const yamlContent = YAML.stringify(parsed, { indent: 2 })
        setEditorMode('yaml')
        initFromContent(yamlContent)
      } else {
        const parsed = YAML.parse(editorContent)
        const jsonContent = JSON.stringify(parsed, null, 2)
        setEditorMode('json')
        initFromContent(jsonContent)
      }
    } catch {
      toast.error(`Cannot convert to ${mode.toUpperCase()}: invalid content`)
    }
  }

  const handleReset = () => {
    setEditorMode('json')
    initFromContent(DEFAULT_JOB_JSON)
  }

  return (
    <div className="flex h-10 items-center justify-between border-b px-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Editor</span>
        <ToggleGroup
          type="single"
          size="sm"
          value={editorMode}
          onValueChange={handleModeChange}
        >
          <ToggleGroupItem value="json" className="h-6 px-2 text-xs">
            JSON
          </ToggleGroupItem>
          <ToggleGroupItem value="yaml" className="h-6 px-2 text-xs">
            YAML
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge
          variant={validationResult.valid ? 'default' : 'destructive'}
          className="h-5 text-xs"
        >
          {validationResult.valid ? 'Valid' : `${validationResult.errors.length} error${validationResult.errors.length !== 1 ? 's' : ''}`}
        </Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFormat} title="Format (Ctrl+Shift+F)">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reset to default">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
