import { useEffect } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useStore } from '@/store'
import { useSimulation } from '@/hooks/useSimulation'
import { useTheme } from '@/hooks/useTheme'
import { useShare } from '@/hooks/useShare'
import { DEFAULT_JOB_JSON } from '@/engine/constants'
import { toast } from 'sonner'
import {
  Play,
  Moon,
  Sun,
  Share2,
  RotateCcw,
  AlignLeft,
  Copy,
} from 'lucide-react'

export function CommandPalette() {
  const open = useStore((s) => s.commandPaletteOpen)
  const setOpen = useStore((s) => s.setCommandPaletteOpen)
  const initFromContent = useStore((s) => s.initFromContent)
  const editorContent = useStore((s) => s.editorContent)
  const generatedCode = useStore((s) => s.generatedCode)
  const setLanguage = useStore((s) => s.setLanguage)
  const recompute = useStore((s) => s.recompute)

  const { play, reset } = useSimulation()
  const { toggleTheme } = useTheme()
  const { copyShareUrl } = useShare()

  // Cmd+K opens palette (handled in useKeyboardShortcuts, but also here)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, setOpen])

  const runAction = (action: () => void) => {
    setOpen(false)
    setTimeout(action, 100)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Simulation">
          <CommandItem
            onSelect={() =>
              runAction(() => {
                reset()
                setTimeout(play, 50)
              })
            }
          >
            <Play className="mr-2 h-4 w-4" />
            Run Simulation
          </CommandItem>
          <CommandItem onSelect={() => runAction(reset)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Simulation
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Editor">
          <CommandItem
            onSelect={() =>
              runAction(() => {
                try {
                  const parsed = JSON.parse(editorContent)
                  initFromContent(JSON.stringify(parsed, null, 2))
                } catch {
                  toast.error('Cannot format invalid JSON')
                }
              })
            }
          >
            <AlignLeft className="mr-2 h-4 w-4" />
            Format JSON
          </CommandItem>
          <CommandItem
            onSelect={() => runAction(() => initFromContent(DEFAULT_JOB_JSON))}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Code">
          <CommandItem
            onSelect={() =>
              runAction(async () => {
                if (generatedCode) {
                  await navigator.clipboard.writeText(generatedCode)
                  toast.success('Code copied')
                }
              })
            }
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Generated Code
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('go'); setTimeout(recompute, 0) })}>
            Switch to Go
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('javascript'); setTimeout(recompute, 0) })}>
            Switch to JavaScript
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('python'); setTimeout(recompute, 0) })}>
            Switch to Python
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('ruby'); setTimeout(recompute, 0) })}>
            Switch to Ruby
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('rust'); setTimeout(recompute, 0) })}>
            Switch to Rust
          </CommandItem>
          <CommandItem onSelect={() => runAction(() => { setLanguage('java'); setTimeout(recompute, 0) })}>
            Switch to Java
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="UI">
          <CommandItem onSelect={() => runAction(toggleTheme)}>
            <Sun className="mr-2 h-4 w-4 dark:hidden" />
            <Moon className="mr-2 h-4 w-4 hidden dark:block" />
            Toggle Theme
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runAction(async () => {
                await copyShareUrl()
                toast.success('Share URL copied')
              })
            }
          >
            <Share2 className="mr-2 h-4 w-4" />
            Copy Share URL
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
