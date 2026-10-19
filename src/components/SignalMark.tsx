import { cn } from '@/lib/cn';

/** The "broadcast" mark (a dot with two arcs) the app uses for live data, in the current text colour. */
export const SignalMark = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-3 shrink-0', className)}>
        <circle cx="3.5" cy="12.5" r="2" fill="currentColor" />
        <path d="M2 7.5a6.5 6.5 0 0 1 6.5 6.5M2 2.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
);
