import type { editor } from 'monaco-editor'
import type { MutableRefObject } from 'react'

export function syncExternalEditorContent(
  instance: editor.IStandaloneCodeEditor,
  nextValue: string,
  applyingExternalChange: MutableRefObject<boolean>,
): boolean {
  const model = instance.getModel()
  if (!model || model.getValue() === nextValue) return false

  const selections = instance.getSelections()
  applyingExternalChange.current = true
  try {
    instance.pushUndoStop()
    instance.executeEdits('ojs-external-store', [{
      range: model.getFullModelRange(),
      text: nextValue,
      forceMoveMarkers: true,
    }])
    instance.pushUndoStop()
    if (selections) instance.setSelections(selections)
  } finally {
    applyingExternalChange.current = false
  }
  return true
}

export function applyUserEditorChange(
  value: string | undefined,
  applyingExternalChange: MutableRefObject<boolean>,
  onChange: (value: string) => void,
): boolean {
  if (value === undefined || applyingExternalChange.current) return false
  onChange(value)
  return true
}
