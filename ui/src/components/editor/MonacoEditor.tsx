import { useRef, useCallback, useEffect } from 'react'
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { findLineForPath } from '@/engine/validator'
import { getEmbedOptions } from '@/engine/embed-config'
import { applyUserEditorChange, syncExternalEditorContent } from './monaco-sync'

import jobSchema from '../../../public/schema/job.schema.json'
import retrySchema from '../../../public/schema/retry-policy.schema.json'
import uniqueSchema from '../../../public/schema/unique-policy.schema.json'
import errorSchema from '../../../public/schema/error.schema.json'

export function MonacoEditor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const applyingExternalChangeRef = useRef(false)
  const editorContent = useStore((s) => s.editorContent)
  const editorMode = useStore((s) => s.editorMode)
  const validationResult = useStore((s) => s.validationResult)
  const initFromContent = useStore((s) => s.initFromContent)
  const { resolvedTheme } = useTheme()
  const readOnly = getEmbedOptions().readonly

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance

      // Register JSON schemas for autocomplete
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: 'https://openjobspec.org/schemas/v1/job.json',
            fileMatch: ['*'],
            schema: jobSchema as Record<string, unknown>,
          },
          {
            uri: 'https://openjobspec.org/schemas/v1/retry-policy.json',
            fileMatch: [],
            schema: retrySchema as Record<string, unknown>,
          },
          {
            uri: 'https://openjobspec.org/schemas/v1/unique-policy.json',
            fileMatch: [],
            schema: uniqueSchema as Record<string, unknown>,
          },
          {
            uri: 'https://openjobspec.org/schemas/v1/error.json',
            fileMatch: [],
            schema: errorSchema as Record<string, unknown>,
          },
        ],
      })

      syncExternalEditorContent(editorInstance, editorContent, applyingExternalChangeRef)
    },
    [editorContent],
  )

  const handleChange: OnChange = useCallback(
    (value) => {
      applyUserEditorChange(value, applyingExternalChangeRef, initFromContent)
    },
    [initFromContent],
  )

  useEffect(() => {
    const instance = editorRef.current
    if (instance) {
      syncExternalEditorContent(instance, editorContent, applyingExternalChangeRef)
    }
  }, [editorContent])

  // Update Monaco markers from Ajv validation
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const monaco = (window as unknown as { monaco?: typeof import('monaco-editor') }).monaco
    if (!monaco) return

    const model = editor.getModel()
    if (!model) return

    if (validationResult.valid) {
      monaco.editor.setModelMarkers(model, 'ojs', [])
    } else {
      const source = model.getValue()
      const markers: editor.IMarkerData[] = validationResult.errors
        .filter((e) => e.keyword !== 'parse')
        .map((err) => {
          const line = findLineForPath(source, err.path)
          return {
            severity: 8, // MarkerSeverity.Error
            message: err.message,
            startLineNumber: line,
            startColumn: 1,
            endLineNumber: line,
            endColumn: model.getLineMaxColumn(line),
          }
        })
      monaco.editor.setModelMarkers(model, 'ojs', markers)
    }
  }, [validationResult])

  return (
    <Editor
      height="100%"
      language={editorMode === 'yaml' ? 'yaml' : 'json'}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
      defaultValue={editorContent}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        readOnly,
        formatOnPaste: true,
        suggest: {
          showWords: false,
        },
      }}
      loading={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Loading editor...
        </div>
      }
    />
  )
}
