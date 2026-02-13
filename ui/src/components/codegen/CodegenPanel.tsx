import { useStore } from '@/store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CodeOutput } from './CodeOutput'
import { CodeActions } from './CodeActions'
import type { CodegenLanguage, CodegenScope } from '@/engine/types'

export function CodegenPanel() {
  const language = useStore((s) => s.language)
  const scope = useStore((s) => s.scope)
  const setLanguage = useStore((s) => s.setLanguage)
  const setScope = useStore((s) => s.setScope)
  const recompute = useStore((s) => s.recompute)

  const handleLanguageChange = (value: string) => {
    setLanguage(value as CodegenLanguage)
    setTimeout(() => recompute(), 0)
  }

  const handleScopeChange = (value: string) => {
    if (!value) return
    setScope(value as CodegenScope)
    setTimeout(() => recompute(), 0)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Code</span>
        <Tabs value={language} onValueChange={handleLanguageChange}>
          <TabsList className="h-7">
            <TabsTrigger value="go" className="h-5 px-2 text-xs">Go</TabsTrigger>
            <TabsTrigger value="javascript" className="h-5 px-2 text-xs">JS</TabsTrigger>
            <TabsTrigger value="python" className="h-5 px-2 text-xs">Py</TabsTrigger>
            <TabsTrigger value="ruby" className="h-5 px-2 text-xs">Ruby</TabsTrigger>
            <TabsTrigger value="rust" className="h-5 px-2 text-xs">Rust</TabsTrigger>
            <TabsTrigger value="java" className="h-5 px-2 text-xs">Java</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center justify-center border-b px-3 py-1.5">
        <ToggleGroup
          type="single"
          size="sm"
          value={scope}
          onValueChange={handleScopeChange}
        >
          <ToggleGroupItem value="enqueue" className="h-6 px-2 text-xs">
            Enqueue
          </ToggleGroupItem>
          <ToggleGroupItem value="worker" className="h-6 px-2 text-xs">
            Worker
          </ToggleGroupItem>
          <ToggleGroupItem value="full" className="h-6 px-2 text-xs">
            Full
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex-1 min-h-0">
        <CodeOutput />
      </div>
      <CodeActions />
    </div>
  )
}
