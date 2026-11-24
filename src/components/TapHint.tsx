import type React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pressable } from '@/components/Pressable';
import { cn } from '@/lib/cn';

interface TapHintProps {
    /** What is tapped: a badge, an icon or a chart segment. */
    children: React.ReactNode;
    /** The short explanation it opens. */
    hint: React.ReactNode;
    side?: 'top' | 'bottom';
    className?: string;
    style?: React.CSSProperties;
}

/** Something that explains itself when tapped, in a small popover; a tooltip would never show on touch. */
export const TapHint = ({ children, hint, side = 'top', className, style }: TapHintProps) => (
    <Popover>
        <PopoverTrigger render={<Pressable className={cn("inline-flex shrink-0 items-center", className)} style={style} />}>
            {children}
        </PopoverTrigger>
        <PopoverContent side={side} className="w-auto max-w-62.5 px-3 py-1.5 text-center type-meta text-foreground">
            {hint}
        </PopoverContent>
    </Popover>
);
