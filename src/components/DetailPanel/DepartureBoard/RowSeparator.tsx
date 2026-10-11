import { cn } from '@/lib/cn';
import { Separator } from '@/components/ui/separator';

/** The hairline between rows of a board list; inset ones start at the text column, as in an iOS list. */
export const RowSeparator = ({ inset = true, className }: { inset?: boolean; className?: string }) => (
    <Separator className={cn("bg-foreground/8 data-horizontal:w-auto", inset ? "ml-[calc(var(--badge-col)+1rem)] mr-2" : "mx-2", className)} />
);
