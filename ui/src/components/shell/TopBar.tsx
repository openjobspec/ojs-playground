import { useTheme } from '@/hooks/useTheme'
import { useShare } from '@/hooks/useShare'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Moon, Sun, Monitor, Share2 } from 'lucide-react'
import { toast } from 'sonner'

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { copyShareUrl } = useShare()

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
    <div className="flex h-11 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <rect width="24" height="24" rx="4" fill="hsl(var(--primary))" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontFamily="system-ui"
              fontWeight="bold"
              fontSize="10"
              fill="hsl(var(--primary-foreground))"
            >
              OJS
            </text>
          </svg>
          <span className="text-sm font-semibold">Playground</span>
        </div>
        <Badge variant="outline" className="h-5 text-[10px]">
          Browser Mode
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleShare}
          title="Copy share URL"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
