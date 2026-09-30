import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from 'cn';

interface IconTooltipProps {
    label: string;
    children: ReactNode;
    className?: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * IconTooltip
 *
 * Labels a non-interactive icon or badge; renders a `span` trigger so it can sit inside buttons and clickable rows.
 */
export const IconTooltip = ({ label, children, className, side = 'top' }: IconTooltipProps) => (
    <Tooltip>
        <TooltipTrigger
            render={<span aria-label={label} className={cn("inline-flex items-center shrink-0 cursor-default", className)} />}
        >
            {children}
        </TooltipTrigger>
        <TooltipContent side={side}>
            <span className="font-medium">{label}</span>
        </TooltipContent>
    </Tooltip>
);
