import * as React from "react"

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({ open: false, toggle: () => {} })

interface CollapsibleProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function Collapsible({ open = false, onOpenChange, children, className }: CollapsibleProps) {
  const toggle = React.useCallback(() => onOpenChange?.(!open), [open, onOpenChange])
  return (
    <CollapsibleContext.Provider value={{ open, toggle }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
  children: React.ReactNode
}

function CollapsibleTrigger({ asChild, children, className, onClick, ...props }: CollapsibleTriggerProps) {
  const { toggle } = React.useContext(CollapsibleContext)

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    toggle()
    onClick?.(e)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        toggle();
        (children as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onClick?.(e)
      },
    })
  }

  return <button type="button" className={className} onClick={handleClick} {...props}>{children}</button>
}

function CollapsibleContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = React.useContext(CollapsibleContext)
  if (!open) return null
  return <div className={className} {...props}>{children}</div>
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
