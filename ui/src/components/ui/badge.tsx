import * as React from "react"
import { cn } from "@/lib/utils"

const variantClasses: Record<string, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive text-white",
  outline: "border border-border text-foreground",
  ghost: "",
  link: "text-primary underline-offset-4",
}

const baseClasses = "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantClasses
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  )
}

export { Badge }
