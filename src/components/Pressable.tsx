import type React from 'react';
import { cn } from '@/lib/cn';

/** The app's one press feedback for something tapped that has no look of its own: it dims while held. */
export const PRESS_FEEDBACK = 'cursor-pointer outline-none transition-opacity active:opacity-60 focus-visible:ring-2 focus-visible:ring-ring/50';

/** A tap target with no look of its own: what it wraps (a badge, a row, a card) is the control. A styled control is a `Button`. */
export const Pressable = ({ className, type = 'button', ...props }: React.ComponentProps<'button'>) => (
    <button
        type={type}
        className={cn(PRESS_FEEDBACK, className)}
        {...props}
    />
);
