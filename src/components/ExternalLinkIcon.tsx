import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Marks a link that opens a new window: `row` at a row's end where a chevron would be, `inline` beside link text. */
export const ExternalLinkIcon = ({ variant = 'row', className }: { variant?: 'row' | 'inline'; className?: string }) => (
    <ArrowUpRight
        strokeWidth={variant === 'row' ? 1.75 : 2}
        className={cn('shrink-0', variant === 'row' ? 'size-4.25 text-label-3' : 'size-3.5', className)}
        aria-hidden="true"
    />
);
