import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ButtonTooltip } from '@/components/ButtonTooltip';

interface IconTooltipProps {
    label: string;
    children: ReactNode;
    className?: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
}

/** Labels a non-interactive icon or badge; a `span` trigger, so it can sit inside buttons and clickable rows. */
export const IconTooltip = ({ label, children, className, side }: IconTooltipProps) => (
    <ButtonTooltip label={label} side={side}>
        <span aria-label={label} className={cn("inline-flex shrink-0 cursor-default items-center", className)}>{children}</span>
    </ButtonTooltip>
);
