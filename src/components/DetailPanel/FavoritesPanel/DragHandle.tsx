import type React from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonTooltip } from '@/components/ButtonTooltip';

/** The drag handle's actions: a pointer drag, or one place up or down from the arrow keys. */
export interface FavoriteDragHandle {
    start: (e: React.PointerEvent) => void;
    move: (delta: number) => void;
}

/** Reorders a favourite: dragged by pointer, or moved one place with the arrow keys while keeping focus. */
export const DragHandleButton = ({ handle }: { handle: FavoriteDragHandle }) => {
    const { t } = useTranslation();

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (delta === 0) return;
        e.preventDefault();
        const button = e.currentTarget;
        handle.move(delta);
        requestAnimationFrame(() => button.focus());
    };

    return (
        <ButtonTooltip label={t('favorites.reorder')}>
        <Button
            variant="ghost"
            size="icon-xs"
            onPointerDown={handle.start}
            onKeyDown={onKeyDown}
            aria-keyshortcuts="ArrowUp ArrowDown"
            data-base-ui-swipe-ignore
            aria-label={t('favorites.reorder')}
            data-testid="favorite-drag-handle"
            className="touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/50"
        >
            <GripVertical size={16} strokeWidth={1.5} />
        </Button>
        </ButtonTooltip>
    );
};
