import type { StateCreator } from 'zustand'

type PersistConfig = {
  name: string
  keys: string[]
}

/**
 * Zustand middleware that persists selected state keys to localStorage.
 * Extracted from the inline persist config for modularity.
 */
export function createPersistMiddleware<T>(config: PersistConfig) {
  const { name, keys } = config

  return (
    initializer: StateCreator<T, [], []>,
  ): StateCreator<T, [], []> =>
    (set, get, api) => {
      // Restore persisted state
      try {
        const stored = localStorage.getItem(name)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.state) {
            const partial: Partial<T> = {}
            for (const key of keys) {
              if (key in parsed.state) {
                (partial as Record<string, unknown>)[key] = parsed.state[key]
              }
            }
            // Will be merged by set() after initialization
            setTimeout(() => set(partial as Partial<T>), 0)
          }
        }
      } catch {
        // ignore parse errors
      }

      // Subscribe to save on changes
      const originalSet: typeof set = (partial, replace?) => {
        set(partial, replace as false | undefined)
        try {
          const state = get() as Record<string, unknown>
          const toSave: Record<string, unknown> = {}
          for (const key of keys) {
            toSave[key] = state[key]
          }
          localStorage.setItem(name, JSON.stringify({ state: toSave, version: 1 }))
        } catch {
          // ignore save errors
        }
      }

      return initializer(originalSet, get, api)
    }
}
