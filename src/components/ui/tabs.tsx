import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/cn"

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return <TabsPrimitive.Root data-slot="tabs" className={className} {...props} />
}

const tabsListVariants = cva(
  "relative grid auto-cols-fr grid-flow-col rounded-full bg-fill-2 p-0.5",
  {
    variants: {
      size: {
        sm: "h-control-sm shrink-0 [&>[data-slot=tabs-trigger]]:px-2.5",
        md: "h-control-lg [&>[data-slot=tabs-trigger]]:px-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

/** The segmented track: the selected tab's mint thumb slides under the labels. */
function TabsList({
  className,
  size,
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List data-slot="tabs-list" className={cn(tabsListVariants({ size }), className)} {...props}>
      <TabsPrimitive.Indicator className="absolute top-0.5 bottom-0.5 left-(--active-tab-left) w-(--active-tab-width) rounded-full bg-segment-selected motion-safe:transition-[left,width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]" />
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-full whitespace-nowrap type-group tabular-nums text-muted-foreground outline-none transition-colors duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-active:text-on-segment-selected [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
