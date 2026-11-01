import { cn } from '@/lib/cn';
import { getContrastColor, safeHexColor } from '@/lib/color';
import { FALLBACK_ROUTE_COLOR } from '@/config/constants';
import { LINE_BADGE_SIZES, lineBadgeWidth, type LineBadgeSize } from '@/lib/lineBadge';

interface LineBadgeProps {
    name: string;
    routeColor: string;
    size?: LineBadgeSize;
    className?: string;
}

/**
 * LineBadge
 *
 * Coloured pill showing a transit line name (Metro, Tram, Bus, etc).
 */
export const LineBadge = ({ name, routeColor: rawColor, size = 'row', className }: LineBadgeProps) => {
    const routeColor = safeHexColor(rawColor) ?? FALLBACK_ROUTE_COLOR;
    const config = LINE_BADGE_SIZES[size];
    const calculatedMinWidth = lineBadgeWidth(name, size);

    const textColor = getContrastColor(routeColor);

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center shrink-0 whitespace-nowrap',
                config.classes,
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
