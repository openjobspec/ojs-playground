import { Suspense, lazy, useState, useEffect } from 'react'
import { SimulationControls } from './SimulationControls'
import { RetryTimeline } from './RetryTimeline'
import { RetryControls } from './RetryControls'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStore } from '@/store'

const StateMachine = lazy(() =>
  import('./StateMachine').then((m) => ({ default: m.StateMachine })),
)
const DAGVisualization = lazy(() =>
  import('./DAGVisualization').then((m) => ({ default: m.DAGVisualization })),
)

export function VisualizationPanel() {
  const [vizTab, setVizTab] = useState<'lifecycle' | 'dag'>('lifecycle')
  const [bottomTab, setBottomTab] = useState<'timeline' | 'controls'>('timeline')
  const [announcement, setAnnouncement] = useState('')
  const activeState = useStore((s) => s.activeState)
  const activeEventIndex = useStore((s) => s.activeEventIndex)
  const simulationResult = useStore((s) => s.simulationResult)

  useEffect(() => {
    if (activeEventIndex < 0 || !simulationResult) return
    const event = simulationResult.events[activeEventIndex]
    if (event) {
      setAnnouncement(`${event.label}. State: ${event.to}. Attempt ${event.attempt}.`)
    }
  }, [activeEventIndex, simulationResult])

  return (
    <div className="flex h-full flex-col">
      {/* Screen reader announcements for simulation state changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Visualization</span>
        <Tabs value={vizTab} onValueChange={(v) => setVizTab(v as 'lifecycle' | 'dag')}>
          <TabsList className="h-6">
            <TabsTrigger value="lifecycle" className="h-5 px-2 text-[10px]">Lifecycle</TabsTrigger>
            <TabsTrigger value="dag" className="h-5 px-2 text-[10px]">Workflow DAG</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: '55%' }}>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-48 w-64" />
            </div>
          }
        >
          {vizTab === 'lifecycle' ? <StateMachine /> : <DAGVisualization />}
        </Suspense>
      </div>
      <SimulationControls />
      <div className="border-t flex flex-col" style={{ height: '25%', minHeight: 120 }}>
        <div className="flex items-center border-b px-2 h-7 shrink-0">
          <Tabs value={bottomTab} onValueChange={(v) => setBottomTab(v as 'timeline' | 'controls')}>
            <TabsList className="h-5">
              <TabsTrigger value="timeline" className="h-4 px-2 text-[10px]">Timeline</TabsTrigger>
              <TabsTrigger value="controls" className="h-4 px-2 text-[10px]">Retry Params</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {bottomTab === 'timeline' ? <RetryTimeline /> : <RetryControls />}
        </div>
      </div>
    </div>
  )
}
