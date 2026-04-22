import { describe, expect, it, vi } from 'vitest'
import type { editor } from 'monaco-editor'
import {
  applyUserEditorChange,
  syncExternalEditorContent,
} from './monaco-sync'

describe('Monaco external store synchronization', () => {
  it('applies programmatic changes once without feeding them back as user edits', () => {
    let value = '{"old":true}'
    const applying = { current: false }
    const onUserChange = vi.fn()
    const selection = { marker: 'cursor' }
    const setSelections = vi.fn()
    const executeEdits = vi.fn((_source: string, edits: Array<{ text: string }>) => {
      value = edits[0]!.text
      applyUserEditorChange(value, applying, onUserChange)
      return true
    })
    const instance = {
      getModel: () => ({
        getValue: () => value,
        getFullModelRange: () => ({ marker: 'range' }),
      }),
      getSelections: () => [selection],
      setSelections,
      pushUndoStop: vi.fn(),
      executeEdits,
    } as unknown as editor.IStandaloneCodeEditor

    expect(syncExternalEditorContent(instance, '{"new":true}', applying)).toBe(true)
    expect(value).toBe('{"new":true}')
    expect(executeEdits).toHaveBeenCalledTimes(1)
    expect(onUserChange).not.toHaveBeenCalled()
    expect(setSelections).toHaveBeenCalledWith([selection])

    expect(syncExternalEditorContent(instance, '{"new":true}', applying)).toBe(false)
    expect(executeEdits).toHaveBeenCalledTimes(1)
  })

  it('forwards genuine user typing efficiently', () => {
    const applying = { current: false }
    const onUserChange = vi.fn()

    expect(applyUserEditorChange('typed', applying, onUserChange)).toBe(true)
    expect(onUserChange).toHaveBeenCalledWith('typed')

    applying.current = true
    expect(applyUserEditorChange('external', applying, onUserChange)).toBe(false)
    expect(onUserChange).toHaveBeenCalledTimes(1)
  })
})
