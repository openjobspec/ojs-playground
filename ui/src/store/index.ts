import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createEditorSlice, type EditorSlice } from './slices/editor'
import { createSimulationSlice, type SimulationSlice } from './slices/simulation'
import { createCodegenSlice, type CodegenSlice } from './slices/codegen'
import { createUISlice, type UISlice } from './slices/ui'
import { createComparisonSlice, type ComparisonSlice } from './slices/comparison'
import { createTutorialSlice, type TutorialSlice } from './slices/tutorial'
import { createLocalSlice, type LocalSlice } from './slices/local'
import { validateJobContent } from '@/engine/validator'
import { runSimulation } from '@/engine/simulation'
import { generateCode } from '@/engine/codegen/generator'
import { DEFAULT_JOB_JSON } from '@/engine/constants'
import type { OJSJob } from '@/engine/types'
import YAML from 'yaml'

export type StoreState = EditorSlice & SimulationSlice & CodegenSlice & UISlice & ComparisonSlice & TutorialSlice & LocalSlice & {
  initFromContent: (content: string) => void
  recompute: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get, api) => ({
      ...createEditorSlice(set, get, api),
      ...createSimulationSlice(set, get, api),
      ...createCodegenSlice(set, get, api),
      ...createUISlice(set, get, api),
      ...createComparisonSlice(set, get, api),
      ...createTutorialSlice(set, get, api),
      ...createLocalSlice(set, get, api),

      initFromContent: (content: string) => {
        set({ editorContent: content })
        const mode = get().editorMode

        // Parse based on current editor mode
        let parsedJob: OJSJob | null = null
        try {
          parsedJob = (mode === 'yaml' ? YAML.parse(content) : JSON.parse(content)) as OJSJob
        } catch {
          // invalid content
        }
        set({ parsedJob })

        // Validate
        const validationResult = validateJobContent(content, mode)
        set({ validationResult })

        // Simulate + generate code
        if (parsedJob && validationResult.valid) {
          const state = get()
          const simulationResult = runSimulation({
            job: parsedJob,
            scenario: state.scenario,
            strategy: state.strategy,
            failOnAttempts: state.failOnAttempts,
            seed: 42,
          })
          set({ simulationResult })

          const generatedCode = generateCode(parsedJob, state.language, state.scope)
          set({ generatedCode })
        } else {
          set({ simulationResult: null, generatedCode: '' })
        }
      },

      recompute: () => {
        const state = get()
        const { parsedJob, language, scope, scenario, strategy, failOnAttempts } = state

        if (!parsedJob) {
          set({ simulationResult: null, generatedCode: '' })
          return
        }

        const simulationResult = runSimulation({
          job: parsedJob,
          scenario,
          strategy,
          failOnAttempts,
          seed: 42,
        })
        set({ simulationResult })

        const generatedCode = generateCode(parsedJob, language, scope)
        set({ generatedCode })
      },
    }),
    {
      name: 'ojs-playground',
      partialize: (state) => ({
        editorContent: state.editorContent,
        theme: state.theme,
        language: state.language,
        scope: state.scope,
        editorMode: state.editorMode,
        strategy: state.strategy,
        scenario: state.scenario,
        speed: state.speed,
      }),
    },
  ),
)

// Initialize with default content on first load
try {
  const stored = localStorage.getItem('ojs-playground')
  const hasContent = stored && JSON.parse(stored).state?.editorContent
  if (!hasContent) {
    useStore.getState().initFromContent(DEFAULT_JOB_JSON)
  } else {
    const state = useStore.getState()
    if (state.editorContent) {
      state.initFromContent(state.editorContent)
    }
  }
} catch {
  useStore.getState().initFromContent(DEFAULT_JOB_JSON)
}
