import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-x-3 gap-y-1 rounded-2xl border p-3.5 text-left text-sm has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] *:[svg]:col-start-1 *:[svg]:row-start-1 *:[svg]:row-span-full *:[svg]:self-start *:[svg]:mt-0.5 *:[svg]:shrink-0 *:[svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/50 *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        warning:
          "bg-amber-500/15 text-amber-500 border-amber-500/40 *:data-[slot=alert-description]:text-amber-500/90 *:[svg]:text-current",
        subtle: "bg-card border border-border/50 shadow-sm text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold text-foreground leading-snug group-has-[>svg]/alert:col-start-2 group-has-[>svg]/alert:row-start-1 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-muted-foreground leading-relaxed [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        "group-has-[>svg]/alert:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
