import { SectionHeading } from '@/components/SectionHeading';
import type React from 'react';

interface SheetSectionProps {
    title: string;
    /** How many items the section holds, as on the desktop dropdown. */
    count?: number;
    /** Shown right of the title, such as a "Clear" button. */
    action?: React.ReactNode;
    children: React.ReactNode;
}

/** A titled group in the mobile search. */
export const SheetSection = ({ title, count, action, children }: SheetSectionProps) => (
    <section className="flex flex-col gap-2">
        <div className="flex min-h-7 items-center justify-between gap-2">
            <SectionHeading count={count} className="min-w-0">{title}</SectionHeading>
            {action}
        </div>
        {children}
    </section>
);
