import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { JOB_TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from '@/engine/templates'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, FileCode } from 'lucide-react'

export function TemplatesPanel() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const initFromContent = useStore((s) => s.initFromContent)

  const filtered = useMemo(() => {
    return JOB_TEMPLATES.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (levelFilter !== 'all' && t.level !== Number(levelFilter)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.spec.type.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [search, categoryFilter, levelFilter])

  const handleUseTemplate = (spec: typeof JOB_TEMPLATES[0]['spec']) => {
    initFromContent(JSON.stringify(spec, null, 2))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center border-b px-3">
        <span className="text-sm font-medium">Templates</span>
        <Badge variant="outline" className="ml-2 h-5 text-[10px]">
          {filtered.length}
        </Badge>
      </div>
      <div className="flex flex-col gap-2 border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <div className="flex gap-1.5">
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as TemplateCategory | 'all')}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {[0, 1, 2, 3, 4].map((l) => (
                <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-2">
          {filtered.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer p-2.5 transition-colors hover:bg-accent"
              onClick={() => handleUseTemplate(template.spec)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">{template.title}</span>
                </div>
                <Badge variant="outline" className="h-4 shrink-0 text-[9px]">
                  L{template.level}
                </Badge>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                {template.description}
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                <code className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                  {template.spec.type}
                </code>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No templates match your search
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
