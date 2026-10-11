import type React from 'react';
import { RowSeparator } from '@/components/DetailPanel/DepartureBoard/RowSeparator';
import { DragHandleButton, type FavoriteDragHandle } from './DragHandle';

interface FavoriteReorderRowProps {
    /** The line badge or platform circle that leads the row. */
    lead: React.ReactNode;
    title: string;
    subtitle?: string;
    isFirst: boolean;
    dragHandle?: FavoriteDragHandle;
}

/** A favourite in reorder mode: what it is, and its drag handle on the right, as in an iOS list being edited. */
export const FavoriteReorderRow = ({ lead, title, subtitle, isFirst, dragHandle }: FavoriteReorderRowProps) => (
    <>
    {!isFirst && <RowSeparator />}
    <div className="flex items-center gap-2.5 py-3 pl-1.5 pr-1">
        <span className="flex w-(--badge-col) shrink-0 justify-center">{lead}</span>
        <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-title font-semibold leading-tight text-foreground" data-testid="favorite-reorder-title">{title}</span>
            {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        {dragHandle && <DragHandleButton handle={dragHandle} />}
    </div>
    </>
);
