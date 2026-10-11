import type React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ButtonTooltipProps {
    label: string;
    /** The button (or trigger element) the tooltip labels; it keeps its own props and behaviour. */
    children: React.ReactElement;
    side?: 'top' | 'bottom' | 'left' | 'right';
}

/** The app's tooltip for an icon button or chip, shown on hover and focus; IconTooltip labels non-interactive icons. */
export const ButtonTooltip = ({ label, children, side = 'top' }: ButtonTooltipProps) => (
    <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent side={side}>
            <span className="font-medium">{label}</span>
        </TooltipContent>
    </Tooltip>
);
