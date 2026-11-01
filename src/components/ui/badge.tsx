import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-surface border border-transparent px-2 py-0.5 type-meta whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "bg-fill text-foreground [a]:hover:bg-fill-2",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-tint-mint underline-offset-4 hover:underline",
        muted: "bg-muted/50 text-muted-foreground border-transparent",
        soft: "border-transparent bg-selected text-foreground",
        /** Status chips on a detail hero card, such as the delay and live-data age. */
        hero: "h-6 px-2.5 rounded-full type-pill border-transparent bg-card",
        /** Beta marker next to a product or city name. */
        /** A fact on a card that does nothing when tapped: a validity, a count, a payment method. */
        info: "h-7 gap-1.5 px-2.75 rounded-full border-transparent bg-fill type-note tabular-nums text-muted-foreground",
        /** How many items a heading stands for. */
        count: "h-5 px-2 rounded-full border-transparent bg-fill type-badge tabular-nums tracking-normal text-muted-foreground",
        beta: "h-4 px-1.5 rounded-badge border-transparent bg-amber-500/15 type-badge text-amber-600 dark:text-amber-400",
        label: "border-transparent bg-fill type-group text-muted-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
