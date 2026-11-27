import type React from 'react';
import { cn } from '@/lib/cn';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const TONES = {
    neutral: 'bg-fill text-muted-foreground',
    positive: 'bg-selected text-tint-mint',
    error: 'bg-tint-red/16 text-destructive',
} as const;

const SIZES = {
    default: { root: 'py-12', header: '', tile: '', title: 'type-headsign text-foreground/90', description: 'max-w-64 type-meta' },
    /** The full-screen board, scaling with the screen. */
    board: {
        root: 'flex-1',
        header: 'max-w-[min(90vw,48rem)] gap-[0.5em]',
        tile: 'size-board-tile [&_svg:not([class*=size-])]:size-[55%]',
        title: 'text-board-empty font-bold leading-tight text-foreground',
        description: 'text-board-headsign',
    },
} as const;

interface EmptyStateProps {
    icon: React.ElementType;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** The tile's colour: nothing to show, all is well (no alerts, no favourites yet) or something failed. */
    tone?: keyof typeof TONES;
    size?: keyof typeof SIZES;
    className?: string;
    /** Actions under the text, such as a retry button. */
    children?: React.ReactNode;
}

/** The app's one empty, error or nothing-found state: an icon tile, a title and a short explanation. */
export const EmptyState = ({ icon: Icon, title, description, tone = 'neutral', size = 'default', className, children }: EmptyStateProps) => (
    <Empty className={cn("animate-in fade-in duration-300", SIZES[size].root, className)}>
        <EmptyHeader className={SIZES[size].header}>
            <EmptyMedia variant="tile" className={cn(TONES[tone], SIZES[size].tile)}>
                <Icon strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle className={SIZES[size].title}>{title}</EmptyTitle>
            {description && <EmptyDescription className={cn("text-balance", SIZES[size].description)}>{description}</EmptyDescription>}
        </EmptyHeader>
        {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
);
