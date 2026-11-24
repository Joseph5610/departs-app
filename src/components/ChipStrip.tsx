import type React from 'react';
import { cn } from '@/lib/cn';

/** A row of chips scrolling sideways, fading out at its right edge; `bleed` runs it to the panel's edges past the gutter. */
export const ChipStrip = ({ bleed = false, children }: { bleed?: boolean; children: React.ReactNode }) => (
    <div className={cn("-my-2 overflow-x-auto py-2.5 no-scrollbar fade-end", bleed && "-mx-(--panel-gutter) px-(--panel-gutter)")}>
        <div className="flex w-max items-center gap-1.5">
            {children}
            <div className="h-1 w-6 shrink-0" aria-hidden="true" />
        </div>
    </div>
);
