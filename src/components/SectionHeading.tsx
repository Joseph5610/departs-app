import type React from 'react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';

/** The app's one small caps heading: above a group of cards, a list section or a block of a screen. */
export const SectionHeading = ({ lead, count, className, children, ...props }: React.ComponentProps<'h3'> & { lead?: React.ReactNode; count?: number }) => (
    <h3 className={cn("flex items-center gap-2 px-0.5 type-label text-muted-foreground", className)} {...props}>
        {lead}
        <span className="min-w-0 truncate">{children}</span>
        {count !== undefined && <Badge variant="count">{count}</Badge>}
    </h3>
);
