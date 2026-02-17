import * as React from "react"
import { cn } from "@/lib/utils"

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
}

const sizeClasses: Record<string, string> = {
  default: "h-9 px-2 min-w-9",
  sm: "h-8 px-1.5 min-w-8",
  lg: "h-10 px-2.5 min-w-10",
}

const variantClasses: Record<string, string> = {
  default: "bg-transparent",
  outline: "border border-input bg-transparent shadow-xs",
}

const baseClasses = "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none transition-colors whitespace-nowrap"

function Toggle({
  className,
  variant = "default",
  size = "default",
  pressed,
  onPressedChange,
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      data-state={pressed ? "on" : "off"}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        pressed && "bg-accent text-accent-foreground",
        className
      )}
      onClick={() => onPressedChange?.(!pressed)}
      {...props}
    />
  )
}

export { Toggle }
