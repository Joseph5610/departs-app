import { ChevronRight, type LucideIcon } from 'lucide-react';

interface TripControlButtonProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    onClick: () => void;
}

/** An idle trip control above the timeline (ride alert, departure reminder): icon, title and what it does. */
export const TripControlButton = ({ icon: Icon, title, subtitle, onClick }: TripControlButtonProps) => (
    <button
        type="button"
        onClick={onClick}
        className="group w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2.5 text-left cursor-pointer transition-colors hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
        <span className="grid place-items-center size-9 shrink-0 rounded-full bg-primary/10 text-primary">
            <Icon size={18} strokeWidth={1.75} />
        </span>
        <span className="flex flex-col flex-1 min-w-0 leading-snug">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
);
