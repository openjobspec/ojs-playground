import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/store'
import { useLocalModeDetection } from './useLocalModeDetection'

function Probe() {
  useLocalModeDetection()
  const isLocal = useStore((state) => state.isLocalMode)
  return <span>{isLocal ? 'local' : 'browser'}</span>
}

describe('useLocalModeDetection', () => {
  beforeEach(() => useStore.getState().setIsLocalMode(false))
  afterEach(() => vi.restoreAllMocks())

  it('enables local mode only for the JSON health endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ status: 'ok' }),
    }))

    render(<Probe />)
    await waitFor(() => expect(screen.getByText('local')).toBeDefined())
    expect(useStore.getState().localUrl).toBe(window.location.origin)
  })

  it('does not mistake the SPA fallback for a health response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      json: () => Promise.resolve({}),
    }))

    render(<Probe />)
    await Promise.resolve()
    expect(screen.getByText('browser')).toBeDefined()
  })
})
