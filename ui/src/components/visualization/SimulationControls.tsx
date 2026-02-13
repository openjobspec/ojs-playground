import { useSimulation } from '@/hooks/useSimulation'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Pause, SkipForward, RotateCcw } from 'lucide-react'
import type { SimulationScenario, BackoffStrategy } from '@/engine/types'

const scenarios: { value: SimulationScenario; label: string }[] = [
  { value: 'success_first_attempt', label: 'Success (1st attempt)' },
  { value: 'success_after_retries', label: 'Success after retries' },
  { value: 'exhausted', label: 'Retries exhausted' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'non_retryable_error', label: 'Non-retryable error' },
  { value: 'scheduled_then_success', label: 'Scheduled → Success' },
]

const strategies: { value: BackoffStrategy; label: string }[] = [
  { value: 'exponential', label: 'Exponential' },
  { value: 'linear', label: 'Linear' },
  { value: 'polynomial', label: 'Polynomial' },
  { value: 'none', label: 'Constant' },
]

const speeds: { value: string; label: string }[] = [
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '5', label: '5x' },
]

export function SimulationControls() {
  const { play, stepForward, reset, stopPlayback, isSimulating } = useSimulation()
  const scenario = useStore((s) => s.scenario)
  const strategy = useStore((s) => s.strategy)
  const speed = useStore((s) => s.speed)
  const setScenario = useStore((s) => s.setScenario)
  const setStrategy = useStore((s) => s.setStrategy)
  const setSpeed = useStore((s) => s.setSpeed)
  const recompute = useStore((s) => s.recompute)

  const handleScenarioChange = (value: string) => {
    setScenario(value as SimulationScenario)
    reset()
    setTimeout(() => recompute(), 0)
  }

  const handleStrategyChange = (value: string) => {
    setStrategy(value as BackoffStrategy)
    reset()
    setTimeout(() => recompute(), 0)
  }

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isSimulating ? 'secondary' : 'default'}
          onClick={isSimulating ? stopPlayback : play}
          className="h-7 gap-1"
        >
          {isSimulating ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isSimulating ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="outline" onClick={stepForward} className="h-7 gap-1" disabled={isSimulating}>
          <SkipForward className="h-3 w-3" />
          Step
        </Button>
        <Button size="sm" variant="outline" onClick={reset} className="h-7 gap-1">
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
        <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {speeds.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Select value={scenario} onValueChange={handleScenarioChange}>
          <SelectTrigger className="h-7 flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={strategy} onValueChange={handleStrategyChange}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {strategies.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
