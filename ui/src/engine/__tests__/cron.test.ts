import { describe, it, expect } from 'vitest'
import { parseCron, getNextRuns } from '../cron'

describe('parseCron', () => {
  it('parses simple expressions', () => {
    const result = parseCron('0 * * * *')
    expect(result.valid).toBe(true)
    expect(result.fields![0]).toEqual([0])
    expect(result.fields![1]).toHaveLength(24)
  })

  it('parses step expressions', () => {
    const result = parseCron('*/15 * * * *')
    expect(result.valid).toBe(true)
    expect(result.fields![0]).toEqual([0, 15, 30, 45])
  })

  it('parses range expressions', () => {
    const result = parseCron('0 9-17 * * *')
    expect(result.valid).toBe(true)
    expect(result.fields![1]).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
  })

  it('parses list expressions', () => {
    const result = parseCron('0 9,12,18 * * *')
    expect(result.valid).toBe(true)
    expect(result.fields![1]).toEqual([9, 12, 18])
  })

  it('resolves aliases', () => {
    const result = parseCron('@daily')
    expect(result.valid).toBe(true)
    expect(result.fields![0]).toEqual([0])
    expect(result.fields![1]).toEqual([0])
  })

  it('rejects invalid field count', () => {
    const result = parseCron('0 0 *')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Expected 5 fields')
  })

  it('rejects out-of-range values', () => {
    const result = parseCron('60 * * * *')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('out of bounds')
  })

  it('rejects unknown aliases', () => {
    const result = parseCron('@never')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unknown alias')
  })

  it('provides a description', () => {
    const result = parseCron('0 0 * * *')
    expect(result.valid).toBe(true)
    expect(result.description).toBe('Once a day at midnight')
  })

  it('handles day-of-week names', () => {
    const result = parseCron('0 9 * * MON-FRI')
    expect(result.valid).toBe(true)
    expect(result.fields![4]).toEqual([1, 2, 3, 4, 5])
  })

  it('handles month names', () => {
    const result = parseCron('0 0 1 JAN,JUN *')
    expect(result.valid).toBe(true)
    expect(result.fields![3]).toEqual([1, 6])
  })
})

describe('getNextRuns', () => {
  it('computes next runs for hourly cron', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const runs = getNextRuns('0 * * * *', 3, from)
    expect(runs).not.toBeNull()
    expect(runs).toHaveLength(3)
    expect(runs![0]!.getMinutes()).toBe(0)
  })

  it('computes next runs for daily cron', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const runs = getNextRuns('0 0 * * *', 5, from)
    expect(runs).not.toBeNull()
    expect(runs).toHaveLength(5)
  })

  it('returns null for invalid expression', () => {
    const runs = getNextRuns('invalid', 5)
    expect(runs).toBeNull()
  })

  it('respects day-of-week constraints', () => {
    const from = new Date('2026-01-05T00:00:00Z') // Monday
    const runs = getNextRuns('0 9 * * 1', 3, from) // Mondays at 9am
    expect(runs).not.toBeNull()
    expect(runs).toHaveLength(3)
    for (const run of runs!) {
      expect(run.getDay()).toBe(1) // Monday
    }
  })
})
