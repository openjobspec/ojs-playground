import type { StateCreator } from 'zustand'
import type { CodegenLanguage, CodegenScope } from '@/engine/types'

export interface CodegenSlice {
  language: CodegenLanguage
  scope: CodegenScope
  generatedCode: string

  setLanguage: (language: CodegenLanguage) => void
  setScope: (scope: CodegenScope) => void
  setGeneratedCode: (code: string) => void
}

export const createCodegenSlice: StateCreator<CodegenSlice, [], [], CodegenSlice> = (set) => ({
  language: 'go',
  scope: 'full',
  generatedCode: '',

  setLanguage: (language) => set({ language }),
  setScope: (scope) => set({ scope }),
  setGeneratedCode: (code) => set({ generatedCode: code }),
})
