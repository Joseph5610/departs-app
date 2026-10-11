import { cn } from '@/lib/cn';
import { getContrastColor, safeHexColor } from '@/lib/color';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { LINE_BADGE_SIZES, lineBadgeWidth, type LineBadgeSize } from '@/lib/lineBadge';

interface LineBadgeProps {
    name: string;
    routeColor: string;
    /** Size variant — defaults to 'md' */
    size?: LineBadgeSize;
    className?: string;
}

/**
 * LineBadge
 *
 * Coloured pill showing a transit line name (Metro, Tram, Bus, etc).
 */
export const LineBadge = ({ name, routeColor: rawColor, size = 'md', className }: LineBadgeProps) => {
    const routeColor = safeHexColor(rawColor) ?? FALLBACK_ROUTE_COLOR;
    const len = name.length;
    const config = LINE_BADGE_SIZES[size] || LINE_BADGE_SIZES.md;
    const calculatedMinWidth = lineBadgeWidth(name, size in LINE_BADGE_SIZES ? size : 'md');

    const textColor = getContrastColor(routeColor);
    const isLightBg = textColor === '#000000';

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center shrink-0 border',
                isLightBg ? 'border-black/15 dark:border-black/40' : 'border-transparent',
                config.classes,
                size === 'sm' && len > 1 && 'text-nano',
                className
            )}
            style={{ 
                backgroundColor: routeColor,
                color: textColor,
                minWidth: `${calculatedMinWidth}px`
            }}
        >
            {name}
        </span>
    );
};
