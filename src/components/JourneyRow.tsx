import { LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Item } from '@/components/ui/item';
import { RowChevron, ExpandChevron } from '@/components/Chevron';

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
            <Item
                render={<button type="button" onClick={onClick} aria-expanded={kind === 'toggle' ? isOpen : undefined} />}
                className={cn("min-w-0 flex-1", !isCompact && "min-h-14")}
            >
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-tint-mint" />
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate type-row")}>{title}</span>
                    <span className={cn("truncate type-note text-muted-foreground")}>{summary}</span>
                </span>
                {kind === 'toggle' ? (
                    <ExpandChevron isOpen={isOpen} className="text-label-3" />
                ) : (
                    <RowChevron />
                )}
            </Item>
        </div>
    );
};
