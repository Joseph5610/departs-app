import type React from 'react';

/** Line badge sizes: height and type classes, and the minimum width from which badges grow per character. */
export const LINE_BADGE_SIZES = {
    sm: { baseWidth: 16, charWidth: 5, classes: 'h-3.5 rounded-sm px-1 text-micro font-bold' },
    md: { baseWidth: 20, charWidth: 6, classes: 'h-4.5 rounded-sm px-1.5 text-label font-bold' },
    lg: { baseWidth: 26, charWidth: 7, classes: 'h-6 rounded-md px-2 text-caption font-bold' },
    xl: { baseWidth: 30, charWidth: 8, classes: 'h-7 rounded-lg px-2.5 text-body-sm font-extrabold' },
} as const;

export type LineBadgeSize = keyof typeof LINE_BADGE_SIZES;

/** The minimum width in px of a badge for `name`, so columns of badges can be sized to their widest. */
export const lineBadgeWidth = (name: string, size: LineBadgeSize): number => {
    const config = LINE_BADGE_SIZES[size];
    return config.baseWidth + Math.max(0, name.length - 1) * config.charWidth;
};

/** A `--badge-col` style as wide as the widest of `lines`' badges, so rows sharing it align; a single badge's width at least. */
export const badgeColumnStyle = (lines: readonly string[], size: LineBadgeSize = 'lg'): React.CSSProperties => ({
    '--badge-col': `${lines.reduce((max, line) => Math.max(max, lineBadgeWidth(line, size)), lineBadgeWidth('', size))}px`,
}) as React.CSSProperties;
