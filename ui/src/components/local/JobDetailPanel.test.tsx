import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/store'
import { JobDetailPanel } from './JobDetailPanel'

describe('JobDetailPanel', () => {
  beforeEach(() => {
    useStore.getState().setIsLocalMode(true)
    useStore.getState().setLocalUrl('http://local.test')
    useStore.setState({
      recentJobs: [{
        id: 'job-1',
        type: 'email.send',
        queue: 'default',
        state: 'completed',
        createdAt: '2026-08-12T12:00:00Z',
      }],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useStore.getState().setIsLocalMode(false)
    useStore.setState({ recentJobs: [] })
  })

  it('uses state_history from the existing job response', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/jobs?limit=50')) {
        return Promise.resolve(jsonResponse({ jobs: [] }))
      }
      if (url.endsWith('/api/jobs/job-1')) {
        return Promise.resolve(jsonResponse({
          job: {
            id: 'job-1',
            type: 'email.send',
            state: 'completed',
            queue: 'default',
            args: [],
            priority: 0,
            attempt: 1,
            max_attempts: 3,
            created_at: '2026-08-12T12:00:00Z',
          },
          state_history: [{
            from_state: 'active',
            to_state: 'completed',
            timestamp: '2026-08-12T12:00:01Z',
          }],
        }))
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<JobDetailPanel />)
    fireEvent.click(screen.getByRole('button', { name: /email\.send/i }))
    await act(async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve()
    })

    expect(screen.getByText('State History')).toBeDefined()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/history'))).toBe(false)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/jobs/job-1'))).toBe(true)
    view.unmount()
  })
})

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
