import { Suspense, lazy, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { Skeleton } from '@/components/ui/skeleton'

const Editor = lazy(() => import('@monaco-editor/react'))

const languageMap: Record<string, string> = {
  go: 'go',
  javascript: 'typescript',
  python: 'python',
  ruby: 'ruby',
  rust: 'rust',
  java: 'java',
}

export function CodeOutput() {
  const generatedCode = useStore((s) => s.generatedCode)
  const language = useStore((s) => s.language)
  const { resolvedTheme } = useTheme()
  const prevCodeRef = useRef<string>('')
  const editorRef = useRef<unknown>(null)

  // Flash changed lines when code updates
  useEffect(() => {
    const prev = prevCodeRef.current
    prevCodeRef.current = generatedCode

    if (!prev || !generatedCode || prev === generatedCode) return

    const editor = editorRef.current as { deltaDecorations?: (old: string[], decorations: unknown[]) => string[] } | null
    if (!editor?.deltaDecorations) return

    // Find changed lines
    const prevLines = prev.split('\n')
    const newLines = generatedCode.split('\n')
    const changedRanges: { startLineNumber: number; endLineNumber: number }[] = []

    for (let i = 0; i < newLines.length; i++) {
      if (prevLines[i] !== newLines[i]) {
        changedRanges.push({
          startLineNumber: i + 1,
          endLineNumber: i + 1,
        })
      }
    }

    if (changedRanges.length === 0) return

    const decorations = changedRanges.map((range) => ({
      range,
      options: {
        isWholeLine: true,
        className: 'code-highlight-flash',
      },
    }))

    const ids = editor.deltaDecorations([], decorations)
    // Remove flash after animation
    setTimeout(() => editor.deltaDecorations(ids, []), 1500)
  }, [generatedCode])

  if (!generatedCode) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Edit a valid job spec to see generated code
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full flex-col gap-2 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      }
    >
      <Editor
        height="100%"
        language={languageMap[language] ?? 'plaintext'}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
        value={generatedCode}
        onMount={(editor) => { editorRef.current = editor }}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 12,
          lineNumbers: 'off',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          renderLineHighlight: 'none',
          folding: false,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </Suspense>
  )
}
