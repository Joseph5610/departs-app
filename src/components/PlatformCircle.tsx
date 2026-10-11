import { cn } from '@/lib/cn';
import { IconTooltip } from '@/components/IconTooltip';

interface PlatformCircleProps {
    code: string;
    /** What the code is, e.g. "Track 1"; shown as the app's tooltip. */
    label?: string;
    className?: string;
}

const CIRCLE = "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-badge font-bold tabular-nums text-background shadow-sm";

/** A platform or track code in the app's standard circle. */
export const PlatformCircle = ({ code, label, className }: PlatformCircleProps) => label ? (
    <IconTooltip label={label} className={cn(CIRCLE, className)}>{code}</IconTooltip>
) : (
    <span className={cn(CIRCLE, className)}>{code}</span>
);
