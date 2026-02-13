import { useMemo } from 'react'
import { useStore } from '@/store'
import { BACKEND_DATA, getRecommendation, detectJobFeatures } from '@/engine/backends'
import type { BackendType } from '@/store/slices/comparison'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, X, Minus, Lightbulb } from 'lucide-react'

const ALL_BACKENDS: BackendType[] = ['redis', 'postgres', 'kafka', 'sqs', 'nats']

function FeatureIcon({ status }: { status: 'supported' | 'unsupported' | 'partial' }) {
  if (status === 'supported') return <Check className="h-3.5 w-3.5 text-green-500" />
  if (status === 'partial') return <Minus className="h-3.5 w-3.5 text-yellow-500" />
  return <X className="h-3.5 w-3.5 text-red-400" />
}

export function ComparisonPanel() {
  const selectedBackends = useStore((s) => s.selectedBackends)
  const toggleBackend = useStore((s) => s.toggleBackend)
  const parsedJob = useStore((s) => s.parsedJob)

  const recommendation = useMemo(() => {
    if (!parsedJob) return null
    const features = detectJobFeatures(parsedJob as unknown as Record<string, unknown>)
    return getRecommendation(features)
  }, [parsedJob])

  const featureNames = useMemo(() => {
    const allFeatures = new Set<string>()
    for (const backend of selectedBackends) {
      const data = BACKEND_DATA[backend]
      if (data) Object.keys(data.features).forEach((f) => allFeatures.add(f))
    }
    return Array.from(allFeatures)
  }, [selectedBackends])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <span className="text-sm font-medium">Backend Comparison</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b p-2">
        {ALL_BACKENDS.map((b) => (
          <Button
            key={b}
            size="sm"
            variant={selectedBackends.includes(b) ? 'default' : 'outline'}
            className="h-6 px-2 text-xs"
            onClick={() => toggleBackend(b)}
          >
            {BACKEND_DATA[b].name}
          </Button>
        ))}
      </div>

      {recommendation && (
        <Card className="m-2 p-2.5 bg-accent/50">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium">
                Recommended: {BACKEND_DATA[recommendation.backend].name}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {recommendation.reason}
              </p>
            </div>
          </div>
        </Card>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Performance Summary */}
          <div className="mb-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${selectedBackends.length}, 1fr)` }}>
            {selectedBackends.map((b) => {
              const data = BACKEND_DATA[b]
              return (
                <Card key={b} className="p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium">{data.name}</span>
                    <Badge variant="outline" className="h-4 text-[9px]">L{data.conformanceLevel}</Badge>
                  </div>
                  <div className="space-y-0.5 text-[10px] text-muted-foreground">
                    <div>Throughput: {data.performance.throughput}</div>
                    <div>p50: {data.performance.p50}</div>
                    <div>p99: {data.performance.p99}</div>
                    <div>Max payload: {data.performance.maxPayload}</div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                    {data.tradeoff}
                  </p>
                </Card>
              )
            })}
          </div>

          {/* Feature Matrix */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-7 w-[180px]">Feature</TableHead>
                {selectedBackends.map((b) => (
                  <TableHead key={b} className="text-xs h-7 text-center">
                    {BACKEND_DATA[b].name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {featureNames.map((feature) => (
                <TableRow key={feature}>
                  <TableCell className="text-xs py-1.5">{feature}</TableCell>
                  {selectedBackends.map((b) => (
                    <TableCell key={b} className="text-center py-1.5">
                      <div className="flex justify-center">
                        <FeatureIcon status={BACKEND_DATA[b].features[feature] ?? 'unsupported'} />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  )
}
