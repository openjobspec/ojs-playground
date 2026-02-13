import type { StateCreator } from 'zustand'

export type BackendType = 'redis' | 'postgres' | 'kafka' | 'sqs' | 'nats'

export interface BackendInfo {
  id: BackendType
  name: string
  conformanceLevel: number
  features: Record<string, 'supported' | 'unsupported' | 'partial'>
  performance: { throughput: string; p50: string; p99: string; maxPayload: string }
  notes: string
  tradeoff: string
}

export interface ComparisonSlice {
  selectedBackends: BackendType[]
  showRecommendation: boolean

  setSelectedBackends: (backends: BackendType[]) => void
  toggleBackend: (backend: BackendType) => void
  setShowRecommendation: (show: boolean) => void
}

export const createComparisonSlice: StateCreator<ComparisonSlice, [], [], ComparisonSlice> = (
  set,
  get,
) => ({
  selectedBackends: ['redis', 'postgres'],
  showRecommendation: false,

  setSelectedBackends: (backends) => set({ selectedBackends: backends }),
  toggleBackend: (backend) => {
    const current = get().selectedBackends
    if (current.includes(backend)) {
      if (current.length > 1) {
        set({ selectedBackends: current.filter((b) => b !== backend) })
      }
    } else if (current.length < 5) {
      set({ selectedBackends: [...current, backend] })
    }
  },
  setShowRecommendation: (show) => set({ showRecommendation: show }),
})
