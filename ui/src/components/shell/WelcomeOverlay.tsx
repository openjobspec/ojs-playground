import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { Code2, Play, Copy, ArrowRight } from 'lucide-react'

const ONBOARDING_KEY = 'ojs-playground-onboarded'

const LIFECYCLE_STATES = ['available', 'active', 'completed']

export function WelcomeOverlay() {
  const showOnboarding = useStore((s) => s.showOnboarding)
  const setShowOnboarding = useStore((s) => s.setShowOnboarding)

  const hasSeenBefore = localStorage.getItem(ONBOARDING_KEY) === 'true'

  const isOpen = showOnboarding && !hasSeenBefore
  if (!isOpen) return null

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShowOnboarding(false)
  }

  const steps = [
    { icon: Code2, label: 'Edit', desc: 'Write your job spec on the left — autocomplete guides you' },
    { icon: Play, label: 'Visualize', desc: 'Watch the state machine animate in the center panel' },
    { icon: Copy, label: 'Generate', desc: 'Copy generated SDK code from the right panel' },
  ]

  return (
    <Dialog open={showOnboarding} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold">
              OJS
            </div>
            Welcome to OJS Playground
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Explore the Open Job Spec standard interactively. Everything runs
            in your browser — no backend required.
          </DialogDescription>
        </DialogHeader>

        {/* Animated lifecycle hero */}
        <div className="flex items-center justify-center gap-2 py-3">
          {LIFECYCLE_STATES.map((state, i) => (
            <div key={state} className="flex items-center gap-2">
              <div
                className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium flex items-center animate-pulse"
                style={{ animationDelay: `${i * 0.3}s`, animationDuration: '2s' }}
              >
                {state}
              </div>
              {i < LIFECYCLE_STATES.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 mt-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-3 bg-muted/30">
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10 text-primary shrink-0">
                <step.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-[11px] font-mono border border-border/50">⌘K</kbd>
          <span>Command palette</span>
          <span className="text-border">·</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-[11px] font-mono border border-border/50">⌘↵</kbd>
          <span>Run simulation</span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <a href="https://openjobspec.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Read the spec
          </a>
          <span>·</span>
          <a href="https://github.com/openjobspec" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            GitHub
          </a>
        </div>

        <Button onClick={handleDismiss} className="w-full mt-2">
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  )
}
