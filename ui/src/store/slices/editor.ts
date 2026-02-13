import type { StateCreator } from 'zustand'
import type { OJSJob, ValidationResult } from '@/engine/types'

export interface EditorTab {
  id: string
  title: string
  content: string
}

export interface EditorSlice {
  editorContent: string
  parsedJob: OJSJob | null
  validationResult: ValidationResult
  editorMode: 'json' | 'yaml'
  tabs: EditorTab[]
  activeTabId: string

  setEditorContent: (content: string) => void
  setParsedJob: (job: OJSJob | null) => void
  setValidationResult: (result: ValidationResult) => void
  setEditorMode: (mode: 'json' | 'yaml') => void
  resetEditor: () => void
  addTab: (title?: string, content?: string) => void
  removeTab: (id: string) => void
  switchTab: (id: string) => void
  renameTab: (id: string, title: string) => void
}

let tabCounter = 1

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set, get) => ({
  editorContent: '',
  parsedJob: null,
  validationResult: { valid: true, errors: [] },
  editorMode: 'json',
  tabs: [{ id: 'tab-0', title: 'Job 1', content: '' }],
  activeTabId: 'tab-0',

  setEditorContent: (content) => {
    const { activeTabId, tabs } = get()
    set({
      editorContent: content,
      tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, content } : t)),
    })
  },
  setParsedJob: (job) => set({ parsedJob: job }),
  setValidationResult: (result) => set({ validationResult: result }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  resetEditor: () =>
    set({
      editorContent: '',
      parsedJob: null,
      validationResult: { valid: true, errors: [] },
    }),
  addTab: (title, content) => {
    const { tabs } = get()
    if (tabs.length >= 10) return
    const id = `tab-${++tabCounter}`
    const newTab: EditorTab = { id, title: title ?? `Job ${tabs.length + 1}`, content: content ?? '' }
    set({ tabs: [...tabs, newTab], activeTabId: id, editorContent: newTab.content })
  },
  removeTab: (id) => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1) return
    const filtered = tabs.filter((t) => t.id !== id)
    if (activeTabId === id) {
      const first = filtered[0]!
      set({ tabs: filtered, activeTabId: first.id, editorContent: first.content })
    } else {
      set({ tabs: filtered })
    }
  },
  switchTab: (id) => {
    const { tabs, activeTabId, editorContent } = get()
    // Save current tab content
    const updatedTabs = tabs.map((t) => (t.id === activeTabId ? { ...t, content: editorContent } : t))
    const target = updatedTabs.find((t) => t.id === id)
    if (target) {
      set({ tabs: updatedTabs, activeTabId: id, editorContent: target.content })
    }
  },
  renameTab: (id, title) => {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, title } : t)) })
  },
})
