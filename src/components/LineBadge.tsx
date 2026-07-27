import { cn, getContrastColor } from '@/lib/utils';

interface LineBadgeProps {
    name: string;
    routeColor: string;
    /** Size variant — defaults to 'md' */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const SIZE_CONFIGS = {
    sm: { baseWidth: 16, charWidth: 5, classes: 'h-3.5 rounded-sm px-1 text-[9px] font-bold' },
    md: { baseWidth: 20, charWidth: 6, classes: 'h-4.5 rounded-sm px-1.5 text-[10px] font-bold' },
    lg: { baseWidth: 26, charWidth: 7, classes: 'h-6 rounded-md px-2 text-[11px] font-bold' },
    xl: { baseWidth: 30, charWidth: 8, classes: 'h-7 rounded-lg px-2.5 text-[13px] font-extrabold' },
} as const;

/**
 * LineBadge
 *
 * Coloured pill showing a transit line name (Metro, Tram, Bus, etc).
 */
export const LineBadge = ({ name, routeColor, size = 'md', className }: LineBadgeProps) => {
    const len = name.length;
    const config = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
    const calculatedMinWidth = config.baseWidth + Math.max(0, len - 1) * config.charWidth;

    const textColor = getContrastColor(routeColor);
    const isLightBg = textColor === '#000000';

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center shrink-0 border',
                isLightBg ? 'border-black/15 dark:border-black/40' : 'border-transparent',
                config.classes,
                size === 'sm' && len > 1 && 'text-[8px]',
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
