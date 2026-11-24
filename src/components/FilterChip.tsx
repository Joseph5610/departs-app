import type React from 'react';
import { Toggle } from '@/components/ui/toggle';

interface FilterChipProps {
    label: string;
    count?: number;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ElementType;
    /** A coloured dot in place of an icon, such as a delay tier's map colour. */
    dotColor?: string;
    isDisabled?: boolean;
    testId?: string;
}

/** A filter that is on or off, as a labelled `Toggle` chip. */
export const FilterChip = ({ label, count, isActive, onClick, icon: Icon, dotColor, isDisabled = false, testId }: FilterChipProps) => (
    <Toggle pressed={isActive} onPressedChange={onClick} disabled={isDisabled} data-testid={testId}>
        {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
        {dotColor && <i className="size-2 rounded-full ring-1 ring-background/40" style={{ backgroundColor: dotColor }} aria-hidden="true" />}
        {label}
        {count !== undefined && <span className="opacity-60">{count}</span>}
    </Toggle>
);
