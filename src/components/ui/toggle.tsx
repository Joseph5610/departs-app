import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

/** An on/off control on a field fill that turns solid mint while pressed. */
const toggleVariants = cva(
  "hit-target inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 bg-field type-control tabular-nums text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-pressed:bg-primary data-pressed:text-primary-foreground disabled:cursor-default disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        /** A filter chip with a label. */
        chip: "h-control-sm rounded-full pr-2.75 pl-2.25",
        /** A square icon filter, as tall as a line badge. */
        icon: "size-6 rounded-badge",
      },
    },
    defaultVariants: {
      size: "chip",
    },
  }
)

function Toggle({
  className,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ size }), className)}
      {...props}
    />
  )
}

export { Toggle }
