import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** The trailing chevron of a row that opens another screen. */
export const RowChevron = ({ className }: { className?: string }) => (
    <ChevronRight size={17} strokeWidth={1.75} className={cn("shrink-0 text-label-3", className)} aria-hidden="true" />
);

interface ExpandChevronProps {
    isOpen: boolean;
    /** Inside a text control such as "Show more", rather than at the end of a row. */
    inline?: boolean;
    className?: string;
}

/** The chevron of something that expands in place, turned up while open. */
export const ExpandChevron = ({ isOpen, inline = false, className }: ExpandChevronProps) => (
    <ChevronDown size={inline ? 14 : 17} strokeWidth={1.75} className={cn("shrink-0 transition-transform duration-200", isOpen && "rotate-180", className)} aria-hidden="true" />
);
