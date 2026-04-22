import { describe, expect, it } from 'vitest'
import { shouldIgnoreShortcutTarget } from './useKeyboardShortcuts'

describe('keyboard shortcut target scoping', () => {
  it('does not intercept Monaco or editable controls', () => {
    const monaco = document.createElement('div')
    monaco.className = 'monaco-editor'
    const monacoInput = document.createElement('textarea')
    monaco.appendChild(monacoInput)

    expect(shouldIgnoreShortcutTarget(monacoInput)).toBe(true)
    expect(shouldIgnoreShortcutTarget(document.createElement('input'))).toBe(true)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    expect(shouldIgnoreShortcutTarget(editable)).toBe(true)
  })

  it('allows shortcuts from non-editable application chrome', () => {
    expect(shouldIgnoreShortcutTarget(document.createElement('button'))).toBe(false)
    expect(shouldIgnoreShortcutTarget(window)).toBe(false)
  })
})
