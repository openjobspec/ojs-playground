import { useStore } from '@/store'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

export function ProblemsPanel() {
  const validationResult = useStore((s) => s.validationResult)
  const [open, setOpen] = useState(true)

  if (validationResult.valid) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium hover:bg-accent">
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
        />
        Problems ({validationResult.errors.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="max-h-32 overflow-y-auto px-3 pb-2">
          {validationResult.errors.map((err, i) => (
            <div key={i} className="flex gap-2 py-0.5 text-xs">
              <span className="font-mono text-destructive">{err.path}</span>
              <span className="text-muted-foreground">{err.message}</span>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
