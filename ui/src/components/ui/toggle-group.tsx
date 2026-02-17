import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleGroupContextValue {
  value: string | string[]
  onValueChange: (value: string) => void
  type: "single" | "multiple"
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  value: "",
  onValueChange: () => {},
  type: "single",
})

interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string) => void
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

function ToggleGroup({
  className,
  type,
  value,
  defaultValue,
  onValueChange,
  variant = "default",
  size = "default",
  children,
  ...props
}: ToggleGroupProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? (type === "single" ? "" : []))
  const currentValue = value ?? internalValue

  const handleChange = React.useCallback((itemValue: string) => {
    if (type === "single") {
      setInternalValue(itemValue)
      onValueChange?.(itemValue)
    }
  }, [type, onValueChange])

  return (
    <ToggleGroupContext.Provider value={{ value: currentValue, onValueChange: handleChange, type, variant, size }}>
      <div
        role="group"
        className={cn("flex w-fit items-center rounded-md", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
}

const sizeClasses: Record<string, string> = {
  default: "h-9 px-3 min-w-9",
  sm: "h-8 px-2 min-w-8 text-xs",
  lg: "h-10 px-3 min-w-10",
}

interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

function ToggleGroupItem({ className, value, variant, size, children, ...props }: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext)
  const effectiveVariant = variant ?? ctx.variant ?? "default"
  const effectiveSize = size ?? ctx.size ?? "default"
  const isPressed = Array.isArray(ctx.value) ? ctx.value.includes(value) : ctx.value === value

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isPressed}
      data-state={isPressed ? "on" : "off"}
      className={cn(
        "inline-flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
        "hover:bg-muted hover:text-muted-foreground",
        sizeClasses[effectiveSize],
        effectiveVariant === "outline" && "border border-input bg-transparent shadow-xs first:rounded-l-md last:rounded-r-md border-l-0 first:border-l",
        effectiveVariant === "default" && "first:rounded-l-md last:rounded-r-md",
        isPressed && "bg-accent text-accent-foreground",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

export { ToggleGroup, ToggleGroupItem }
