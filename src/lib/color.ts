const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The colour if it is a hex colour, otherwise null. Feed colours are interpolated into CSS strings
 * (gradients, color-mix), where any other value could inject CSS such as a url() request.
 */
export const safeHexColor = (value: string | null | undefined): string | null =>
    value && HEX_COLOR.test(value) ? value : null;

/** The coloured rule under a line's main header, from a `safeHexColor` result. */
export const lineRuleColor = (routeColor: string | null) =>
    routeColor ? `color-mix(in srgb, ${routeColor} 60%, transparent)` : 'rgba(255,255,255,0.15)';

const parseHex6 = (hex: string): number[] | null =>
    /^#[0-9a-f]{6}$/i.test(hex) ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : null;

/** `from` blended toward `to` by `amount` (0..1), both as 6-digit hex; `from` unchanged if either is not. */
export function mixHex(from: string, to: string, amount: number): string {
    const a = parseHex6(from);
    const b = parseHex6(to);
    if (!a || !b) return from;
    return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}

const contrastCache = new Map<string, string>();

export function getContrastColor(hexColor: string): string {
    if (!hexColor) return '#ffffff';
    
    if (contrastCache.has(hexColor)) {
        return contrastCache.get(hexColor)!;
    }

    const hex = hexColor.replace('#', '');
    
    let r, g, b;
    if (hex.length === 3) {
        r = parseInt(hex.substring(0, 1) + hex.substring(0, 1), 16);
        g = parseInt(hex.substring(1, 2) + hex.substring(1, 2), 16);
        b = parseInt(hex.substring(2, 3) + hex.substring(2, 3), 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        return '#ffffff';
    }

    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    const result = (yiq >= 128) ? '#000000' : '#ffffff';
    
    contrastCache.set(hexColor, result);
    return result;
}
