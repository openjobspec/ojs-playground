import { useCallback, useRef } from 'react'
import { useStore } from '@/store'

export function useSimulation() {
  const {
    simulationResult,
    activeEventIndex,
    isSimulating,
    speed,
    setActiveState,
    setActiveEventIndex,
    setIsSimulating,
  } = useStore()
  const timerRef = useRef<number | null>(null)

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) {
      cancelAnimationFrame(timerRef.current)
      timerRef.current = null
    }
    setIsSimulating(false)
  }, [setIsSimulating])

  const stepForward = useCallback(() => {
    if (!simulationResult) return
    const events = simulationResult.events
    const nextIndex = activeEventIndex + 1

    if (nextIndex >= events.length) {
      stopPlayback()
      return
    }

    const event = events[nextIndex]!
    setActiveEventIndex(nextIndex)
    setActiveState(event.to)
  }, [simulationResult, activeEventIndex, setActiveEventIndex, setActiveState, stopPlayback])

  const play = useCallback(() => {
    if (!simulationResult) return
    setIsSimulating(true)

    const events = simulationResult.events
    let currentIndex = activeEventIndex

    function tick() {
      currentIndex++
      if (currentIndex >= events.length) {
        setIsSimulating(false)
        return
      }

      const event = events[currentIndex]!
      setActiveEventIndex(currentIndex)
      setActiveState(event.to)

      // Calculate delay based on simulation timing and speed
      const nextEvent = events[currentIndex + 1]
      if (nextEvent) {
        const timeDiff = nextEvent.timestamp - event.timestamp
        const displayDelay = Math.max(100, Math.min(timeDiff / speed, 2000))
        timerRef.current = window.setTimeout(tick, displayDelay) as unknown as number
      } else {
        setIsSimulating(false)
      }
    }

    tick()
  }, [simulationResult, activeEventIndex, speed, setIsSimulating, setActiveEventIndex, setActiveState])

  const reset = useCallback(() => {
    stopPlayback()
    setActiveEventIndex(-1)
    setActiveState(null)
  }, [stopPlayback, setActiveEventIndex, setActiveState])

  return {
    play,
    stepForward,
    reset,
    stopPlayback,
    isSimulating,
    activeEventIndex,
    totalSteps: simulationResult?.events.length ?? 0,
  }
}
