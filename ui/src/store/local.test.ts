import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './index'

describe('local job snapshots', () => {
  beforeEach(() => useStore.setState({ recentJobs: [] }))

  it('updates a recent job by ID instead of duplicating polling results', () => {
    useStore.getState().addRecentJob({
      id: 'job-1',
      type: 'test.job',
      queue: 'default',
      state: 'available',
      createdAt: '2026-08-12T12:00:00Z',
    })
    useStore.getState().addRecentJob({
      id: 'job-1',
      type: 'test.job',
      queue: 'default',
      state: 'active',
      createdAt: '2026-08-12T12:00:00Z',
    })

    expect(useStore.getState().recentJobs).toHaveLength(1)
    expect(useStore.getState().recentJobs[0]?.state).toBe('active')
  })
})
