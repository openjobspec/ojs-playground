import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'

const ONBOARDING_KEY = 'ojs-playground-onboarded'

export function WelcomeOverlay() {
  const showOnboarding = useStore((s) => s.showOnboarding)
  const setShowOnboarding = useStore((s) => s.setShowOnboarding)

  const hasSeenBefore = localStorage.getItem(ONBOARDING_KEY) === 'true'

  if (hasSeenBefore && !showOnboarding) return null

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowOnboarding(false)
  }

  return (
    <Dialog open={showOnboarding && !hasSeenBefore} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
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
            Welcome to OJS Playground
          </DialogTitle>
          <DialogDescription>
            Explore the Open Job Spec standard interactively. Everything runs
            in your browser — no backend required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-2">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">1</span>
            <span>Edit the job spec on the left — autocomplete guides you</span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">2</span>
            <span>Watch the state machine animate in the center</span>
          </div>
          <div className="flex gap-2">
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">3</span>
            <span>Copy generated SDK code from the right panel</span>
          </div>
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Cmd+K</kbd>{' '}
          for command palette &middot;{' '}
          <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Cmd+Enter</kbd>{' '}
          to run simulation
        </div>

        <Button onClick={handleDismiss} className="w-full mt-2">
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  )
}
