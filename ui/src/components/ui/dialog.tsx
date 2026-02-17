import * as React from "react"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange?.(false)}
      />
      {children}
    </div>
  )
}

function DialogTrigger({ children }: React.HTMLAttributes<HTMLElement>) {
  return <>{children}</>
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props}>{children}</button>
}

function DialogOverlay({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("fixed inset-0 z-50 bg-black/50", className)} {...props} />
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean
}

function DialogContent({ className, children, showCloseButton = true, ...props }: DialogContentProps) {
  return (
    <div
      className={cn(
        "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 shadow-lg sm:max-w-lg",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <button
          type="button"
          className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100"
          onClick={() => {
            // Walk up to find the backdrop click handler
            const overlay = document.querySelector('.fixed.inset-0.bg-black\\/50')
            if (overlay) (overlay as HTMLElement).click()
          }}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </div>
  )
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
  )
}

function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props}>
      {children}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg leading-none font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-muted-foreground text-sm", className)} {...props} />
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
