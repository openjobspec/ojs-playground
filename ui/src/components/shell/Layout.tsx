import { Suspense, lazy } from 'react'
import { Allotment } from 'allotment'
import 'allotment/dist/style.css'
import { EditorPanel } from '@/components/editor/EditorPanel'
import { VisualizationPanel } from '@/components/visualization/VisualizationPanel'
import { CodegenPanel } from '@/components/codegen/CodegenPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { useStore } from '@/store'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

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
      <div className="flex items-center border-b px-2 h-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="h-6">
            <TabsTrigger value="code" className="h-5 px-2 text-[10px]">Code</TabsTrigger>
            <TabsTrigger value="templates" className="h-5 px-2 text-[10px]">Templates</TabsTrigger>
            <TabsTrigger value="comparison" className="h-5 px-2 text-[10px]">Backends</TabsTrigger>
            <TabsTrigger value="conformance" className="h-5 px-2 text-[10px]">Levels</TabsTrigger>
            <TabsTrigger value="tutorials" className="h-5 px-2 text-[10px]">Tutorials</TabsTrigger>
            <TabsTrigger value="cron" className="h-5 px-2 text-[10px]">Cron</TabsTrigger>
            <TabsTrigger value="dlq" className="h-5 px-2 text-[10px]">DLQ</TabsTrigger>
            <TabsTrigger value="backpressure" className="h-5 px-2 text-[10px]">Backpressure</TabsTrigger>
            <TabsTrigger value="queues" className="h-5 px-2 text-[10px]">Queues</TabsTrigger>
            <TabsTrigger value="middleware" className="h-5 px-2 text-[10px]">Middleware</TabsTrigger>
            {isLocalMode && (
              <>
                <TabsTrigger value="workers" className="h-5 px-2 text-[10px]">Workers</TabsTrigger>
                <TabsTrigger value="chaos" className="h-5 px-2 text-[10px]">Chaos</TabsTrigger>
                <TabsTrigger value="jobs" className="h-5 px-2 text-[10px]">Jobs</TabsTrigger>
                <TabsTrigger value="test-runner" className="h-5 px-2 text-[10px]">Tests</TabsTrigger>
              </>
            )}
          </TabsList>
        </Tabs>
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
