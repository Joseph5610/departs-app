import { ChevronDown, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Which alert of a journey a row is about: boarding (before the trip leaves the user's stop) or exit. */
export type JourneyLeg = 'board' | 'exit';

const LEG_ICONS = { board: LogIn, exit: LogOut } as const;

interface JourneyRowProps {
    leg: JourneyLeg;
    title: string;
    /** What is set, or what to do. */
    summary: string;
    onClick: () => void;
    /** `toggle`: the row opens content under it (`isOpen`); `open`: it leads elsewhere. */
    kind: 'toggle' | 'open';
    isOpen?: boolean;
    /** `compact`: a small icon and tight lines, for the trip's summary card; the sheet's rows carry an icon badge. */
    density?: 'comfortable' | 'compact';
}

/** One alert of the user's journey, in the journey sheet and the trip's summary card. */
export const JourneyRow = ({ leg, title, summary, onClick, kind, isOpen = false, density = 'comfortable' }: JourneyRowProps) => {
    const Icon = LEG_ICONS[leg];
    const isCompact = density === 'compact';
    return (
        <div className="flex items-center">
            <button
                type="button"
                onClick={onClick}
                aria-expanded={kind === 'toggle' ? isOpen : undefined}
                className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center text-left outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5",
                    isCompact ? "min-h-11 gap-2.5 px-4 py-2" : "min-h-16 gap-3 px-4 py-3"
                )}
            >
                {isCompact ? (
                    <Icon size={16} strokeWidth={2} className="shrink-0 text-primary" />
                ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Icon size={16} strokeWidth={2} />
                    </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate text-sm font-semibold", isCompact ? "leading-tight" : "leading-snug")}>{title}</span>
                    <span className={cn("truncate text-muted-foreground", isCompact ? "text-caption leading-tight" : "text-xs leading-snug")}>{summary}</span>
                </span>
                {kind === 'toggle' ? (
                    <ChevronDown size={16} strokeWidth={2} className={cn("shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                ) : (
                    <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                )}
            </button>
        </div>
    );
};
