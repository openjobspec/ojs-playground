import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'

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

  const handleCopy = async () => {
    if (!generatedCode) return
    await navigator.clipboard.writeText(generatedCode)
    toast.success('Code copied to clipboard')
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
      <div className="rounded bg-muted px-2 py-1.5">
        <code className="text-[10px] text-muted-foreground">
          $ {installCommands[language]}
        </code>
      </div>
    </div>
  )
}
