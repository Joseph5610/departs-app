import type React from 'react';

/** Line badge sizes: height and type classes, the minimum width from which badges grow past two characters, and the narrowest column of them. */
export const LINE_BADGE_SIZES = {
    /** Next to a text line: in lists, cards and section titles. */
    row: { baseWidth: 22, columnWidth: 22, charWidth: 6, classes: 'h-4.5 rounded-badge px-1.5 text-label font-bold' },
    /** Leading a row, and the filters above it. */
    lg: { baseWidth: 32, columnWidth: 36, charWidth: 7, classes: 'h-6 rounded-badge px-2 text-caption font-bold' },
    /** The full-screen board. */
    xl: { baseWidth: 30, columnWidth: 30, charWidth: 8, classes: 'h-7 rounded-badge px-2.5 text-body-sm font-extrabold' },
} as const;

export type LineBadgeSize = keyof typeof LINE_BADGE_SIZES;

/** The minimum width in px of a badge for `name`, so columns of badges can be sized to their widest. */
export const lineBadgeWidth = (name: string, size: LineBadgeSize): number => {
    const config = LINE_BADGE_SIZES[size];
    return config.baseWidth + Math.max(0, name.length - 2) * config.charWidth;
};

/** A `--badge-col` style as wide as the widest of `lines`' badges, so rows sharing it align; a single badge's width at least. */
export const badgeColumnStyle = (lines: readonly string[], size: LineBadgeSize = 'lg'): React.CSSProperties => ({
    '--badge-col': `${lines.reduce<number>((max, line) => Math.max(max, lineBadgeWidth(line, size)), LINE_BADGE_SIZES[size].columnWidth)}px`,
}) as React.CSSProperties;
