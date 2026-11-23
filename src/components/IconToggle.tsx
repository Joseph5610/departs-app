import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/cn';

export interface IconToggleProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
    testId?: string;
    className?: string;
    labelClassName?: string;
}

/** A tile with an icon over a label, used for filter and category pickers. */
export const IconToggle = ({ icon: Icon, label, isActive, onClick, testId, className, labelClassName }: IconToggleProps) => (
    <Toggle
        pressed={isActive}
        onPressedChange={onClick}
        variant="outline"
        data-testid={testId}
        className={cn(
            "h-auto flex flex-col items-center justify-center gap-1.5 px-3 transition-colors font-semibold",
            // `!` overrides the Toggle's own pressed background.
            "aria-pressed:bg-selected! aria-pressed:text-foreground!",
            className
        )}
    >
        <Icon size={18} className={cn(!isActive && "opacity-70")} />
        <span className={labelClassName}>{label}</span>
    </Toggle>
);
