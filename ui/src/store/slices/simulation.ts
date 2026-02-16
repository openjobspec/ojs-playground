import type { StateCreator } from 'zustand'
import type {
  BackoffStrategy,
  JobState,
  SimulationResult,
  SimulationScenario,
} from '@/engine/types'

export interface SimulationSlice {
  strategy: BackoffStrategy
  scenario: SimulationScenario
  simulationResult: SimulationResult | null
  baselineResult: SimulationResult | null
  activeState: JobState | null
  activeEventIndex: number
  isSimulating: boolean
  speed: number
  failOnAttempts: number[]

  setStrategy: (strategy: BackoffStrategy) => void
  setScenario: (scenario: SimulationScenario) => void
  setSimulationResult: (result: SimulationResult | null) => void
  setBaselineResult: (result: SimulationResult | null) => void
  setActiveState: (state: JobState | null) => void
  setActiveEventIndex: (index: number) => void
  setIsSimulating: (simulating: boolean) => void
  setSpeed: (speed: number) => void
  setFailOnAttempts: (attempts: number[]) => void
}

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = (
  set,
) => ({
  strategy: 'exponential',
  scenario: 'success_first_attempt',
  simulationResult: null,
  baselineResult: null,
  activeState: null,
  activeEventIndex: -1,
  isSimulating: false,
  speed: 1,
  failOnAttempts: [],

  setStrategy: (strategy) => set({ strategy }),
  setScenario: (scenario) => set({ scenario }),
  setSimulationResult: (result) => set({ simulationResult: result }),
  setBaselineResult: (result) => set({ baselineResult: result }),
  setActiveState: (state) => set({ activeState: state }),
  setActiveEventIndex: (index) => set({ activeEventIndex: index }),
  setIsSimulating: (simulating) => set({ isSimulating: simulating }),
  setSpeed: (speed) => set({ speed }),
  setFailOnAttempts: (attempts) => set({ failOnAttempts: attempts }),
})
