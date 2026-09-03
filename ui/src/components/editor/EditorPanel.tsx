import { Suspense, lazy } from 'react'
import { EditorToolbar } from './EditorToolbar'
import { ProblemsPanel } from './ProblemsPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import { EditorTabs, tabElementId } from './EditorTabs'

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
    queueMicrotask(() => initFromContent(useStore.getState().editorContent))
  }

  const handleCloseTab = (id: string) => {
    removeTab(id)
    queueMicrotask(() => initFromContent(useStore.getState().editorContent))
  }

  const handleAddTab = () => {
    addTab()
    queueMicrotask(() => initFromContent(useStore.getState().editorContent))
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={handleSwitchTab}
        onClose={handleCloseTab}
        onAdd={handleAddTab}
      />
      <div
        id="editor-tabpanel"
        role="tabpanel"
        aria-labelledby={tabElementId(activeTabId)}
        className="flex min-h-0 flex-1 flex-col"
      >
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
    </div>
  )
}
