
import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/button"
import { CloseIcon } from "@/components/CloseIcon"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-3000 modal-scrim duration-100 pointer-events-auto data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  phoneLayout = 'card',
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  /** `page` fills a phone's screen, sliding up like a pushed page; `sheet` sits on the phone's bottom edge; `card` floats over the map sheet. */
  phoneLayout?: 'card' | 'page' | 'sheet'
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "glassy-thick fixed! top-1/2 left-1/2 z-3000 flex [--panel-gutter:1.5rem] max-md:[--panel-gutter:1rem] flex-col w-full max-w-lg h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] -translate-x-1/2 -translate-y-1/2 gap-0 rounded-sheet p-0 duration-100 outline-none overflow-hidden pointer-events-auto data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          phoneLayout === 'page' && "max-md:[--glass-material:var(--mat-opaque)] max-md:[backdrop-filter:none] max-md:[-webkit-backdrop-filter:none] max-md:glassy-edge-top max-md:inset-0 max-md:translate-x-0 max-md:translate-y-0 max-md:h-(--app-height) max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top,0px)] max-md:pb-[env(safe-area-inset-bottom,0px)] max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom-8 max-md:data-closed:zoom-out-100 max-md:data-closed:slide-out-to-bottom-8",
          phoneLayout === 'sheet' && "max-md:glassy-edge-top max-md:top-auto max-md:bottom-0 max-md:max-w-none max-md:translate-y-0 max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom,0px)] max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom-8 max-md:data-closed:zoom-out-100 max-md:data-closed:slide-out-to-bottom-8",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                className={cn("absolute top-5 right-5 text-muted-foreground hover:text-foreground", phoneLayout === 'page' && "max-md:top-[calc(1.25rem+env(safe-area-inset-top,0px))]")}
                variant="secondary"
                size="icon-xs"
              />
            }
          >
            <CloseIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="secondary" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("type-title", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "type-row text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
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
