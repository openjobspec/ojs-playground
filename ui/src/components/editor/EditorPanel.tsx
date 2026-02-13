import { Suspense, lazy } from 'react'
import { EditorToolbar } from './EditorToolbar'
import { ProblemsPanel } from './ProblemsPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MonacoEditor = lazy(() =>
  import('./MonacoEditor').then((m) => ({ default: m.MonacoEditor })),
)

export function EditorPanel() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const addTab = useStore((s) => s.addTab)
  const removeTab = useStore((s) => s.removeTab)
  const switchTab = useStore((s) => s.switchTab)
  const initFromContent = useStore((s) => s.initFromContent)

  const handleSwitchTab = (id: string) => {
    switchTab(id)
    const tab = tabs.find((t) => t.id === id)
    if (tab) {
      setTimeout(() => initFromContent(tab.content), 0)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {tabs.length > 1 && (
        <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 border-r px-2 py-1 text-[10px] cursor-pointer hover:bg-accent/50 shrink-0',
                tab.id === activeTabId && 'bg-background',
              )}
              onClick={() => handleSwitchTab(tab.id)}
            >
              <span className="truncate max-w-[80px]">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  className="hover:bg-muted rounded p-0.5"
                  onClick={(e) => { e.stopPropagation(); removeTab(tab.id) }}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {tabs.length < 10 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => addTab()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      <EditorToolbar />
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="flex h-full flex-col gap-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          }
        >
          <MonacoEditor />
        </Suspense>
      </div>
      <ProblemsPanel />
    </div>
  )
}
