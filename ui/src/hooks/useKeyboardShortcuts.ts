import { useEffect } from 'react'
import { useStore } from '@/store'
import { useSimulation } from './useSimulation'

export function useKeyboardShortcuts() {
  const { play, reset } = useSimulation()
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+K: Command palette (toggle)
      if (mod && e.key === 'k') {
        e.preventDefault()
        const current = useStore.getState().commandPaletteOpen
        setCommandPaletteOpen(!current)
        return
      }

      // Cmd+Enter: Run simulation
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        reset()
        setTimeout(play, 50)
        return
      }

      // Cmd+Shift+C: Copy generated code
      if (mod && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        const code = useStore.getState().generatedCode
        if (code) {
          navigator.clipboard.writeText(code)
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [play, reset, setCommandPaletteOpen])
}
