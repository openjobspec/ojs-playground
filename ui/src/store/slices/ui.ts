import type { StateCreator } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

export interface UISlice {
  theme: Theme
  showOnboarding: boolean
  activeTab: string
  commandPaletteOpen: boolean
  soundEnabled: boolean

  setTheme: (theme: Theme) => void
  setShowOnboarding: (show: boolean) => void
  setActiveTab: (tab: string) => void
  setCommandPaletteOpen: (open: boolean) => void
  setSoundEnabled: (enabled: boolean) => void
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: 'system',
  showOnboarding: true,
  activeTab: 'code',
  commandPaletteOpen: false,
  soundEnabled: false,

  setTheme: (theme) => set({ theme }),
  setShowOnboarding: (show) => set({ showOnboarding: show }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
})
