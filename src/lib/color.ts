const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The colour if it is a hex colour, otherwise null. Feed colours are interpolated into CSS strings
 * (gradients, color-mix), where any other value could inject CSS such as a url() request.
 */
export const safeHexColor = (value: string | null | undefined): string | null =>
    value && HEX_COLOR.test(value) ? value : null;
