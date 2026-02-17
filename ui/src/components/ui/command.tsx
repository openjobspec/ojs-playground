import * as React from "react"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CommandContextValue {
  search: string
  setSearch: (search: string) => void
  selectedIndex: number
  setSelectedIndex: (index: number) => void
}

const CommandContext = React.createContext<CommandContextValue>({
  search: "",
  setSearch: () => {},
  selectedIndex: 0,
  setSelectedIndex: () => {},
})

function Command({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [search, setSearch] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)

  return (
    <CommandContext.Provider value={{ search, setSearch, selectedIndex, setSelectedIndex }}>
      <div className={cn("bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md", className)} {...props}>
        {children}
      </div>
    </CommandContext.Provider>
  )
}

interface CommandDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  open,
  onOpenChange,
}: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("overflow-hidden p-0", className)} showCloseButton={showCloseButton}>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({ className, placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const ctx = React.useContext(CommandContext)
  return (
    <div className="flex h-12 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <input
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        placeholder={placeholder}
        value={ctx.search}
        onChange={(e) => {
          ctx.setSearch(e.target.value)
          ctx.setSelectedIndex(0)
        }}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("max-h-[300px] overflow-x-hidden overflow-y-auto", className)} {...props}>
      {children}
    </div>
  )
}

function CommandEmpty({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(CommandContext)
  // Only show when there's a search with no results - let the parent handle visibility
  if (!ctx.search) return null
  return <div className="py-6 text-center text-sm" {...props}>{children}</div>
}

function CommandGroup({ className, heading, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { heading?: string }) {
  const ctx = React.useContext(CommandContext)

  // Filter children based on search
  const filteredChildren = React.Children.toArray(children).filter((child) => {
    if (!ctx.search) return true
    if (!React.isValidElement(child)) return false
    const text = getTextContent(child)
    return text.toLowerCase().includes(ctx.search.toLowerCase())
  })

  if (filteredChildren.length === 0) return null

  return (
    <div className={cn("overflow-hidden p-1", className)} {...props}>
      {heading && <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">{heading}</div>}
      {filteredChildren}
    </div>
  )
}

function getTextContent(element: React.ReactNode): string {
  if (typeof element === "string") return element
  if (typeof element === "number") return String(element)
  if (!React.isValidElement(element)) return ""
  const children = element.props.children
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(getTextContent).join("")
  return getTextContent(children)
}

function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-border -mx-1 h-px", className)} {...props} />
}

function CommandItem({ className, onSelect, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }) {
  return (
    <div
      role="option"
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      onClick={onSelect}
      {...props}
    >
      {children}
    </div>
  )
}

function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)} {...props} />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
