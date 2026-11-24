import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const inputVariants = cva(
  "w-full min-w-0 type-field text-foreground outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:hidden",
  {
    variants: {
      variant: {
        /** A capsule field on its own. */
        field: "flex h-control-lg rounded-full bg-field px-3.5 py-1 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        /** The text of a composed field (search), whose wrapper draws the capsule. */
        bare: "h-full flex-1 bg-transparent focus-visible:ring-0",
      },
    },
    defaultVariants: {
      variant: "field",
    },
  }
)

function Input({ className, variant, ...props }: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return <input data-slot="input" className={cn(inputVariants({ variant }), className)} {...props} />
}

export { Input }
