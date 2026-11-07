import type React from 'react';
import { cn } from '@/lib/cn';

/** The lighter lower section of a hero card (vehicle, point of sale), under a full-width divider. */
export const HeroFooter = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cn("relative z-10 border-t border-foreground/6 bg-foreground/3 px-3.5 py-3", className)}>{children}</div>
);
