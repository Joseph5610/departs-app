import type React from 'react';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface FavoriteCardProps {
    onOpen: () => void;
    onUnpin: () => void;
    unpinLabel: string;
    /** The header's content left of the unpin star. */
    header: React.ReactNode;
    children: React.ReactNode;
}

/** A pinned stop or line in the favourites panel: a tappable card whose header carries the unpin star. */
export const FavoriteCard = ({ onOpen, onUnpin, unpinLabel, header, children }: FavoriteCardProps) => (
    <Card
        onClick={onOpen}
        variant="panel"
        size="none"
        className="w-full cursor-pointer overflow-hidden transition-colors relative hover:border-border dark:hover:border-white/20 focus-visible:outline-none"
    >
        <div className="flex items-center gap-2 border-b border-border/50 dark:border-white/10 bg-muted/40 dark:bg-white/[0.04] py-1.5 pl-4 pr-2">
            {header}
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => { e.stopPropagation(); onUnpin(); }}
                title={unpinLabel}
                aria-label={unpinLabel}
                className="shrink-0 text-favorite hover:text-favorite-hover"
            >
                <Star size={16} fill="currentColor" strokeWidth={1.5} />
            </Button>
        </div>
        <CardContent className="p-0">{children}</CardContent>
    </Card>
);
