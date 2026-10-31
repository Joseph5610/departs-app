import type React from 'react';
import { ChevronRight } from 'lucide-react';

interface HomeSectionProps {
    title: string;
    /** Makes the title a link, marked by a chevron next to it. */
    onOpen?: () => void;
    children: React.ReactNode;
}

/** A titled group on the mobile home sheet. */
export const HomeSection = ({ title, onOpen, children }: HomeSectionProps) => (
    <section className="flex flex-col gap-2">
        <h2 className="text-lg leading-6 font-semibold tracking-[-0.02em] text-foreground">
            {onOpen ? (
                <button
                    type="button"
                    onClick={onOpen}
                    className="relative flex items-center gap-1 outline-none before:absolute before:top-1/2 before:left-0 before:h-11 before:w-full before:-translate-y-1/2 focus-visible:underline"
                >
                    {title}
                    <ChevronRight size={17} strokeWidth={2.5} className="text-label-3" aria-hidden="true" />
                </button>
            ) : title}
        </h2>
        {children}
    </section>
);
