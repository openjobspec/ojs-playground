import { useTheme } from '@/hooks/useTheme'
import { useShare } from '@/hooks/useShare'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Moon, Sun, Monitor, Share2, Command } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store'

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { copyShareUrl } = useShare()
  const setCommandPaletteOpen = useStore((s) => s.setCommandPaletteOpen)

  const handleShare = async () => {
    try {
      const url = await copyShareUrl()
      toast.success('Share URL copied to clipboard', {
        description: url.slice(0, 60) + '...',
      })
    } catch {
      toast.error('Failed to copy URL')
    }
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
        <Badge variant="secondary" className="h-5 text-[10px] font-normal">
          Browser Mode
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setCommandPaletteOpen(true)}
          title="Command palette (⌘K)"
        >
          <Command className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleShare}
          title="Copy share URL"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
