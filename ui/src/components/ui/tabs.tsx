import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({ value: "", onValueChange: () => {} })

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
}

function Tabs({ className, value, defaultValue, onValueChange, children, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const currentValue = value ?? internalValue
  const handleChange = React.useCallback((v: string) => {
    setInternalValue(v)
    onValueChange?.(v)
  }, [onValueChange])

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleChange }}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-muted rounded-lg p-[3px] h-9 text-muted-foreground inline-flex w-fit items-center justify-center",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, value, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  const isActive = ctx.value === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ className, value, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext)
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" className={cn("flex-1 outline-none", className)} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
