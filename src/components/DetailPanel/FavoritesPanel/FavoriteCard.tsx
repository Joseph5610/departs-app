import type React from 'react';
import { GripVertical, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineGradient } from '@/components/LineGradient';
import { lineRuleColor } from '@/lib/color';
import { FAVORITE_CARD_HEADER } from './favoriteCardStyles';

/** The drag handle's actions: a pointer drag, or one place up or down from the arrow keys. */
export interface FavoriteDragHandle {
    start: (e: React.PointerEvent) => void;
    move: (delta: number) => void;
}

interface FavoriteCardProps {
    onOpen: () => void;
    onUnpin: () => void;
    unpinLabel: string;
    /** The header's content left of the unpin star. */
    header: React.ReactNode;
    /** Tints the header with a line's colour, like a departure board's line header; without one the header stays plain. */
    routeColor?: string | null;
    /** Without it the card has no drag handle. */
    dragHandle?: FavoriteDragHandle;
    children: React.ReactNode;
}

/** A pinned stop or line in the favourites panel: the header opens the stop's board, each departure row its own trip. */
export const FavoriteCard = ({ onOpen, onUnpin, unpinLabel, header, routeColor, dragHandle, children }: FavoriteCardProps) => {
    const { t } = useTranslation();
    const isLine = !!routeColor;

    const onHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (!dragHandle || delta === 0) return;
        e.preventDefault();
        const button = e.currentTarget;
        dragHandle.move(delta);
        requestAnimationFrame(() => button.focus());
    };

    return (
        <Card
            variant="panel"
            size="none"
            className="w-full overflow-hidden relative"
        >
            <div
                className={cn(FAVORITE_CARD_HEADER.frame, isLine ? "border-b-2" : FAVORITE_CARD_HEADER.plainBorder)}
                style={isLine ? { borderBottomColor: lineRuleColor(routeColor) } : undefined}
            >
                {isLine && <LineGradient routeColor={routeColor} />}
                <Button
                    variant="ghost"
                    onClick={onOpen}
                    className={cn(
                        "relative w-full h-auto justify-start gap-2 py-1.5 pl-4 rounded-none font-normal text-left text-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                        dragHandle ? "pr-22" : "pr-13",
                        isLine
                            ? "hover:bg-foreground/5 active:bg-foreground/5"
                            : cn(FAVORITE_CARD_HEADER.plainFill, "hover:bg-muted active:bg-muted dark:hover:bg-white/8 dark:active:bg-white/8")
                    )}
                >
                    {header}
                </Button>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                    {dragHandle && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onPointerDown={dragHandle.start}
                            onKeyDown={onHandleKeyDown}
                            aria-keyshortcuts="ArrowUp ArrowDown"
                            data-base-ui-swipe-ignore
                            title={t('favorites.reorder')}
                            aria-label={t('favorites.reorder')}
                            data-testid="favorite-drag-handle"
                            className="touch-none cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                            <GripVertical size={16} strokeWidth={1.5} />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onUnpin}
                        title={unpinLabel}
                        aria-label={unpinLabel}
                        className="text-favorite hover:text-favorite-hover focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                        <Star size={16} fill="currentColor" strokeWidth={1.5} />
                    </Button>
                </div>
            </div>
            <CardContent className="p-0">{children}</CardContent>
        </Card>
    );
};
