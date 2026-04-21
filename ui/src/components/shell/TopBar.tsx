import { useTheme } from '@/hooks/useTheme'
import { useShare } from '@/hooks/useShare'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Moon, Sun, Monitor, Share2, Command, HelpCircle, ExternalLink, Github } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store'

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { copyShareUrl } = useShare()
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen)
  const setShowOnboarding = useStore((s) => s.setShowOnboarding)
  const isLocalMode = useStore((s) => s.isLocalMode)

  const handleShare = async () => {
    try {
      const { url, isLocal } = await copyShareUrl()
      if (isLocal) {
        toast.warning('Short URL copied (works on this device only)', {
          description: 'Simplify your spec for a portable share URL.',
        })
      } else {
        toast.success('Share URL copied to clipboard', {
          description: url.slice(0, 60) + '...',
        })
      }
    } catch {
      toast.error('Failed to copy URL')
    }
  }

  const handleHelp = () => {
    localStorage.removeItem('ojs-playground-onboarded')
    setShowOnboarding(true)
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="flex h-12 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold">
            OJS
          </div>
          <span className="text-sm font-semibold tracking-tight">Playground</span>
        </div>
        <Badge
          variant="secondary"
          className="h-5 text-[10px] font-normal cursor-default"
          title={isLocalMode
            ? 'Connected to the local OJS Playground server'
            : 'Simulations run client-side in your browser — no backend server required'}
        >
          {isLocalMode ? 'Local Mode' : 'Browser Mode'}
        </Badge>
        <div className="hidden sm:flex items-center gap-1 ml-1">
          <a
            href="https://openjobspec.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Docs
          </a>
          <a
            href="https://github.com/openjobspec"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
          >
            <Github className="h-3 w-3" />
            GitHub
          </a>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          title="Command palette (⌘K)"
        >
          <Command className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleShare}
          aria-label="Copy share URL"
          title="Copy share URL"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          aria-label={`Change theme. Current theme: ${theme}`}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleHelp}
          aria-label="Open help and keyboard shortcuts"
          title="Help & shortcuts"
        >
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
