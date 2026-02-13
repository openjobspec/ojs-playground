import type { StateCreator } from 'zustand'

export interface TutorialStep {
  id: string
  title: string
  description: string
  spec?: string
  highlight?: string
  action?: 'load_spec' | 'run_simulation' | 'change_scenario' | 'switch_language'
}

export interface Tutorial {
  id: string
  title: string
  description: string
  level: number
  steps: TutorialStep[]
}

export interface TutorialSlice {
  activeTutorial: string | null
  currentStepIndex: number
  tutorialProgress: Record<string, number>

  startTutorial: (tutorialId: string) => void
  nextStep: () => void
  prevStep: () => void
  exitTutorial: () => void
  setTutorialProgress: (tutorialId: string, stepIndex: number) => void
}

export const createTutorialSlice: StateCreator<TutorialSlice, [], [], TutorialSlice> = (
  set,
  get,
) => ({
  activeTutorial: null,
  currentStepIndex: 0,
  tutorialProgress: {},

  startTutorial: (tutorialId) =>
    set({ activeTutorial: tutorialId, currentStepIndex: 0 }),
  nextStep: () => {
    const { currentStepIndex, activeTutorial, tutorialProgress } = get()
    const next = currentStepIndex + 1
    set({
      currentStepIndex: next,
      tutorialProgress: activeTutorial
        ? { ...tutorialProgress, [activeTutorial]: next }
        : tutorialProgress,
    })
  },
  prevStep: () => {
    const { currentStepIndex } = get()
    if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1 })
  },
  exitTutorial: () => set({ activeTutorial: null, currentStepIndex: 0 }),
  setTutorialProgress: (tutorialId, stepIndex) =>
    set((state) => ({
      tutorialProgress: { ...state.tutorialProgress, [tutorialId]: stepIndex },
    })),
})
