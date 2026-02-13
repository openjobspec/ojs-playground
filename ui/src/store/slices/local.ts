import type { StateCreator } from 'zustand'
import type { BackendType } from './comparison'

export interface LocalWorker {
  id: string
  name: string
  queues: string[]
  jobTypes: string[]
  status: 'connected' | 'disconnected'
  lastSeen: number
}

export interface LocalJob {
  id: string
  type: string
  queue: string
  state: string
  createdAt: string
  completedAt?: string
}

export interface LocalSlice {
  isLocalMode: boolean
  localUrl: string
  activeBackend: BackendType | 'memory'
  workers: LocalWorker[]
  recentJobs: LocalJob[]
  sseConnected: boolean

  setIsLocalMode: (local: boolean) => void
  setLocalUrl: (url: string) => void
  setActiveBackend: (backend: BackendType | 'memory') => void
  setWorkers: (workers: LocalWorker[]) => void
  addRecentJob: (job: LocalJob) => void
  setSseConnected: (connected: boolean) => void
}

export const createLocalSlice: StateCreator<LocalSlice, [], [], LocalSlice> = (set, get) => ({
  isLocalMode: false,
  localUrl: 'http://localhost:4200',
  activeBackend: 'memory',
  workers: [],
  recentJobs: [],
  sseConnected: false,

  setIsLocalMode: (local) => set({ isLocalMode: local }),
  setLocalUrl: (url) => set({ localUrl: url }),
  setActiveBackend: (backend) => set({ activeBackend: backend }),
  setWorkers: (workers) => set({ workers }),
  addRecentJob: (job) =>
    set({ recentJobs: [job, ...get().recentJobs].slice(0, 100) }),
  setSseConnected: (connected) => set({ sseConnected: connected }),
})
