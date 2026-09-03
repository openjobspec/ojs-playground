import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_JOB } from '@/engine/constants'
import { runSimulation } from '@/engine/simulation'
import { useStore } from '@/store'
import { RetryTimeline } from './RetryTimeline'

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ScatterChart: Container,
    Scatter: Container,
    XAxis: Container,
    YAxis: Container,
    CartesianGrid: Container,
    Tooltip: Container,
    ErrorBar: Container,
    ResponsiveContainer: Container,
    ReferenceLine: Container,
  }
})

describe('RetryTimeline', () => {
  it('keeps hook order stable as external editor validation changes', () => {
    const result = runSimulation({
      job: DEFAULT_JOB,
      scenario: 'success_after_retries',
      strategy: 'exponential',
      failOnAttempts: [1],
      seed: 42,
    })
    useStore.setState({
      parsedJob: DEFAULT_JOB,
      simulationResult: result,
      baselineResult: null,
      strategy: 'exponential',
    })

    render(<RetryTimeline />)
    expect(screen.getByText(/Attempts:/)).toBeDefined()

    act(() => useStore.setState({ simulationResult: null, parsedJob: null }))
    expect(screen.getByText('Run a simulation to see the timeline')).toBeDefined()

    act(() => useStore.setState({ simulationResult: result, parsedJob: DEFAULT_JOB }))
    expect(screen.getByText(/Attempts:/)).toBeDefined()
  })
})
