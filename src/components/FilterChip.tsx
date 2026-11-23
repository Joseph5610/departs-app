import type React from 'react';
import { cn } from '@/lib/cn';

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

/** A filter that is on or off; while on it is solid mint. */
export const FilterChip = ({ label, count, isActive, onClick, icon: Icon, dotColor, isDisabled = false, testId }: FilterChipProps) => (
    <button
        type="button"
        aria-pressed={isActive}
        disabled={isDisabled}
        onClick={onClick}
        data-testid={testId}
        className={cn(
            "hit-target inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-2.75 pl-2.25 type-control tabular-nums outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring/50",
            isActive ? "bg-primary text-primary-foreground" : "bg-field text-muted-foreground",
            isDisabled && "cursor-default opacity-50"
        )}
    >
        {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
        {dotColor && <i className="size-2 rounded-full ring-1 ring-background/40" style={{ backgroundColor: dotColor }} aria-hidden="true" />}
        {label}
        {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
    </button>
);
