import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const alertVariants = cva(
  "group/alert relative grid w-full gap-x-3 gap-y-1 rounded-surface px-3.5 py-3 text-left type-row has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] *:[svg]:col-start-1 *:[svg]:row-start-1 *:[svg]:row-span-full *:[svg]:self-start *:[svg]:mt-0.5 *:[svg]:shrink-0 *:[svg]:text-current",
  {
    variants: {
      /** `center`: a one-line alert, its icon beside the text instead of at its top. */
      align: {
        top: "",
        center: "items-center *:[svg]:mt-0 *:[svg]:self-center",
      },
      variant: {
        default: "bg-fill text-foreground",
        destructive:
          "bg-tint-red/16 text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        warning:
          "bg-tint-amber/15 text-tint-amber *:data-[slot=alert-description]:text-tint-amber *:[svg]:text-current",
        info: "bg-selected text-foreground *:data-[slot=alert-description]:text-tint-mint/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
      align: "top",
    },
  }
)

function Alert({
  className,
  variant,
  align,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, align }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "type-group text-foreground group-has-[>svg]/alert:col-start-2 group-has-[>svg]/alert:row-start-1 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
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
        "type-row text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
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

export {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
}
