import { describe, it, expect } from 'vitest'
import { encodeState, decodeState } from '../sharing'
import type { ShareableState } from '../types'

describe('sharing', () => {
  const testState: ShareableState = {
    spec: JSON.stringify({
      specversion: '1.0.0-rc.1',
      id: '019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
      type: 'email.send',
      queue: 'default',
      args: ['user@example.com', 'welcome'],
    }),
    editorMode: 'json',
    language: 'go',
    scope: 'full',
    scenario: 'success_first_attempt',
    strategy: 'exponential',
  }

  it('round-trips encode/decode', () => {
    const encoded = encodeState(testState)
    const decoded = decodeState(encoded)
    expect(decoded).toEqual(testState)
  })

  it('encoded string starts with #/s/', () => {
    const encoded = encodeState(testState)
    expect(encoded.startsWith('#/s/')).toBe(true)
  })

  it('produces reasonable URL length', () => {
    const encoded = encodeState(testState)
    // Compressed state should be reasonable for a URL
    expect(encoded.length).toBeLessThan(2000)
  })

  it('decodes to null for invalid hash', () => {
    expect(decodeState('')).toBeNull()
    expect(decodeState('#/other')).toBeNull()
    expect(decodeState('#/s/')).toBeNull()
  })

  it('decodes to null for corrupted data', () => {
    expect(decodeState('#/s/!!invalid!!')).toBeNull()
  })

  it('handles minimal state', () => {
    const minimal: ShareableState = { spec: '{}' }
    const encoded = encodeState(minimal)
    const decoded = decodeState(encoded)
    expect(decoded).toEqual(minimal)
  })
})
