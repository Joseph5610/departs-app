import type React from 'react';
import { cn } from '@/lib/cn';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const TONES = {
    neutral: 'bg-fill text-muted-foreground',
    positive: 'bg-selected text-tint-mint',
    error: 'bg-tint-red/16 text-destructive',
} as const;

interface EmptyStateProps {
    icon: React.ElementType;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** The tile's colour: nothing to show, all is well (no alerts, no favourites yet) or something failed. */
    tone?: keyof typeof TONES;
    className?: string;
    /** Actions under the text, such as a retry button. */
    children?: React.ReactNode;
}

/** The app's one empty, error or nothing-found state: an icon tile, a title and a short explanation. */
export const EmptyState = ({ icon: Icon, title, description, tone = 'neutral', className, children }: EmptyStateProps) => (
    <Empty className={cn("py-12 animate-in fade-in duration-300", className)}>
        <EmptyHeader>
            <EmptyMedia variant="tile" className={TONES[tone]}>
                <Icon strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle className="type-headsign text-foreground/90">{title}</EmptyTitle>
            {description && <EmptyDescription className="max-w-64 type-meta text-balance">{description}</EmptyDescription>}
        </EmptyHeader>
        {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
);
