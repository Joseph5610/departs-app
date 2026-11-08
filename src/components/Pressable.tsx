import type React from 'react';
import { cn } from '@/lib/cn';

/** A tap target with no look of its own: what it wraps (a badge, a row, a card) is the control. A styled control is a `Button`. */
export const Pressable = ({ className, type = 'button', ...props }: React.ComponentProps<'button'>) => (
    <button
        type={type}
        className={cn('cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
        {...props}
    />
);
