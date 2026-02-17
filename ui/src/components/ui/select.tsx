import * as React from "react"
import { ChevronDownIcon, CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
})

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const currentValue = value ?? internalValue

  const handleChange = React.useCallback((v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
    setOpen(false)
  }, [onValueChange])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handleClick = () => setOpen(false)
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [open])

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange, open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </SelectContext.Provider>
  )
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = React.useContext(SelectContext)
  return <span className="truncate">{ctx.value || placeholder || ""}</span>
}

function SelectTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string }) {
  const ctx = React.useContext(SelectContext)
  return (
    <button
      type="button"
      className={cn(
        "border-input flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-colors outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        ctx.setOpen(!ctx.open)
      }}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50 shrink-0" />
    </button>
  )
}

function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = React.useContext(SelectContext)
  if (!ctx.open) return null
  return (
    <div
      className={cn(
        "bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 min-w-[8rem] w-full overflow-hidden rounded-md border shadow-md",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <div className="p-1 max-h-60 overflow-y-auto">{children}</div>
    </div>
  )
}

function SelectItem({ className, children, value, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(SelectContext)
  const isSelected = ctx.value === value
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent/50",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {isSelected && (
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          <CheckIcon className="size-4" />
        </span>
      )}
      {children}
    </div>
  )
}

function SelectGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props}>{children}</div>
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)} {...props} />
}

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
