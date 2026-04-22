import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/store'
import { ConformanceRunnerPanel } from './ConformanceRunnerPanel'

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({ toast }))

describe('ConformanceRunnerPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    toast.success.mockReset()
    toast.error.mockReset()
    useStore.getState().setIsLocalMode(true)
    useStore.getState().setLocalUrl('http://first.test')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    useStore.getState().setIsLocalMode(false)
  })

  it('clears the run poll and safety timers on success', async () => {
    let resolveStart!: (response: Response) => void
    const startResponse = new Promise<Response>((resolve) => {
      resolveStart = resolve
    })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(startResponse)
      .mockResolvedValueOnce(jsonResponse({
        run: { ...runningRun('run-1'), status: 'completed', results: { total: 1, passed: 1, failed: 0 } },
      }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ConformanceRunnerPanel />)
    await clickRun(false)
    await act(async () => {
      resolveStart(jsonResponse({ run: runningRun('run-1') }, 202))
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })
    expect(vi.getTimerCount()).toBe(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect((screen.getByRole('button', { name: 'Run Tests' }) as HTMLButtonElement).disabled).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('Conformance run completed')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('fences stale start responses so an old run cannot stop a newer run', async () => {
    let resolveOld!: (response: Response) => void
    const oldStart = new Promise<Response>((resolve) => {
      resolveOld = resolve
    })
    let pollCount = 0
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === 'http://first.test/api/conformance/run' && init?.method === 'POST') return oldStart
      if (url === 'http://second.test/api/conformance/run' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ run: runningRun('run-2') }, 202))
      }
      if (url === 'http://second.test/api/conformance/run/run-2') {
        pollCount++
        return Promise.resolve(jsonResponse({
          run: pollCount === 1
            ? runningRun('run-2')
            : { ...runningRun('run-2'), status: 'completed', results: { total: 1, passed: 1, failed: 0 } },
        }))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<ConformanceRunnerPanel />)
    await clickRun(false)
    act(() => useStore.getState().setLocalUrl('http://second.test'))
    await clickRun(true)
    expect((screen.getByRole('button', { name: 'Running…' }) as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveOld(jsonResponse({ run: runningRun('run-1') }, 202))
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(500)
    })
    expect((screen.getByRole('button', { name: 'Running…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect((screen.getByRole('button', { name: 'Run Tests' }) as HTMLButtonElement).disabled).toBe(false)
    expect(toast.success).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears exact run timers on polling error and unmount', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ run: runningRun('run-error') }, 202))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Runner unavailable' } }, 503))
      .mockResolvedValueOnce(jsonResponse({ run: runningRun('run-unmount') }, 202))
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<ConformanceRunnerPanel />)
    await clickRun(true)
    expect(vi.getTimerCount()).toBe(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(toast.error).toHaveBeenCalledWith('Runner unavailable')
    expect(vi.getTimerCount()).toBe(0)

    await clickRun(true)
    expect(vi.getTimerCount()).toBe(2)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('distinguishes runner evaluation errors from backend failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ run: runningRun('run-semantic') }, 202))
      .mockResolvedValueOnce(jsonResponse({
        run: {
          ...runningRun('run-semantic'),
          status: 'failed',
          results: {
            total: 3,
            passed: 1,
            failed: 2,
            runner_errors: 1,
            backend_failures: 1,
          },
        },
      }))
    vi.stubGlobal('fetch', fetchMock)

    render(<ConformanceRunnerPanel />)
    await clickRun(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(toast.error).toHaveBeenCalledWith('Runner could not evaluate 1 test')
    expect(screen.getByText(/Backend failures:/).textContent).toContain('Backend failures: 1')
    expect(screen.getByText(/Runner errors:/).textContent).toContain('Runner errors: 1')
    expect(screen.getByText(/not backend conformance failures/i)).toBeTruthy()
  })
})

async function clickRun(waitForStarted: boolean): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Run Tests' }))
    for (let i = 0; i < 50; i++) {
      await Promise.resolve()
      if (!waitForStarted || screen.queryByText('Level 0 Test Run')) break
    }
  })
}

function runningRun(id: string) {
  return {
    id,
    status: 'running',
    level: 0,
    started_at: '2026-08-12T12:00:00Z',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}
