import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/cn"

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7.5 w-13.5 shrink-0 items-center rounded-full p-0.5 transition-colors outline-none after:absolute after:inset-x-0 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-fill-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6.5 rounded-full bg-thumb shadow-(--shadow-thumb) transition-transform data-checked:translate-x-6 data-unchecked:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
