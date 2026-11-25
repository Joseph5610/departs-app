import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

/** The size of one control in a pill: in the desktop corner (the `icon` button size), and above the phone's sheet. */
const MAP_CONTROL_SIZE = { corner: 'h-11 w-11', sheet: 'size-12' } as const;

export interface MapControlButtonProps {
    /** Sized for the phone, riding above the sheet. */
    inSheet?: boolean;
    children: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    testId?: string;
    disabled?: boolean;
}

/** One button of a map control pill, with its tooltip. */
export const MapControlButton = ({ children, onClick, title, testId, inSheet = false, disabled = false }: MapControlButtonProps) => (
    <Tooltip>
        <TooltipTrigger render={
            <Button
                variant="ghost"
                size="icon"
                onClick={onClick}
                disabled={disabled}
                aria-label={title}
                className={cn("relative shrink-0 rounded-none", inSheet && cn(MAP_CONTROL_SIZE.sheet, "text-foreground [&>svg]:size-5.25 [&>svg]:stroke-[1.75]"))}
                data-testid={testId}
            >
                {children}
            </Button>
        } />
        <TooltipContent side="left" sideOffset={8}>
            <p className="type-note">{title}</p>
        </TooltipContent>
    </Tooltip>
);

interface MapControlValueProps {
    inSheet?: boolean;
    children: React.ReactNode;
    testId?: string;
}

/** A value shown between the buttons of a control pill (the floor), sized like them; announced when it changes. */
export const MapControlValue = ({ inSheet = false, children, testId }: MapControlValueProps) => (
    <span
        aria-live="polite"
        data-testid={testId}
        className={cn('grid place-items-center type-control tabular-nums text-foreground', inSheet ? MAP_CONTROL_SIZE.sheet : MAP_CONTROL_SIZE.corner)}
    >
        {children}
    </span>
);
