import { useEffect } from 'react'
import { useStore } from '@/store'

export function useLocalModeDetection() {
  const setIsLocalMode = useStore((state) => state.setIsLocalMode)
  const setLocalUrl = useStore((state) => state.setLocalUrl)

  useEffect(() => {
    const controller = new AbortController()
    const origin = window.location.origin

    const detect = async () => {
      try {
        const response = await fetch(`${origin}/api/health`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const contentType = response.headers.get('Content-Type') ?? ''
        if (!response.ok || !contentType.includes('application/json')) return
        const health = await response.json()
        if (!controller.signal.aborted && health?.status === 'ok') {
          setLocalUrl(origin)
          setIsLocalMode(true)
        }
      } catch {
        if (!controller.signal.aborted) setIsLocalMode(false)
      }
    }

    detect()
    return () => controller.abort()
  }, [setIsLocalMode, setLocalUrl])
}
