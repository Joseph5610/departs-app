import type React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionTitleProps {
    /** A badge, platform circle or icon before the title. */
    lead?: React.ReactNode;
    /** Makes the title a link, marked by a chevron next to it. */
    onOpen?: () => void;
    children: React.ReactNode;
}

/** The app's one section title, on the home sheet, a board and favourites. */
export const SectionTitle = ({ lead, onOpen, children }: SectionTitleProps) => {
    const title = <>{lead}<span className="min-w-0 truncate">{children}</span></>;
    return (
        <h2 className="type-section min-w-0 text-foreground">
            {onOpen ? (
                <button type="button" onClick={onOpen} className="hit-target flex max-w-full cursor-pointer items-center gap-2 text-left outline-none focus-visible:underline">
                    {title}
                    <ChevronRight size={17} strokeWidth={2.5} className="-ml-1 shrink-0 text-label-3" aria-hidden="true" />
                </button>
            ) : <span className="flex min-w-0 items-center gap-2">{title}</span>}
        </h2>
    );
};
