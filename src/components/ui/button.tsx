import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full type-row transition-[color,background-color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none cursor-pointer",
  {
    variants: {
      variant: {
        /** Disabled, it turns a solid grey like an iOS button, rather than a faded mint. */
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-fill-2 disabled:text-muted-foreground disabled:opacity-100",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary:
          "bg-field text-foreground hover:bg-foreground/20 active:bg-foreground/25",
        ghost: "text-muted-foreground hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15",
        link: "text-tint-mint underline-offset-4 hover:underline",
        tinted: "glassy text-muted-foreground hover:text-foreground hover:bg-foreground/10 active:bg-foreground/15",
        /** "More of these": dashed like an empty slot of the chips it extends, so it never reads as a menu. */
        pill: "bg-fill text-muted-foreground tabular-nums hover:bg-fill-2 hover:text-foreground",
        /** An on state of a pill: the mint tint of a selected chip. */
        selected: "bg-selected text-foreground hover:bg-primary/50",
        /** A bare control on glass or a tinted bar; it keeps the colour around it. */
        quiet: "hover:bg-fill-2 active:bg-fill-2 aria-expanded:bg-fill-2",
        more: "bg-transparent border border-dashed border-foreground/20 text-muted-foreground tabular-nums hover:bg-fill hover:text-foreground",
      },
      size: {
        default: "hit-target h-control-lg px-5 type-group",
        /** The one prominent action at the end of a sheet. */
        lg: "h-12 px-6 type-group",
        sm: "hit-target h-control-md px-3 type-group",
        /** A link beside text or a pill: no box, only its 44px target. */
        inline: "hit-target gap-1.5 type-group",
        chip: "hit-target h-control-sm gap-1.25 px-2.75 type-group",
        icon: "h-11 w-11",
        "icon-2xs": "hit-target size-control-sm",
        "icon-sm": "hit-target size-control-lg",
        "icon-xs": "hit-target size-control-md",
        row: "w-full h-auto min-h-13 justify-start gap-3 py-2.5 px-4 rounded-none font-normal text-left transition-colors focus-visible:outline-none focus-visible:bg-muted/50",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  render,
  ...props
}: useRender.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants>) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(buttonVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "button",
      variant,
      size,
    },
  })
}

export { Button, buttonVariants }
