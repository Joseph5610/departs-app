import { cn } from '@/lib/cn';

const SIZES = {
    sm: 'h-5 min-w-5 px-1 text-badge',
    md: 'size-6 text-label',
    lg: 'h-7 min-w-7 px-1.5 text-body-sm',
    /** Scales with the surrounding text, for the full-screen board. */
    fluid: 'h-[1.8em] min-w-[1.8em] px-[0.4em] text-[0.55em]',
} as const;

interface PlatformCircleProps {
    code: string;
    size?: keyof typeof SIZES;
    className?: string;
}

/** A platform or track code in the app's standard circle, widening into a pill for longer codes. */
export const PlatformCircle = ({ code, size = 'sm', className }: PlatformCircleProps) => (
    <span className={cn("inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-foreground font-bold tabular-nums text-background shadow-sm", SIZES[size], className)}>
        {code}
    </span>
);
