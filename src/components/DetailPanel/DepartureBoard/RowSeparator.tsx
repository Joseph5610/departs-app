import { cn } from '@/lib/cn';
import { Separator } from '@/components/ui/separator';

/** The hairline between rows of a board list; inset ones start at the text column, as in an iOS list. */
export const RowSeparator = ({ inset = true, className }: { inset?: boolean; className?: string }) => (
    <Separator className={cn("bg-sep data-horizontal:h-[0.5px] data-horizontal:w-auto", inset && "ml-[calc(var(--badge-col)+0.75rem)]", className)} />
);
