import type React from 'react';

interface SheetSectionProps {
    title: string;
    /** Shown right of the title, such as a "Clear" link. */
    action?: React.ReactNode;
    children: React.ReactNode;
}

/** A titled group in the mobile search. */
export const SheetSection = ({ title, action, children }: SheetSectionProps) => (
    <section className="flex flex-col gap-2">
        <div className="flex min-h-7 items-center justify-between px-1">
            <h2 className="text-heading font-semibold tracking-tight text-foreground">{title}</h2>
            {action}
        </div>
        {children}
    </section>
);
