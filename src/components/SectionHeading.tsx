import React from 'react';

/** The small uppercase label above a group of cards, as in settings and the point-of-sale panel. */
export const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-muted-foreground micro-label-widest px-1">
        {children}
    </h3>
);
