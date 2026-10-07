import { cn } from 'cn';
import { formatDelay } from '@/domain/delay';

interface DelayTextProps {
    delay: number | null | undefined;
    className?: string;
}

/** A departure's delay (`+2:30`, `-45s`) in red when late and blue when early; nothing when unknown or on time. */
export const DelayText = ({ delay, className }: DelayTextProps) => {
    if (typeof delay !== 'number' || delay === 0) return null;
    return <span className={cn('font-bold tabular-nums', delay > 0 ? 'text-destructive' : 'text-sky-500', className)}>{formatDelay(delay)}</span>;
};
