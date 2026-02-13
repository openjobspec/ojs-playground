import { useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber: { left?: number; right?: number }
}

function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const result: DiffLine[] = []

  // Simple LCS-based diff
  const m = beforeLines.length
  const n = afterLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  const diffOps: { type: 'same' | 'add' | 'remove'; line: string }[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      diffOps.unshift({ type: 'same', line: beforeLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: 'add', line: afterLines[j - 1] })
      j--
    } else {
      diffOps.unshift({ type: 'remove', line: beforeLines[i - 1] })
      i--
    }
  }

  let leftLine = 1
  let rightLine = 1
  for (const op of diffOps) {
    if (op.type === 'same') {
      result.push({ type: 'unchanged', content: op.line, lineNumber: { left: leftLine++, right: rightLine++ } })
    } else if (op.type === 'remove') {
      result.push({ type: 'removed', content: op.line, lineNumber: { left: leftLine++ } })
    } else {
      result.push({ type: 'added', content: op.line, lineNumber: { right: rightLine++ } })
    }
  }

  return result
}

interface DiffViewProps {
  before: string
  after: string
  beforeLabel?: string
  afterLabel?: string
}

export function DiffView({ before, after, beforeLabel = 'Before', afterLabel = 'After' }: DiffViewProps) {
  const diff = useMemo(() => computeDiff(before, after), [before, after])

  const hasChanges = diff.some((l) => l.type !== 'unchanged')

  if (!hasChanges) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No changes
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 items-center border-b">
        <div className="flex-1 px-3 text-[10px] font-medium text-red-400">{beforeLabel}</div>
        <div className="flex-1 px-3 text-[10px] font-medium text-green-400">{afterLabel}</div>
      </div>
      <ScrollArea className="flex-1">
        <div className="font-mono text-[11px]">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                'flex min-h-[20px]',
                line.type === 'added' && 'bg-green-500/10',
                line.type === 'removed' && 'bg-red-500/10',
              )}
            >
              <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none">
                {line.lineNumber.left ?? ''}
              </span>
              <span className="w-10 shrink-0 text-right pr-2 text-muted-foreground select-none">
                {line.lineNumber.right ?? ''}
              </span>
              <span className={cn(
                'w-4 shrink-0 text-center select-none',
                line.type === 'added' && 'text-green-500',
                line.type === 'removed' && 'text-red-500',
              )}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 whitespace-pre px-1">{line.content}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
