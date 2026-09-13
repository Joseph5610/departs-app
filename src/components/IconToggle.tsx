import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

export interface IconToggleProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
    testId?: string;
    className?: string;
    labelClassName?: string;
}

/** Outlined tile with an icon over a label, used for filter and category pickers. */
export const IconToggle: React.FC<IconToggleProps> = ({ icon: Icon, label, isActive, onClick, testId, className, labelClassName }) => (
    <Toggle
        pressed={isActive}
        onPressedChange={onClick}
        variant="outline"
        data-testid={testId}
        className={cn(
            "h-auto flex flex-col items-center justify-center gap-1.5 px-3 transition-[transform,colors] font-semibold active:scale-95 group",
            "border-border/80 hover:bg-foreground/10 hover:text-foreground",
            // `!` overrides the Toggle's own pressed background.
            "aria-pressed:bg-primary/20! aria-pressed:text-primary! aria-pressed:border-primary/50! aria-pressed:shadow-[0_0_12px_rgba(var(--color-primary),0.15)]",
            "aria-[pressed=false]:bg-transparent aria-[pressed=false]:text-foreground/70",
            className
        )}
    >
        <Icon size={18} className={cn("transition-transform duration-300", isActive ? 'scale-110 opacity-100' : 'group-hover:scale-110 opacity-70')} />
        <span className={labelClassName}>{label}</span>
    </Toggle>
);
