import { describe, it, expect } from 'vitest'
import { checkPayloadSize, formatBytes } from '../payload'

describe('checkPayloadSize', () => {
  it('measures total size correctly', () => {
    const content = JSON.stringify({ type: 'test', queue: 'default', args: [] })
    const result = checkPayloadSize(content)
    expect(result.totalBytes).toBeGreaterThan(0)
    expect(result.violations).toHaveLength(0)
  })

  it('detects envelope too large', () => {
    const result = checkPayloadSize('x'.repeat(11 * 1024 * 1024))
    expect(result.violations.some((v) => v.field === 'envelope' && v.severity === 'error')).toBe(true)
  })

  it('warns when envelope approaching limit', () => {
    const result = checkPayloadSize('x'.repeat(9 * 1024 * 1024))
    expect(result.violations.some((v) => v.field === 'envelope' && v.severity === 'warning')).toBe(true)
  })

  it('detects meta too large', () => {
    const largeMeta = { meta: { data: 'x'.repeat(70 * 1024) } }
    const result = checkPayloadSize(JSON.stringify(largeMeta))
    expect(result.violations.some((v) => v.field === 'meta')).toBe(true)
  })

  it('detects queue name too long', () => {
    const content = JSON.stringify({ queue: 'q'.repeat(300) })
    const result = checkPayloadSize(content)
    expect(result.violations.some((v) => v.field === 'queue')).toBe(true)
  })

  it('detects type name too long', () => {
    const content = JSON.stringify({ type: 't'.repeat(300) })
    const result = checkPayloadSize(content)
    expect(result.violations.some((v) => v.field === 'type')).toBe(true)
  })

  it('accepts valid payload', () => {
    const content = JSON.stringify({
      specversion: '1.0.0-rc.1',
      id: 'test',
      type: 'email.send',
      queue: 'default',
      args: ['user@example.com'],
    })
    const result = checkPayloadSize(content)
    expect(result.violations).toHaveLength(0)
  })

  it('handles invalid JSON gracefully', () => {
    const result = checkPayloadSize('not valid json {{{')
    expect(result.totalBytes).toBeGreaterThan(0)
  })
})

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
