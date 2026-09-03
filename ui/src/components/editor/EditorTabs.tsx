import { useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorTab } from '@/store/slices/editor'

interface EditorTabsProps {
  tabs: EditorTab[]
  activeTabId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onAdd: () => void
  maxTabs?: number
}

export function EditorTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onAdd,
  maxTabs = 10,
}: EditorTabsProps) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  const focusAndSelect = (index: number) => {
    const tab = tabs[index]
    if (!tab) return
    onSelect(tab.id)
    requestAnimationFrame(() => tabRefs.current.get(tab.id)?.focus())
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    let targetIndex: number | null = null
    switch (event.key) {
      case 'ArrowLeft':
        targetIndex = (index - 1 + tabs.length) % tabs.length
        break
      case 'ArrowRight':
        targetIndex = (index + 1) % tabs.length
        break
      case 'Home':
        targetIndex = 0
        break
      case 'End':
        targetIndex = tabs.length - 1
        break
    }
    if (targetIndex === null) return
    event.preventDefault()
    focusAndSelect(targetIndex)
  }

  const handleClose = (id: string, index: number) => {
    const nextFocus = id === activeTabId
      ? tabs[index + 1]?.id ?? tabs[index - 1]?.id
      : activeTabId
    onClose(id)
    if (nextFocus) requestAnimationFrame(() => tabRefs.current.get(nextFocus)?.focus())
  }

  return (
    <div
      role="tablist"
      aria-label="Job editor tabs"
      className="flex min-h-11 items-stretch overflow-x-auto border-b bg-muted/30"
    >
      {tabs.map((tab, index) => {
        const active = tab.id === activeTabId
        const tabId = tabElementId(tab.id)
        return (
          <div
            key={tab.id}
            className={cn(
              'flex shrink-0 items-stretch border-r',
              active && 'bg-background',
            )}
          >
            <button
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element)
                else tabRefs.current.delete(tab.id)
              }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={active}
              aria-controls="editor-tabpanel"
              tabIndex={active ? 0 : -1}
              className={cn(
                'min-h-11 min-w-11 max-w-36 touch-manipulation px-3 text-left text-xs font-medium',
                'hover:bg-accent/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => handleKeyDown(index, event)}
            >
              <span className="block truncate">{tab.title}</span>
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                className="min-h-11 min-w-11 touch-manipulation text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleClose(tab.id, index)}
              >
                <X className="mx-auto h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}
      {tabs.length < maxTabs && (
        <button
          type="button"
          aria-label="New job tab"
          className="min-h-11 min-w-11 shrink-0 touch-manipulation text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onAdd}
        >
          <Plus className="mx-auto h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function tabElementId(id: string): string {
  return `editor-tab-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`
}
