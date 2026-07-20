import { cn, getContrastColor } from '@/lib/utils';

interface LineBadgeProps {
    name: string;
    routeColor: string;
    /** Size variant — defaults to 'md' */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

/**
 * LineBadge
 *
 * Coloured pill showing a transit line name (Metro, Tram, Bus, etc).
 */
export const LineBadge = ({ name, routeColor, size = 'md', className }: LineBadgeProps) => {
    const len = name.length;
    const isLong = len > 1;

    // We calculate a deterministic min-width based on character count.
    // This ensures that "911" and "136" are exactly the same width in pixels,
    // bypassing proportional font metric issues where "1" is narrower.
    let baseWidth = 18;
    let charWidth = 6;
    let sizeClass = `h-[18px] rounded-[3px] px-1 text-[10px] font-bold`;

    if (size === 'sm') {
        baseWidth = 14;
        charWidth = 5;
        sizeClass = `h-[14px] rounded-[2px] px-0.5 ${isLong ? 'text-[8px]' : 'text-[9px]'} font-bold`;
    } else if (size === 'lg') {
        baseWidth = 24;
        charWidth = 8;
        sizeClass = `h-[24px] rounded-[4px] px-1 text-[11px] font-bold`;
    } else if (size === 'xl') {
        baseWidth = 28;
        charWidth = 9;
        sizeClass = `h-[28px] rounded-[5px] px-1.5 text-[13px] font-extrabold`;
    }

    const calculatedMinWidth = baseWidth + (Math.max(0, len - 1) * charWidth);

    return (
        <span
            className={cn(`inline-flex items-center justify-center shrink-0 border border-border/50 ${sizeClass}`, className)}
            style={{ 
                backgroundColor: routeColor,
                color: getContrastColor(routeColor),
                minWidth: `${calculatedMinWidth}px`
            }}
        >
            {name}
        </span>
    );
};
