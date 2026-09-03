import { useState } from 'react'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Copy, Download, Code2, FolderDown } from 'lucide-react'
import { toast } from 'sonner'
import { trackEvent } from '@/engine/analytics'
import { getEmbedSnippet } from '@/components/embed/EmbedLayout'
import { downloadProjectArchive } from '@/engine/project'

const fileExtensions: Record<string, string> = {
  go: 'go',
  javascript: 'ts',
  python: 'py',
  ruby: 'rb',
  rust: 'rs',
  java: 'java',
}

const installCommands: Record<string, string> = {
  go: 'go get github.com/openjobspec/ojs-go-sdk',
  javascript: 'npm install @openjobspec/sdk',
  python: 'pip install openjobspec',
  ruby: 'gem install openjobspec',
  rust: 'cargo add ojs-sdk',
  java: 'mvn add org.openjobspec:ojs-java-sdk',
}

export function CodeActions() {
  const generatedCode = useStore((s) => s.generatedCode)
  const language = useStore((s) => s.language)
  const editorContent = useStore((s) => s.editorContent)
  const parsedJob = useStore((s) => s.parsedJob)
  const isValid = useStore((s) => s.validationResult.valid)
  const [embedOpen, setEmbedOpen] = useState(false)

  const handleCopy = async () => {
    if (!generatedCode) return
    await navigator.clipboard.writeText(generatedCode)
    toast.success('Code copied to clipboard')
    trackEvent('code_copied', { language })
  }

  const handleDownload = () => {
    if (!generatedCode) return
    const ext = fileExtensions[language] ?? 'txt'
    const blob = new Blob([generatedCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ojs-example.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    trackEvent('code_downloaded', { language })
  }

  const handleCopyQuickstart = async () => {
    if (!generatedCode) return
    const quickstart = `# Install\n$ ${installCommands[language]}\n\n# Code\n${generatedCode}`
    await navigator.clipboard.writeText(quickstart)
    toast.success('Quickstart copied (install + code)')
    trackEvent('code_copied', { language, quickstart: true })
  }

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={handleCopy}
          disabled={!generatedCode}
        >
          <Copy className="h-3 w-3" />
          Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 gap-1 text-xs"
          onClick={handleDownload}
          disabled={!generatedCode}
        >
          <Download className="h-3 w-3" />
          Download
        </Button>
      </div>
      <Button
        size="sm"
        variant="default"
        className="h-7 w-full gap-1 text-xs"
        onClick={handleCopyQuickstart}
        disabled={!generatedCode}
      >
        <Copy className="h-3 w-3" />
        Copy Quickstart
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1 text-xs"
        onClick={() => {
          if (parsedJob && isValid) {
            downloadProjectArchive(parsedJob, language)
            trackEvent('code_downloaded', { language, project: true })
            toast.success('Starter project downloaded')
          } else {
            toast.error('Fix validation errors before downloading a project')
          }
        }}
        disabled={!parsedJob || !isValid}
      >
        <FolderDown className="h-3 w-3" />
        Download Project
      </Button>
      <div className="rounded bg-muted px-2 py-1.5">
        <code className="text-[10px] text-muted-foreground">
          $ {installCommands[language]}
        </code>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-full gap-1 text-[10px] text-muted-foreground"
        onClick={() => setEmbedOpen(true)}
      >
        <Code2 className="h-3 w-3" />
        Embed this playground
      </Button>

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">Embed Playground</DialogTitle>
            <DialogDescription className="text-xs">
              Copy this snippet to embed an interactive OJS Playground in your documentation.
            </DialogDescription>
          </DialogHeader>
          <pre className="rounded bg-muted p-3 text-[10px] font-mono overflow-auto max-h-32 whitespace-pre-wrap">
            {getEmbedSnippet(editorContent)}
          </pre>
          <Button
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(getEmbedSnippet(editorContent))
              toast.success('Embed snippet copied')
              setEmbedOpen(false)
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Snippet
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
