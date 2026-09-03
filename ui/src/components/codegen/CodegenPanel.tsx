import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CodeOutput } from './CodeOutput'
import { CodeActions } from './CodeActions'
import { explainJob, explainLineToHtml } from '@/engine/explain'
import { ChevronDown, Lightbulb } from 'lucide-react'
import type { CodegenLanguage, CodegenScope } from '@/engine/types'

export function CodegenPanel() {
  const language = useStore((s) => s.language)
  const scope = useStore((s) => s.scope)
  const parsedJob = useStore((s) => s.parsedJob)
  const setLanguage = useStore((s) => s.setLanguage)
  const setScope = useStore((s) => s.setScope)
  const recompute = useStore((s) => s.recompute)
  const [explainOpen, setExplainOpen] = useState(true)

  const explanation = useMemo(() => {
    if (!parsedJob) return null
    return explainJob(parsedJob)
  }, [parsedJob])

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
      {explanation && (
        <Collapsible open={explainOpen} onOpenChange={setExplainOpen} className="border-t">
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-accent">
            <Lightbulb className="h-3 w-3 text-yellow-500" />
            Explain This Spec
            <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${explainOpen ? '' : '-rotate-90'}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-32 overflow-y-auto px-3 pb-2 space-y-1">
              {explanation.map((line, i) => (
                <p key={i} className="text-[11px] text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: explainLineToHtml(line) }}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <CodeActions />
    </div>
  )
}
