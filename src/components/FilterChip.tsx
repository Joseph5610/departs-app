import type React from 'react';
import { cn } from '@/lib/cn';

interface FilterChipProps {
    label: string;
    count?: number;
    isActive: boolean;
    onClick: () => void;
    icon?: React.ElementType;
    /** A coloured dot instead of an icon; while active the whole chip takes this colour. */
    dotClassName?: string;
    /** Another filter of the group is on, so this one reads as off. */
    isDimmed?: boolean;
    isDisabled?: boolean;
    testId?: string;
}

/** A filter that is on or off; while on it is solid mint, or solid in the colour of its dot. */
export const FilterChip = ({ label, count, isActive, onClick, icon: Icon, dotClassName, isDimmed = false, isDisabled = false, testId }: FilterChipProps) => (
    <button
        type="button"
        aria-pressed={isActive}
        disabled={isDisabled}
        onClick={onClick}
        data-testid={testId}
        className={cn(
            "hit-target inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-2.75 pl-2.25 type-control tabular-nums outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring/50",
            !isActive && "bg-field text-muted-foreground",
            isDisabled && "cursor-default opacity-50",
            !isActive && dotClassName && !isDimmed && "text-foreground",
            isActive && (dotClassName ?? "bg-primary"),
            isActive && "text-primary-foreground"
        )}
    >
                {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden="true" />}
        {dotClassName && !isActive && <i className={cn("size-2 rounded-full", dotClassName, isDimmed && "opacity-40")} aria-hidden="true" />}
        {label}
        {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
    </button>
);
