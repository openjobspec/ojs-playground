import { useStore } from '@/store'
import { TUTORIALS } from '@/engine/tutorials'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
  GraduationCap,
} from 'lucide-react'
import { useSimulation } from '@/hooks/useSimulation'

export function TutorialsPanel() {
  const activeTutorial = useStore((s) => s.activeTutorial)
  const currentStepIndex = useStore((s) => s.currentStepIndex)
  const startTutorial = useStore((s) => s.startTutorial)
  const nextStep = useStore((s) => s.nextStep)
  const prevStep = useStore((s) => s.prevStep)
  const exitTutorial = useStore((s) => s.exitTutorial)
  const initFromContent = useStore((s) => s.initFromContent)
  const tutorialProgress = useStore((s) => s.tutorialProgress)
  const { play, reset } = useSimulation()

  const tutorial = TUTORIALS.find((t) => t.id === activeTutorial)

  const handleStartTutorial = (id: string) => {
    startTutorial(id)
    const tut = TUTORIALS.find((t) => t.id === id)
    if (tut?.steps[0]?.spec) {
      initFromContent(tut.steps[0].spec)
    }
  }

  const handleNextStep = () => {
    if (!tutorial) return
    const nextIdx = currentStepIndex + 1
    if (nextIdx >= tutorial.steps.length) {
      exitTutorial()
      return
    }
    nextStep()
    const step = tutorial.steps[nextIdx]
    if (step?.spec && step.action === 'load_spec') {
      initFromContent(step.spec)
    }
    if (step?.action === 'run_simulation') {
      reset()
      setTimeout(play, 100)
    }
  }

  // Active tutorial view
  if (tutorial) {
    const step = tutorial.steps[currentStepIndex]
    const progress = ((currentStepIndex + 1) / tutorial.steps.length) * 100
    const isLast = currentStepIndex >= tutorial.steps.length - 1

    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center justify-between border-b px-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs font-medium truncate">{tutorial.title}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitTutorial}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Progress value={progress} className="h-1" />

        <div className="flex-1 p-3 overflow-auto">
          <div className="text-xs text-muted-foreground mb-1">
            Step {currentStepIndex + 1} of {tutorial.steps.length}
          </div>
          <h3 className="text-sm font-medium mb-2">{step?.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {step?.description}
          </p>
        </div>

        <div className="flex items-center justify-between border-t p-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={prevStep}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleNextStep}
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    )
  }

  // Tutorial list view
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <GraduationCap className="h-4 w-4 mr-2" />
        <span className="text-sm font-medium">Tutorials</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-2">
          {TUTORIALS.map((tut) => {
            const progress = tutorialProgress[tut.id]
            const isComplete = progress !== undefined && progress >= tut.steps.length - 1

            return (
              <Card
                key={tut.id}
                className="cursor-pointer p-2.5 transition-colors hover:bg-accent"
                onClick={() => handleStartTutorial(tut.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium">{tut.title}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="outline" className="h-4 text-[9px]">L{tut.level}</Badge>
                    {isComplete && (
                      <Badge variant="default" className="h-4 text-[9px] bg-green-600">✓</Badge>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {tut.description}
                </p>
                <div className="mt-1.5 text-[9px] text-muted-foreground">
                  {tut.steps.length} steps
                </div>
              </Card>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
