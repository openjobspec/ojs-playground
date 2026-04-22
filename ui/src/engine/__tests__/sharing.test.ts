import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import { decodeState, decodeStateResult, encodeState } from '../sharing'
import type { ShareableState } from '../types'

describe('sharing', () => {
  const testState: ShareableState = {
    version: 1,
    spec: JSON.stringify({
      specversion: '1.0',
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
    const minimal: ShareableState = { spec: testState.spec }
    const encoded = encodeState(minimal)
    const decoded = decodeState(encoded)
    expect(decoded).toEqual(minimal)
  })

  it('retains valid legacy links without a version field', () => {
    const legacy = { spec: testState.spec, language: 'python', scope: 'worker' }
    const hash = encodeRawState(legacy)
    expect(decodeState(hash)).toEqual(legacy)
  })

  it.each([
    [{ ...testState, language: 'brainfuck' }, 'invalid_enum'],
    [{ ...testState, scope: 'everything' }, 'invalid_enum'],
    [{ ...testState, version: 2 }, 'invalid_version'],
    [{ ...testState, spec: '{"type":"missing-required-fields"}' }, 'invalid_spec'],
    [{ ...testState, unexpected: true }, 'invalid_shape'],
  ])('rejects invalid runtime state %#', (state, expectedError) => {
    const result = decodeStateResult(encodeRawState(state))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(expectedError)
  })

  it('rejects oversized strings and arrays inside an otherwise valid spec', () => {
    const base = JSON.parse(testState.spec) as Record<string, unknown>
    const longString = decodeStateResult(encodeRawState({
      spec: JSON.stringify({ ...base, args: ['x'.repeat(17 * 1024)] }),
    }))
    expect(longString.ok).toBe(false)
    if (!longString.ok) expect(longString.error).toBe('invalid_spec')

    const longArray = decodeStateResult(encodeRawState({
      spec: JSON.stringify({ ...base, args: Array.from({ length: 1001 }, () => null) }),
    }))
    expect(longArray.ok).toBe(false)
    if (!longArray.ok) expect(longArray.error).toBe('invalid_spec')
  })

  it('bounds encoded and decompressed share payloads', () => {
    const encodedTooLarge = decodeStateResult(`#/s/${'A'.repeat(16 * 1024 + 1)}`)
    expect(encodedTooLarge.ok).toBe(false)
    if (!encodedTooLarge.ok) expect(encodedTooLarge.error).toBe('too_large')

    const bomb = encodeRawState({ spec: 'A'.repeat(1024 * 1024) })
    expect(bomb.length).toBeLessThan(16 * 1024)
    const bombResult = decodeStateResult(bomb)
    expect(bombResult.ok).toBe(false)
    if (!bombResult.ok) expect(bombResult.error).toBe('too_large')
  })
})

function encodeRawState(state: unknown): string {
  return '#/s/' + LZString.compressToEncodedURIComponent(JSON.stringify(state))
}
