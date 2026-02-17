import { Suspense, lazy } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { EditorPanel } from '@/components/editor/EditorPanel'
import { VisualizationPanel } from '@/components/visualization/VisualizationPanel'
import { CodegenPanel } from '@/components/codegen/CodegenPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { useStore } from '@/store'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TemplatesPanel = lazy(() =>
  import('@/components/templates/TemplatesPanel').then((m) => ({ default: m.TemplatesPanel })),
)
const ComparisonPanel = lazy(() =>
  import('@/components/comparison/ComparisonPanel').then((m) => ({ default: m.ComparisonPanel })),
)
const ConformancePanel = lazy(() =>
  import('@/components/conformance/ConformancePanel').then((m) => ({ default: m.ConformancePanel })),
)
const TutorialsPanel = lazy(() =>
  import('@/components/tutorials/TutorialsPanel').then((m) => ({ default: m.TutorialsPanel })),
)
const WorkersPanel = lazy(() =>
  import('@/components/local/WorkersPanel').then((m) => ({ default: m.WorkersPanel })),
)
const ChaosPanel = lazy(() =>
  import('@/components/local/ChaosPanel').then((m) => ({ default: m.ChaosPanel })),
)
const CronPanel = lazy(() =>
  import('@/components/cron/CronPanel').then((m) => ({ default: m.CronPanel })),
)
const DeadLetterPanel = lazy(() =>
  import('@/components/dlq/DeadLetterPanel').then((m) => ({ default: m.DeadLetterPanel })),
)
const BackpressurePanel = lazy(() =>
  import('@/components/backpressure/BackpressurePanel').then((m) => ({ default: m.BackpressurePanel })),
)
const QueueConfigPanel = lazy(() =>
  import('@/components/queues/QueueConfigPanel').then((m) => ({ default: m.QueueConfigPanel })),
)
const MiddlewarePanel = lazy(() =>
  import('@/components/middleware/MiddlewarePanel').then((m) => ({ default: m.MiddlewarePanel })),
)
const JobDetailPanel = lazy(() =>
  import('@/components/local/JobDetailPanel').then((m) => ({ default: m.JobDetailPanel })),
)
const ConformanceRunnerPanel = lazy(() =>
  import('@/components/local/ConformanceRunnerPanel').then((m) => ({ default: m.ConformanceRunnerPanel })),
)

const LazyFallback = (
  <div className="flex h-full items-center justify-center">
    <Skeleton className="h-24 w-48" />
  </div>
)

type RightTab = 'code' | 'templates' | 'comparison' | 'conformance' | 'tutorials' | 'cron' | 'dlq' | 'backpressure' | 'queues' | 'middleware' | 'workers' | 'chaos' | 'jobs' | 'test-runner'

export function Layout() {
  const activeTab = useStore((s) => s.activeTab) as RightTab
  const setActiveTab = useStore((s) => s.setActiveTab)
  const isLocalMode = useStore((s) => s.isLocalMode)

  const renderRightPanel = () => {
    switch (activeTab) {
      case 'templates':
        return <Suspense fallback={LazyFallback}><TemplatesPanel /></Suspense>
      case 'comparison':
        return <Suspense fallback={LazyFallback}><ComparisonPanel /></Suspense>
      case 'conformance':
        return <Suspense fallback={LazyFallback}><ConformancePanel /></Suspense>
      case 'tutorials':
        return <Suspense fallback={LazyFallback}><TutorialsPanel /></Suspense>
      case 'cron':
        return <Suspense fallback={LazyFallback}><CronPanel /></Suspense>
      case 'dlq':
        return <Suspense fallback={LazyFallback}><DeadLetterPanel /></Suspense>
      case 'backpressure':
        return <Suspense fallback={LazyFallback}><BackpressurePanel /></Suspense>
      case 'queues':
        return <Suspense fallback={LazyFallback}><QueueConfigPanel /></Suspense>
      case 'middleware':
        return <Suspense fallback={LazyFallback}><MiddlewarePanel /></Suspense>
      case 'workers':
        return <Suspense fallback={LazyFallback}><WorkersPanel /></Suspense>
      case 'chaos':
        return <Suspense fallback={LazyFallback}><ChaosPanel /></Suspense>
      case 'jobs':
        return <Suspense fallback={LazyFallback}><JobDetailPanel /></Suspense>
      case 'test-runner':
        return <Suspense fallback={LazyFallback}><ConformanceRunnerPanel /></Suspense>
      case 'code':
      default:
        return <CodegenPanel />
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b px-2 h-9 gap-0.5 overflow-x-auto">
        {(['code', 'templates', 'comparison', 'conformance', 'tutorials', 'cron', 'dlq', 'backpressure', 'queues', 'middleware'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'h-6 px-2.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors',
              activeTab === tab
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab === 'code' ? 'Code' : tab === 'dlq' ? 'DLQ' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {isLocalMode && (
          <>
            {(['workers', 'chaos', 'jobs', 'test-runner'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'h-6 px-2.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-colors',
                  activeTab === tab
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {tab === 'test-runner' ? 'Tests' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Allotment defaultSizes={[35, 40, 25]}>
          <Allotment.Pane minSize={250}>
            <ErrorBoundary fallbackTitle="Editor error">
              <EditorPanel />
            </ErrorBoundary>
          </Allotment.Pane>
          <Allotment.Pane minSize={300}>
            <ErrorBoundary fallbackTitle="Visualization error">
              <VisualizationPanel />
            </ErrorBoundary>
          </Allotment.Pane>
          <Allotment.Pane minSize={200}>
            <ErrorBoundary fallbackTitle="Panel error">
              {renderRightPanel()}
            </ErrorBoundary>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  )
}
