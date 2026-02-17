import * as React from "react"

function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function TooltipTrigger({ children }: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  return <>{children}</>
}

function TooltipContent(_props: { children?: React.ReactNode; sideOffset?: number; className?: string }) {
  return null
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
