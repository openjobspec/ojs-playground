import { describe, it, expect } from 'vitest'
import { parseDuration, formatDuration, toIsoDuration } from '../duration'

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('PT1S')).toBe(1000)
    expect(parseDuration('PT30S')).toBe(30000)
  })

  it('parses fractional seconds', () => {
    expect(parseDuration('PT0.5S')).toBe(500)
    expect(parseDuration('PT1.5S')).toBe(1500)
  })

  it('parses minutes', () => {
    expect(parseDuration('PT1M')).toBe(60000)
    expect(parseDuration('PT5M')).toBe(300000)
  })

  it('parses hours', () => {
    expect(parseDuration('PT1H')).toBe(3600000)
  })

  it('parses combined durations', () => {
    expect(parseDuration('PT1H30M')).toBe(5400000)
    expect(parseDuration('PT1H2M3S')).toBe(3723000)
  })

  it('parses days', () => {
    expect(parseDuration('P1D')).toBe(86400000)
  })

  it('parses weeks', () => {
    expect(parseDuration('P1W')).toBe(604800000)
  })

  it('throws on invalid input', () => {
    expect(() => parseDuration('invalid')).toThrow()
    expect(() => parseDuration('1S')).toThrow()
    expect(() => parseDuration('')).toThrow()
  })
})

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(30000)).toBe('30s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(300000)).toBe('5m')
  })

  it('formats hours', () => {
    expect(formatDuration(3600000)).toBe('1h')
    expect(formatDuration(3723000)).toBe('1h 2m 3s')
  })
})

describe('toIsoDuration', () => {
  it('converts ms to ISO duration', () => {
    expect(toIsoDuration(1000)).toBe('PT1S')
    expect(toIsoDuration(60000)).toBe('PT1M')
    expect(toIsoDuration(300000)).toBe('PT5M')
    expect(toIsoDuration(3600000)).toBe('PT1H')
  })

  it('handles combined durations', () => {
    expect(toIsoDuration(3723000)).toBe('PT1H2M3S')
  })

  it('handles sub-minute durations', () => {
    expect(toIsoDuration(30000)).toBe('PT30S')
  })
})
