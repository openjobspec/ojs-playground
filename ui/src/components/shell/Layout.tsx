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

const LazyFallback = (
  <div className="flex h-full items-center justify-center">
    <Skeleton className="h-24 w-48" />
  </div>
)

type RightTab = 'code' | 'templates' | 'comparison' | 'conformance' | 'tutorials'

export function Layout() {
  const activeTab = useStore((s) => s.activeTab) as RightTab
  const setActiveTab = useStore((s) => s.setActiveTab)

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
