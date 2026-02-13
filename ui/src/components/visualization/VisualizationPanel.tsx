import { Suspense, lazy } from 'react'
import { SimulationControls } from './SimulationControls'
import { RetryTimeline } from './RetryTimeline'
import { Skeleton } from '@/components/ui/skeleton'

const StateMachine = lazy(() =>
  import('./StateMachine').then((m) => ({ default: m.StateMachine })),
)

export function VisualizationPanel() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <span className="text-sm font-medium">Visualization</span>
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: '55%' }}>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-48 w-64" />
            </div>
          }
        >
          <StateMachine />
        </Suspense>
      </div>
      <SimulationControls />
      <div className="border-t" style={{ height: '25%', minHeight: 120 }}>
        <RetryTimeline />
      </div>
    </div>
  )
}
